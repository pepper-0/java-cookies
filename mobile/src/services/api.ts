import type { Farm, Farmer, Observation } from '@/storage/types';

export const DEFAULT_API_URL = 'http://10.0.2.2:8000';

type HealthResponse = {
  status: string;
  service: string;
};

type SyncResponse = {
  success: boolean;
  id: string;
  sync_status: 'SYNCED';
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '');
}

async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Backend returned ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Backend request timed out. Check the server address and network.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function checkBackendHealth(baseUrl: string) {
  return requestJson<HealthResponse>(baseUrl, '/health');
}

export function postFarmer(baseUrl: string, farmer: Farmer) {
  return requestJson<SyncResponse>(baseUrl, '/farmers', {
    method: 'POST',
    body: JSON.stringify(farmer),
  });
}

export function postFarm(baseUrl: string, farm: Farm) {
  return requestJson<SyncResponse>(baseUrl, '/farms', {
    method: 'POST',
    body: JSON.stringify({
      ...farm,
      primary_crops: farm.primary_crops
        .split(',')
        .map((crop) => crop.trim())
        .filter(Boolean),
    }),
  });
}

export function postObservation(baseUrl: string, observation: Observation) {
  return requestJson<SyncResponse>(baseUrl, '/observations', {
    method: 'POST',
    body: JSON.stringify(observation),
  });
}
