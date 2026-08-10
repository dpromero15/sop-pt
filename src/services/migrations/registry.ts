import type { DataMigration } from './types';
import { migration001ConsolidateLegacyShapes } from './migrations/001_consolidate_legacy_shapes';
import { migration002SopPtWorkspaceDefaults } from './migrations/002_sop_pt_workspace_defaults';

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
];
