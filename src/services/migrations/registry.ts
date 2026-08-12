import type { DataMigration } from './types';
import { migration001ConsolidateLegacyShapes } from './migrations/001_consolidate_legacy_shapes';
import { migration002SopPtWorkspaceDefaults } from './migrations/002_sop_pt_workspace_defaults';
import { migration003RepairMetricsBlob } from './migrations/003_repair_metrics_blob';
import { migration004PerTeamLocalCache } from './migrations/004_per_team_local_cache';

/**
 * Ordered list of migrations. Append only — never reorder or reuse ids.
 * Next id must be CURRENT_SCHEMA_VERSION after you bump types.ts.
 */
export const MIGRATIONS: DataMigration[] = [
  {
    id: 1,
    name: 'consolidate_legacy_shapes',
    description:
      'Persist historical on-read session/metric/label/bump migrations.',
    up: migration001ConsolidateLegacyShapes,
  },
  {
    id: 2,
    name: 'sop_pt_workspace_defaults',
    description:
      'Ensure Team docs have required fields for landing/picker/header (2.8).',
    up: migration002SopPtWorkspaceDefaults,
  },
  {
    id: 3,
    name: 'repair_metrics_blob',
    description:
      'Fix metrics localStorage if a non-array `{ metrics, changed }` was written.',
    up: migration003RepairMetricsBlob,
  },
  {
    id: 4,
    name: 'per_team_local_cache',
    description:
      'Namespace local JSON blobs by team id so devices do not share one cache.',
    up: migration004PerTeamLocalCache,
  },
];
