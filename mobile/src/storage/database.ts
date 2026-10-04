import { randomUUID } from 'expo-crypto';
import { Directory, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  Farm,
  Farmer,
  Observation,
  ObservationInput,
  ProfileBundle,
  ProfileInput,
} from './types';

const databaseVersion = 2;

const observationColumns = [
  'local_id',
  'farmer_id',
  'farm_id',
  'timestamp',
  'crop',
  'diagnosis_id',
  'confidence',
  'sync_status',
] as const;

const createObservationsTableSql = `
  CREATE TABLE observations (
    local_id TEXT PRIMARY KEY NOT NULL,
    farmer_id TEXT,
    farm_id TEXT,
    timestamp TEXT NOT NULL,
    crop TEXT NOT NULL,
    diagnosis_id TEXT NOT NULL,
    confidence REAL NOT NULL,
    sync_status TEXT NOT NULL CHECK (sync_status IN ('PENDING', 'SYNCED')),
    FOREIGN KEY (farmer_id) REFERENCES farmers(local_id),
    FOREIGN KEY (farm_id) REFERENCES farms(local_id)
  )
`;

export async function migrateDatabase(db: SQLiteDatabase) {
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion > databaseVersion) {
    throw new Error('This database was created by a newer version of LimaDRC.');
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS farmers (
      local_id TEXT PRIMARY KEY NOT NULL,
      external_registry_id TEXT,
      name TEXT NOT NULL,
      province TEXT NOT NULL,
      territory TEXT NOT NULL,
      village TEXT NOT NULL,
      preferred_language TEXT NOT NULL,
      sync_status TEXT NOT NULL CHECK (sync_status IN ('PENDING', 'SYNCED'))
    );

    CREATE TABLE IF NOT EXISTS farms (
      local_id TEXT PRIMARY KEY NOT NULL,
      farmer_id TEXT NOT NULL,
      primary_crops TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      sync_status TEXT NOT NULL CHECK (sync_status IN ('PENDING', 'SYNCED')),
      FOREIGN KEY (farmer_id) REFERENCES farmers(local_id)
    );

    ${createObservationsTableSql.replace('CREATE TABLE observations', 'CREATE TABLE IF NOT EXISTS observations')};

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

  `);

  if (currentVersion < 2) {
    await normalizeObservationsTable(db);
    removePersistedObservationImages();
    await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE)');
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_farmers_sync ON farmers(sync_status);
    CREATE INDEX IF NOT EXISTS idx_farms_sync ON farms(sync_status);
    CREATE INDEX IF NOT EXISTS idx_observations_sync ON observations(sync_status);
  `);

  if (currentVersion < databaseVersion) {
    await db.execAsync(`PRAGMA user_version = ${databaseVersion}`);
  }
}

function removePersistedObservationImages() {
  const directory = new Directory(Paths.document, 'observation-images');
  if (directory.exists) directory.delete();
}

async function normalizeObservationsTable(db: SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(observations)');
  const columnNames = columns.map((column) => column.name);
  const isCurrentSchema =
    columnNames.length === observationColumns.length &&
    observationColumns.every((column, index) => columnNames[index] === column);

  if (isCurrentSchema) return;

  const missingColumns = observationColumns.filter((column) => !columnNames.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(`Observation database is missing required columns: ${missingColumns.join(', ')}`);
  }

  const selectedColumns = observationColumns.join(', ');
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`
      ALTER TABLE observations RENAME TO observations_outdated;
      ${createObservationsTableSql};
      INSERT INTO observations (${selectedColumns})
      SELECT ${selectedColumns} FROM observations_outdated;
      DROP TABLE observations_outdated;
      CREATE INDEX idx_observations_sync ON observations(sync_status);
    `);
  });
}

export async function getProfile(db: SQLiteDatabase): Promise<ProfileBundle | null> {
  const farmer = await db.getFirstAsync<Farmer>('SELECT * FROM farmers ORDER BY rowid LIMIT 1');
  if (!farmer) return null;
  const farm = await db.getFirstAsync<Farm>(
    'SELECT * FROM farms WHERE farmer_id = ? ORDER BY rowid LIMIT 1',
    farmer.local_id
  );
  return { farmer, farm };
}

export async function saveProfile(db: SQLiteDatabase, input: ProfileInput): Promise<ProfileBundle> {
  const existing = await getProfile(db);
  const farmerId = existing?.farmer.local_id ?? randomUUID();
  const farmId = existing?.farm?.local_id ?? randomUUID();

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO farmers (
        local_id, external_registry_id, name, province, territory, village,
        preferred_language, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
      ON CONFLICT(local_id) DO UPDATE SET
        name = excluded.name,
        province = excluded.province,
        territory = excluded.territory,
        village = excluded.village,
        preferred_language = excluded.preferred_language,
        sync_status = 'PENDING'`,
      farmerId,
      existing?.farmer.external_registry_id ?? null,
      input.name.trim(),
      input.province.trim(),
      input.territory.trim(),
      input.village.trim(),
      input.preferredLanguage.trim(),
    );

    await txn.runAsync(
      `INSERT INTO farms (
        local_id, farmer_id, primary_crops, latitude, longitude, sync_status
      ) VALUES (?, ?, ?, ?, ?, 'PENDING')
      ON CONFLICT(local_id) DO UPDATE SET
        farmer_id = excluded.farmer_id,
        primary_crops = excluded.primary_crops,
        sync_status = 'PENDING'`,
      farmId,
      farmerId,
      input.primaryCrops.trim(),
      existing?.farm?.latitude ?? null,
      existing?.farm?.longitude ?? null,
    );
  });

  const saved = await getProfile(db);
  if (!saved) throw new Error('Profile could not be read after saving.');
  return saved;
}

export async function saveObservation(db: SQLiteDatabase, input: ObservationInput) {
  const profile = await getProfile(db);
  const observation: Observation = {
    local_id: randomUUID(),
    farmer_id: profile?.farmer.local_id ?? null,
    farm_id: profile?.farm?.local_id ?? null,
    timestamp: new Date().toISOString(),
    crop: input.crop,
    diagnosis_id: input.diagnosisId,
    confidence: input.confidence,
    sync_status: 'PENDING',
  };

  await db.runAsync(
    `INSERT INTO observations (
      local_id, farmer_id, farm_id, timestamp, crop,
      diagnosis_id, confidence, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    observation.local_id,
    observation.farmer_id,
    observation.farm_id,
    observation.timestamp,
    observation.crop,
    observation.diagnosis_id,
    observation.confidence,
    observation.sync_status,
  );

  return observation;
}

export async function getObservations(db: SQLiteDatabase) {
  return db.getAllAsync<Observation>(`
    SELECT local_id, farmer_id, farm_id, timestamp, crop,
           diagnosis_id, confidence, sync_status
    FROM observations
    ORDER BY timestamp DESC
  `);
}

export async function getPendingCount(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ count: number }>(`
    SELECT
      (SELECT COUNT(*) FROM farmers WHERE sync_status = 'PENDING') +
      (SELECT COUNT(*) FROM farms WHERE sync_status = 'PENDING') +
      (SELECT COUNT(*) FROM observations WHERE sync_status = 'PENDING') AS count
  `);
  return row?.count ?? 0;
}

export async function getPendingRecords(db: SQLiteDatabase) {
  const [farmers, farms, observations] = await Promise.all([
    db.getAllAsync<Farmer>("SELECT * FROM farmers WHERE sync_status = 'PENDING' ORDER BY rowid"),
    db.getAllAsync<Farm>("SELECT * FROM farms WHERE sync_status = 'PENDING' ORDER BY rowid"),
    db.getAllAsync<Observation>(
      `SELECT local_id, farmer_id, farm_id, timestamp, crop,
              diagnosis_id, confidence, sync_status
       FROM observations
       WHERE sync_status = 'PENDING'
       ORDER BY timestamp`
    ),
  ]);
  return { farmers, farms, observations };
}

export async function markRecordSynced(
  db: SQLiteDatabase,
  table: 'farmers' | 'farms' | 'observations',
  localId: string,
) {
  await db.runAsync(`UPDATE ${table} SET sync_status = 'SYNCED' WHERE local_id = ?`, localId);
}

export async function getSetting(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}
