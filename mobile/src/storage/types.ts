export type SyncStatus = 'PENDING' | 'SYNCED';

export type Farmer = {
  local_id: string;
  external_registry_id: string | null;
  name: string;
  province: string;
  territory: string;
  village: string;
  preferred_language: string;
  sync_status: SyncStatus;
};

export type Farm = {
  local_id: string;
  farmer_id: string;
  primary_crops: string;
  latitude: number | null;
  longitude: number | null;
  sync_status: SyncStatus;
};

export type Observation = {
  local_id: string;
  farmer_id: string | null;
  farm_id: string | null;
  timestamp: string;
  crop: string;
  diagnosis_id: string;
  confidence: number;
  sync_status: SyncStatus;
};

export type ProfileInput = {
  name: string;
  province: string;
  territory: string;
  village: string;
  preferredLanguage: string;
  primaryCrops: string;
};

export type ProfileBundle = {
  farmer: Farmer;
  farm: Farm | null;
};

export type ObservationInput = {
  crop: string;
  diagnosisId: string;
  confidence: number;
};
