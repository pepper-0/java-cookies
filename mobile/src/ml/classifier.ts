import { tfliteClassifier } from './tfliteClassifier';

export type DiagnosisResult = {
  diagnosis_id: string;
  crop: string;
  confidence: number;
};

export interface ImageClassifier {
  classifyImage(imageUri: string): Promise<DiagnosisResult>;
}

// Screens and storage depend only on ImageClassifier and DiagnosisResult, never on an ML runtime.
const activeClassifier: ImageClassifier = tfliteClassifier;

export function classifyImage(imageUri: string) {
  return activeClassifier.classifyImage(imageUri);
}
