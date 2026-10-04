import guidanceJson from './guidance.json';

export type DiseaseTreatment = {
  name: string;
  category: string;
  description: string;
  costLevel: string | null;
  estimatedCost: string | number | null;
  requiresLocalVerification?: boolean;
};

export type DiseaseDiagnosis = {
  id: string;
  name: string;
  type: string;
  symptoms: string[];
  diagnosisMessage: string;
  curativeTreatment?: boolean | 'limited';
  additionalPhotoRecommended?: string;
  treatments: DiseaseTreatment[];
  voiceMessage: string;
};

type GuidanceCatalog = {
  version: number;
  locale: string;
  template: DiseaseDiagnosis;
  fallback: DiseaseDiagnosis;
  diagnoses: Record<string, DiseaseDiagnosis>;
};

// JSON imports widen string literals, while the catalog validator enforces the narrower contract.
const catalog = guidanceJson as GuidanceCatalog;

export function getDiseaseDiagnosis(diagnosisId: string | null | undefined) {
  if (!diagnosisId) return catalog.fallback;
  return catalog.diagnoses[diagnosisId] ?? catalog.fallback;
}
