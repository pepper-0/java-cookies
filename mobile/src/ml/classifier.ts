import { mockClassifier } from './mockClassifier';

export type DiagnosisResult = {
  diagnosis_id: string;
  crop: string;
  confidence: number;
};

export interface ImageClassifier {
  classifyImage(imageUri: string): Promise<DiagnosisResult>;
}

// Replace this adapter when the TFLite runtime and preprocessing pipeline are installed.
// Screens and storage depend only on ImageClassifier and DiagnosisResult, never on an ML runtime.
const activeClassifier: ImageClassifier = mockClassifier;

export function classifyImage(imageUri: string) {
  return activeClassifier.classifyImage(imageUri);
}
