import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import {
  loadTensorflowModel,
  type TensorflowModel,
} from 'react-native-fast-tflite';

import labels from './labels.json';

import type { DiagnosisResult, ImageClassifier } from './classifier';

const MODEL_SIZE = 224;
const MODEL_OUTPUT_COUNT = 10;
const MIN_CROP_CONFIDENCE = 0.6;
const MIN_DISEASE_CONFIDENCE = 0.5;
const CHANNEL_MEAN = [0.485, 0.456, 0.406] as const;
const CHANNEL_STD = [0.229, 0.224, 0.225] as const;

type SupportedCrop = 'cassava' | 'maize';
type ModelCrop = SupportedCrop | 'rice';

const cropOutputIndexes: Record<ModelCrop, readonly number[]> = {
  cassava: [0, 1, 2, 3],
  maize: [4, 5, 6, 7],
  rice: [8, 9],
};

const unknownDiagnosisIds: Record<SupportedCrop, string> = {
  cassava: 'cassava_unknown',
  maize: 'maize_unknown',
};

let modelPromise: Promise<TensorflowModel> | null = null;

export const tfliteClassifier: ImageClassifier = {
  async classifyImage(imageUri) {
    const [model, inputBuffer] = await Promise.all([
      getModel(),
      createModelInput(imageUri),
    ]);
    const outputs = await model.run([inputBuffer]);

    if (outputs.length !== 1) {
      throw new Error(`The crop model returned ${outputs.length} outputs instead of one.`);
    }

    const logits = new Float32Array(outputs[0]);
    if (logits.length !== MODEL_OUTPUT_COUNT) {
      throw new Error(
        `The crop model returned ${logits.length} values instead of ${MODEL_OUTPUT_COUNT}.`,
      );
    }

    return interpretLogits(logits);
  },
};

async function getModel() {
  modelPromise ??= loadTensorflowModel(
    // Metro resolves bundled binary assets through a static require call.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../assets/models/mobilenetv3_crop_diseases.float32.tflite'),
    [],
  ).then(validateModelContract);

  try {
    return await modelPromise;
  } catch (error) {
    modelPromise = null;
    throw error;
  }
}

function validateModelContract(model: TensorflowModel) {
  const input = model.inputs[0];
  const output = model.outputs[0];
  const expectedInputShape = [1, MODEL_SIZE, MODEL_SIZE, 3];
  const expectedOutputShape = [1, MODEL_OUTPUT_COUNT];

  if (
    model.inputs.length !== 1 ||
    input?.dataType !== 'float32' ||
    !shapesMatch(input.shape, expectedInputShape)
  ) {
    throw new Error('The bundled crop model must have one float32 [1, 224, 224, 3] input.');
  }

  if (
    model.outputs.length !== 1 ||
    output?.dataType !== 'float32' ||
    !shapesMatch(output.shape, expectedOutputShape)
  ) {
    throw new Error('The bundled crop model must have one float32 [1, 10] output.');
  }

  return model;
}

async function createModelInput(imageUri: string) {
  const context = ImageManipulator.manipulate(imageUri);
  context.resize({ width: MODEL_SIZE, height: MODEL_SIZE });
  const renderedImage = await context.renderAsync();
  const resizedImage = await renderedImage.saveAsync({
    compress: 1,
    format: SaveFormat.JPEG,
  });
  const resizedFile = new File(resizedImage.uri);

  try {
    const encodedImage = new Uint8Array(await resizedFile.arrayBuffer());
    const decodedImage = decode(encodedImage, {
      formatAsRGBA: true,
      maxMemoryUsageInMB: 16,
      maxResolutionInMP: 1,
      useTArray: true,
    });

    if (decodedImage.width !== MODEL_SIZE || decodedImage.height !== MODEL_SIZE) {
      throw new Error(
        `Image preprocessing returned ${decodedImage.width}x${decodedImage.height} instead of 224x224.`,
      );
    }

    const input = new Float32Array(MODEL_SIZE * MODEL_SIZE * 3);
    for (let pixel = 0; pixel < MODEL_SIZE * MODEL_SIZE; pixel += 1) {
      const rgbaOffset = pixel * 4;
      const rgbOffset = pixel * 3;
      input[rgbOffset] = normalizeChannel(decodedImage.data[rgbaOffset], 0);
      input[rgbOffset + 1] = normalizeChannel(decodedImage.data[rgbaOffset + 1], 1);
      input[rgbOffset + 2] = normalizeChannel(decodedImage.data[rgbaOffset + 2], 2);
    }

    return input.buffer;
  } finally {
    try {
      resizedFile.delete();
    } catch {
      // The cache file is disposable; inference can still finish if cleanup fails.
    }
  }
}

function normalizeChannel(value: number, channel: 0 | 1 | 2) {
  return (value / 255 - CHANNEL_MEAN[channel]) / CHANNEL_STD[channel];
}

export function interpretLogits(logits: ArrayLike<number>): DiagnosisResult {
  if (logits.length !== MODEL_OUTPUT_COUNT) {
    throw new Error(`Expected ${MODEL_OUTPUT_COUNT} model logits, received ${logits.length}.`);
  }

  const probabilities = softmax(logits);
  const cropScores = (Object.keys(cropOutputIndexes) as ModelCrop[]).map((crop) => ({
    crop,
    confidence: cropOutputIndexes[crop].reduce(
      (total, index) => total + probabilities[index],
      0,
    ),
  }));
  const winningCrop = cropScores.reduce((best, candidate) =>
    candidate.confidence > best.confidence ? candidate : best,
  );

  if (winningCrop.crop === 'rice') {
    return {
      diagnosis_id: 'rice_unsupported',
      crop: 'rice',
      confidence: winningCrop.confidence,
    };
  }

  const winningOutput = cropOutputIndexes[winningCrop.crop].reduce((best, candidate) =>
    probabilities[candidate] > probabilities[best] ? candidate : best,
  );
  const diseaseConfidence = probabilities[winningOutput];

  if (
    winningCrop.confidence < MIN_CROP_CONFIDENCE ||
    diseaseConfidence < MIN_DISEASE_CONFIDENCE
  ) {
    return {
      diagnosis_id: unknownDiagnosisIds[winningCrop.crop],
      crop: winningCrop.crop,
      confidence: diseaseConfidence,
    };
  }

  const diagnosisId = labels[String(winningOutput) as keyof typeof labels];
  if (!diagnosisId) {
    throw new Error(`No diagnosis label is defined for model output ${winningOutput}.`);
  }

  return {
    diagnosis_id: diagnosisId,
    crop: winningCrop.crop,
    confidence: diseaseConfidence,
  };
}

function softmax(logits: ArrayLike<number>) {
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < logits.length; index += 1) {
    maximum = Math.max(maximum, logits[index]);
  }

  const probabilities = new Float32Array(logits.length);
  let total = 0;
  for (let index = 0; index < logits.length; index += 1) {
    const exponent = Math.exp(logits[index] - maximum);
    probabilities[index] = exponent;
    total += exponent;
  }

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('The crop model returned invalid logits.');
  }

  for (let index = 0; index < probabilities.length; index += 1) {
    probabilities[index] /= total;
  }
  return probabilities;
}

function shapesMatch(actual: readonly number[], expected: readonly number[]) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}
