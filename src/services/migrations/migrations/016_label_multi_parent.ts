import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import type { LabelDefinition, MetricDefinition } from '../../../types';
import { normalizeLabelForest } from '../../../utils/labelTree';
import { normalizeMetricLabels } from '../../../utils/metricLabels';

function migrateMultiParentScope(
  ctx: MigrationContext,
  labelsKey: string,
  metricsKey: string,
): { touched: boolean; note: string } {
  const rawLabels = ctx.getJson<LabelDefinition[] | null>(labelsKey);
  const rawMetrics = ctx.getJson<MetricDefinition[] | null>(metricsKey);

  if (rawLabels == null && rawMetrics == null) {
    return { touched: false, note: `${labelsKey}: absent` };
  }

  const labelsIn = Array.isArray(rawLabels) ? rawLabels : [];
  const metricsIn = Array.isArray(rawMetrics) ? rawMetrics : [];

  const forest = normalizeLabelForest(labelsIn);
  const metrics: MetricDefinition[] = metricsIn.map((m) => {
    const next = normalizeMetricLabels(m, forest.labels);
    const { labelId: _legacy, ...rest } = next as typeof next & {
      labelId?: string;
    };
    return rest;
  });
  const metricsChanged = metrics.some((m, i) => {
    const prev = metricsIn[i];
    return (
      !prev ||
      m.labelIds.join(',') !== (prev.labelIds || []).join(',') ||
      m.primaryLabelId !== prev.primaryLabelId ||
      'labelId' in prev
    );
  });

  const changed = forest.changed || metricsChanged;
  if (!changed) {
    return { touched: false, note: `${labelsKey}: already current` };
  }

  if (rawLabels != null || forest.labels.length > 0) {
    ctx.setJson(labelsKey, forest.labels);
  }
  if (rawMetrics != null || metrics.length > 0) {
    ctx.setJson(metricsKey, metrics);
  }

  return {
    touched: true,
    note: `${labelsKey}: normalized multi-parent subcategories`,
  };
}

/**
 * v16 — Subcategories may belong to multiple root parents (`parentLabelIds`)
 * with one `primaryParentLabelId` for formula standing (no triple-count).
 */
export function migration016LabelMultiParent(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const unscoped = migrateMultiParentScope(
    ctx,
    STORAGE_KEYS.LABELS,
    STORAGE_KEYS.METRICS,
  );
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
    const scoped = migrateMultiParentScope(
      ctx,
      scopedStorageKey(teamId, STORAGE_KEYS.LABELS),
      scopedStorageKey(teamId, STORAGE_KEYS.METRICS),
    );
    if (scoped.touched) changed = true;
    notes.push(scoped.note);
  } else {
    notes.push('No team id; skipped scoped blobs.');
  }

  if (!changed) {
    notes.push('No multi-parent label blobs needed updates.');
  }
  ctx.log(`016: ${notes.join(' | ')}`);
  return { changed, notes };
}
