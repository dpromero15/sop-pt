import type { DataMigration } from './types';
import { migration001ConsolidateLegacyShapes } from './migrations/001_consolidate_legacy_shapes';
import { migration002SopPtWorkspaceDefaults } from './migrations/002_sop_pt_workspace_defaults';
import { migration003RepairMetricsBlob } from './migrations/003_repair_metrics_blob';
import { migration004PerTeamLocalCache } from './migrations/004_per_team_local_cache';
import { migration005ComplianceBlocksPractice } from './migrations/005_compliance_blocks_practice';
import { migration006AttendanceFormulaWeight } from './migrations/006_attendance_formula_weight';
import { migration007AttendanceLabel } from './migrations/007_attendance_label';
import { migration008ClearCalculatedFields } from './migrations/008_clear_calculated_fields';
import { migration009MetricMultiLabels } from './migrations/009_metric_multi_labels';

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
  {
    id: 5,
    name: 'compliance_blocks_practice',
    description:
      'Backfill blocksPractice on compliance requirements; seed red-card sit-out.',
    up: migration005ComplianceBlocksPractice,
  },
  {
    id: 6,
    name: 'attendance_formula_weight',
    description:
      'Ensure Attendance is enabled with a positive weight in the scoring formula.',
    up: migration006AttendanceFormulaWeight,
  },
  {
    id: 7,
    name: 'attendance_label',
    description:
      'Ensure Attendance system category label exists for Active Weights UI.',
    up: migration007AttendanceLabel,
  },
  {
    id: 8,
    name: 'clear_calculated_fields',
    description:
      'Clear calculated-fields catalog; average is a metric aggregation mode.',
    up: migration008ClearCalculatedFields,
  },
  {
    id: 9,
    name: 'metric_multi_labels',
    description:
      'Map legacy metric labelId → labelIds + primaryLabelId (multi-category).',
    up: migration009MetricMultiLabels,
  },
];
