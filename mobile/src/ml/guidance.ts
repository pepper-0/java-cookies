import guidanceJson from './guidance.json';

export type LocalGuidance = {
  title: string;
  summary: string;
  actions: string[];
  monitoring: string;
  seek_help: string;
  disclaimer: string;
};

type GuidanceCatalog = {
  version: number;
  locale: string;
  template: LocalGuidance;
  fallback: LocalGuidance;
  diagnoses: Record<string, LocalGuidance>;
};

const catalog: GuidanceCatalog = guidanceJson;

export function getLocalGuidance(diagnosisId: string | null | undefined) {
  if (!diagnosisId) return catalog.fallback;
  return catalog.diagnoses[diagnosisId] ?? catalog.fallback;
}
