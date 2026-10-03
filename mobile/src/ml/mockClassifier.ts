import type { ImageClassifier } from './classifier';

export const mockClassifier: ImageClassifier = {
  async classifyImage() {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return {
      diagnosis_id: 'cassava_mosaic_disease',
      crop: 'cassava',
      confidence: 0.92,
      severity: 'moderate',
    };
  },
};
