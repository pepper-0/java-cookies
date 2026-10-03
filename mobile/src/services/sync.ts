import type { SQLiteDatabase } from 'expo-sqlite';

import { postFarm, postFarmer, postObservation } from './api';
import { getPendingRecords, markRecordSynced, setSetting } from '@/storage/database';

export type SyncResult = {
  attempted: number;
  synced: number;
  errors: string[];
};

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown synchronization error.';
}

export async function syncPendingRecords(
  db: SQLiteDatabase,
  baseUrl: string,
): Promise<SyncResult> {
  const pending = await getPendingRecords(db);
  const result: SyncResult = {
    attempted: pending.farmers.length + pending.farms.length + pending.observations.length,
    synced: 0,
    errors: [],
  };

  for (const farmer of pending.farmers) {
    try {
      const response = await postFarmer(baseUrl, farmer);
      if (!response.success) throw new Error('Backend did not acknowledge the farmer.');
      await markRecordSynced(db, 'farmers', farmer.local_id);
      result.synced += 1;
    } catch (error) {
      result.errors.push(`Farmer: ${messageFrom(error)}`);
    }
  }

  for (const farm of pending.farms) {
    try {
      const response = await postFarm(baseUrl, farm);
      if (!response.success) throw new Error('Backend did not acknowledge the farm.');
      await markRecordSynced(db, 'farms', farm.local_id);
      result.synced += 1;
    } catch (error) {
      result.errors.push(`Farm: ${messageFrom(error)}`);
    }
  }

  for (const observation of pending.observations) {
    try {
      const response = await postObservation(baseUrl, observation);
      if (!response.success) throw new Error('Backend did not acknowledge the observation.');
      await markRecordSynced(db, 'observations', observation.local_id);
      result.synced += 1;
    } catch (error) {
      result.errors.push(`Observation: ${messageFrom(error)}`);
    }
  }

  if (result.synced > 0) {
    await setSetting(db, 'last_sync_at', new Date().toISOString());
  }
  return result;
}
