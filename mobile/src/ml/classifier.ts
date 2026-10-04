import { mockClassifier } from './mockClassifier';

export type DiagnosisResult = {
  diagnosis_id: string;
  crop: string;
  confidence: number;
};

export interface ImageClassifier {
  classifyImage(imageUri: string): Promise<DiagnosisResult>;
}

// Replace this adapter when the model handoff package is ready. Screens and storage
// depend only on ImageClassifier and DiagnosisResult, never on an ML runtime.
const activeClassifier: ImageClassifier = mockClassifier;

export function classifyImage(imageUri: string) {
  return activeClassifier.classifyImage(imageUri);
}
