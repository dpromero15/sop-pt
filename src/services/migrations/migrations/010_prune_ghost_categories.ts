import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import type { LabelDefinition, MetricDefinition, ScoringFormulaConfig } from '../../../types';
import {
  attendanceOnlyFormula,
  pruneGhostCategories,
} from '../../../utils/formulaWeights';

function migrateGhostScope(
  ctx: MigrationContext,
  labelsKey: string,
  metricsKey: string,
  formulaKey: string,
): { touched: boolean; note: string } {
  const rawLabels = ctx.getJson<LabelDefinition[] | null>(labelsKey);
  const rawMetrics = ctx.getJson<MetricDefinition[] | null>(metricsKey);
  const rawFormula = ctx.getJson<ScoringFormulaConfig | null>(formulaKey);

  if (rawLabels == null && rawMetrics == null && rawFormula == null) {
    return { touched: false, note: `${labelsKey}: absent` };
  }

  const labels = Array.isArray(rawLabels) ? rawLabels : [];
  const metrics = Array.isArray(rawMetrics) ? rawMetrics : [];
  const formula =
    rawFormula && Array.isArray(rawFormula.weights)
      ? rawFormula
      : attendanceOnlyFormula();

  const pruned = pruneGhostCategories({ labels, metrics, formula });
  if (!pruned.changed) {
    return { touched: false, note: `${labelsKey}: already pruned` };
  }

  if (rawLabels != null || pruned.labels.length > 0) {
    ctx.setJson(labelsKey, pruned.labels);
  }
  if (rawMetrics != null || pruned.metrics.length > 0) {
    ctx.setJson(metricsKey, pruned.metrics);
  }
  if (rawFormula != null || pruned.formula.weights.length > 0) {
    ctx.setJson(formulaKey, pruned.formula);
  }

  return {
    touched: true,
    note: `${labelsKey}: pruned ghost categories/metrics/weights`,
  };
}

/**
 * v10 — Strip orphan Thunder FC sample categories and formula weights so
 * Rankings tabs / Active Weights match Config (no empty Speed/Fitness ghosts).
 */
export function migration010PruneGhostCategories(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const unscoped = migrateGhostScope(
    ctx,
    STORAGE_KEYS.LABELS,
    STORAGE_KEYS.METRICS,
    STORAGE_KEYS.FORMULA,
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
    const scoped = migrateGhostScope(
      ctx,
      scopedStorageKey(teamId, STORAGE_KEYS.LABELS),
      scopedStorageKey(teamId, STORAGE_KEYS.METRICS),
      scopedStorageKey(teamId, STORAGE_KEYS.FORMULA),
    );
    if (scoped.touched) changed = true;
    notes.push(scoped.note);
  } else {
    notes.push('No team id; skipped scoped blobs.');
  }

  if (!changed) {
    notes.push('No ghost category blobs needed updates.');
  }
  ctx.log(`010: ${notes.join(' | ')}`);
  return { changed, notes };
}
