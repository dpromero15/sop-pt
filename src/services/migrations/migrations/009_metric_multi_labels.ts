import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import { migrateMetricsAggregation } from '../../../utils/metricAggregation';

function migrateMetricsKey(
  ctx: MigrationContext,
  key: string,
): { touched: boolean; note: string } {
  const raw = ctx.getJson<unknown>(key);
  if (raw == null) {
    return { touched: false, note: `${key}: absent` };
  }
  const { metrics, changed } = migrateMetricsAggregation(raw);
  if (!changed) {
    return { touched: false, note: `${key}: already multi-label` };
  }
  ctx.setJson(key, metrics);
  return {
    touched: true,
    note: `${key}: normalized labelIds + primaryLabelId (${metrics.length} metrics)`,
  };
}

/**
 * v9 — Metrics may belong to multiple category labels.
 * Maps legacy `labelId` → `labelIds` / `primaryLabelId`.
 */
export function migration009MetricMultiLabels(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const unscoped = migrateMetricsKey(ctx, STORAGE_KEYS.METRICS);
  if (unscoped.touched) changed = true;
  notes.push(unscoped.note);

  let teamId = '';
  try {
    teamId = (ctx.storage.getItem(ACTIVE_TEAM_KEY) ?? '').trim();
  } catch {
    teamId = '';
  }
  if (!teamId) {
    const team = ctx.getJson<{ id?: string }>(STORAGE_KEYS.TEAM);
    teamId = team?.id?.trim() ?? '';
  }

  if (teamId) {
    const scoped = migrateMetricsKey(
      ctx,
      scopedStorageKey(teamId, STORAGE_KEYS.METRICS),
    );
    if (scoped.touched) changed = true;
    notes.push(scoped.note);
  } else {
    notes.push('No team id; skipped scoped metrics blob.');
  }

  if (!changed) {
    notes.push('No metrics blobs needed updates.');
  }
  ctx.log(`009: ${notes.join(' | ')}`);
  return { changed, notes };
}
