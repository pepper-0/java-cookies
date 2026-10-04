import englishGuidanceJson from './guidance.en.json';
import frenchGuidanceJson from './guidance.fr.json';

import type { AppLocale } from '@/localization';

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
const catalogs: Record<AppLocale, GuidanceCatalog> = {
  en: englishGuidanceJson as GuidanceCatalog,
  fr: frenchGuidanceJson as GuidanceCatalog,
};

export function getDiseaseDiagnosis(
  diagnosisId: string | null | undefined,
  locale: AppLocale = 'en',
) {
  const catalog = catalogs[locale] ?? catalogs.en;
  if (!diagnosisId) return catalog.fallback;
  return catalog.diagnoses[diagnosisId] ?? catalog.fallback;
}
