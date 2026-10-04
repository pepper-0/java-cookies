# MobileNetV3-Large handoff

The trained checkpoint is `weights/mobilenetv3_crop_diseases.pth`. It is a
PyTorch MobileNetV3-Large state dictionary with a 10-logit classification head.

## Exact trained output order

The order below comes from `full_dataset.classes` in the completed training run.
It must not be reordered after conversion:

1. `cassava_bacterial_blight`
2. `cassava_brown_streak_disease`
3. `cassava_healthy`
4. `cassava_mosaic_disease`
5. `maize_common_rust`
6. `maize_healthy`
7. `maize_northern_leaf_blight`
8. `maize_streak_disease`
9. `rice_blast`
10. `rice_healthy`

For the cassava-only demonstration, `src/ml/labels.json` maps logits 0-3 to
their real cassava diagnosis IDs and logits 4-9 to `cassava_unknown`. Do not
change the model head or append fake logits after training.

## Tensor contract

- input: one RGB image, float32, NCHW shape `[1, 3, 224, 224]`;
- preprocessing: resize to 224×224, scale bytes to 0-1, then normalize with
  mean `[0.485, 0.456, 0.406]` and standard deviation
  `[0.229, 0.224, 0.225]`;
- output: float32 logits with shape `[1, 10]`;
- postprocessing: apply softmax, choose the highest probability, and use the
  matching numeric key from `src/ml/labels.json`;
- fallback: return `cassava_unknown` when the winning index is 4-9 or when the
  winning cassava probability is below the demonstration confidence threshold.

## Export to TFLite

Google's LiteRT Torch converter runs on Linux. Open `java_cookies.ipynb` in
Google Colab and run its final `export-tflite` cell after the trained `model`
variable exists. The cell installs `litert-torch==0.9.4`, converts the model,
checks TFLite logits against PyTorch logits, confirms a `[1, 10]` output, and
downloads `mobilenetv3_crop_diseases.tflite`.

Do not integrate a file that fails the numerical comparison.

## Mobile packaging

After export:

1. Put the file at
   `mobile/assets/models/mobilenetv3_crop_diseases.tflite`.
2. Add `tflite` to Metro's `resolver.assetExts`.
3. Install a LiteRT React Native runtime and its native dependencies.
4. Implement image decoding and the tensor preprocessing contract above behind
   `src/ml/classifier.ts`.
5. Use a custom Expo development build. A TFLite native runtime cannot run in
   Expo Go.

The screens and storage layer should continue to depend only on
`ImageClassifier` and `DiagnosisResult`, never directly on the LiteRT runtime.
No model is bundled yet. The future MobileNetV3 classifier has 15 outputs in the exact order defined by `../labels.json` and `mobilenetv3-training/classes.json`.

The output contract contains:

- `diagnosis_id`: the selected crop-specific class ID;
- `crop`: `maize`, `cassava`, or `rice`, derived from the class metadata; and
- `confidence`: the selected class probability from 0 through 1.

The classifier output is limited to the diagnosis ID, crop, and confidence value.

Before integration, also provide:

- a `.tflite` or `.onnx` model file;
- input dimensions;
- RGB or BGR channel ordering;
- resize, crop, scaling, and normalization steps;
- output tensor meaning; and
- a recommended confidence threshold.

Implement the runtime behind `src/ml/classifier.ts`. The screens, local database, and sync service must continue to consume the existing `DiagnosisResult` contract.

## Local guidance

`../guidance.en.json` and `../guidance.fr.json` contain English and French offline diagnosis data keyed by `diagnosis_id`. Every known diagnosis, crop-specific unknown result, template, and fallback uses the same record schema: ID, name, disease type, symptoms, diagnosis message, structured treatments, and voice message. Treatments can also provide category, cost, and local-verification metadata. `../guidance.ts` selects the active locale and returns the same-schema fallback for an unrecognized future ID.

The guidance file is application content, not a model output. Its agricultural guidance, treatment details, and estimated costs must be reviewed and localized by appropriate DRC agricultural experts before production use.
