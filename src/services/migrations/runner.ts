import {
  CURRENT_SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  type MigrationContext,
  type MigrationRunReport,
  type MigrationStorage,
} from './types';
import { MIGRATIONS } from './registry';

function createContext(storage: MigrationStorage): MigrationContext {
  return {
    storage,
    getJson: <T,>(key: string): T | null => {
      try {
        const raw = storage.getItem(key);
        if (raw == null) return null;
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    setJson: (key, value) => {
      storage.setItem(key, JSON.stringify(value));
    },
    log: (message) => {
      if (typeof console !== 'undefined') {
        console.info(`[sop-pt migrations] ${message}`);
      }
    },
  };
}

export function readStoredSchemaVersion(storage: MigrationStorage): number {
  try {
    const raw = storage.getItem(SCHEMA_VERSION_KEY);
    if (raw == null) return 0;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeStoredSchemaVersion(
  storage: MigrationStorage,
  version: number,
): void {
  storage.setItem(SCHEMA_VERSION_KEY, JSON.stringify(version));
}

export function getMigrationStatus(storage: MigrationStorage = localStorage) {
  const fromVersion = readStoredSchemaVersion(storage);
  return {
    storedVersion: fromVersion,
    currentVersion: CURRENT_SCHEMA_VERSION,
    pending: MIGRATIONS.filter((m) => m.id > fromVersion).map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
    })),
    upToDate: fromVersion >= CURRENT_SCHEMA_VERSION,
  };
}

/**
 * Run all pending migrations against browser localStorage (or a test double).
 * Safe to call on every boot — no-ops when already at CURRENT_SCHEMA_VERSION.
 */
export function runLocalMigrations(
  storage: MigrationStorage = localStorage,
  options?: { forceFrom?: number },
): MigrationRunReport {
  const fromVersion =
    options?.forceFrom !== undefined
      ? options.forceFrom
      : readStoredSchemaVersion(storage);
  const report: MigrationRunReport = {
    fromVersion,
    toVersion: fromVersion,
    applied: [],
    skipped: fromVersion >= CURRENT_SCHEMA_VERSION,
  };

  if (report.skipped) {
    return report;
  }

  const ctx = createContext(storage);
  let version = fromVersion;

  try {
    for (const migration of MIGRATIONS) {
      if (migration.id <= version) continue;
      if (migration.id !== version + 1) {
        throw new Error(
          `Migration gap: at v${version}, next registered is ${migration.id}`,
        );
      }
      const result = migration.up(ctx);
      report.applied.push({
        id: migration.id,
        name: migration.name,
        notes: result.notes,
      });
      version = migration.id;
      writeStoredSchemaVersion(storage, version);
    }
    report.toVersion = version;
    if (version !== CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `Migrations incomplete: reached v${version}, expected ${CURRENT_SCHEMA_VERSION}`,
      );
    }
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err);
    report.toVersion = version;
  }

  return report;
}

/**
 * Re-run from version 0 (repairs). Keeps data; migrations must stay idempotent.
 */
export function repairLocalMigrations(
  storage: MigrationStorage = localStorage,
): MigrationRunReport {
  writeStoredSchemaVersion(storage, 0);
  return runLocalMigrations(storage);
}
