/**
 * Local (and snapshot) data migrations for SOP-PT.
 * See `.cursor/skills/data-migrations/SKILL.md` before changing schemas.
 */

export const SCHEMA_VERSION_KEY = 'stm_schema_version_v1';

/** Monotonic integer. Bump when adding a migration in `registry.ts`. */
export const CURRENT_SCHEMA_VERSION = 10;

export type MigrationStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface MigrationContext {
  storage: MigrationStorage;
  getJson: <T>(key: string) => T | null;
  setJson: (key: string, value: unknown) => void;
  log: (message: string) => void;
}

export interface MigrationResult {
  changed: boolean;
  notes: string[];
}

export interface DataMigration {
  /** Monotonic id; must equal previous + 1 in the registry. */
  id: number;
  name: string;
  description: string;
  /**
   * Apply once when stored schema version is &lt; id.
   * Must be idempotent if re-run on already-migrated data.
   */
  up: (ctx: MigrationContext) => MigrationResult;
}

export interface MigrationRunReport {
  fromVersion: number;
  toVersion: number;
  applied: Array<{ id: number; name: string; notes: string[] }>;
  skipped: boolean;
  error?: string;
}
