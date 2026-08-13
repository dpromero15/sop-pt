import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import type {
  LabelDefinition,
  MetricDefinition,
  ScoringFormulaConfig,
} from '../../../types';
import {
  attendanceOnlyFormula,
  pruneFormulaWeightsToLabels,
} from '../../../utils/formulaWeights';
import { normalizeLabelForest } from '../../../utils/labelTree';
import { normalizeMetricLabels } from '../../../utils/metricLabels';

function migrateHierarchyScope(
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

  const labelsIn = Array.isArray(rawLabels) ? rawLabels : [];
  const metricsIn = Array.isArray(rawMetrics) ? rawMetrics : [];
  const formulaIn =
    rawFormula && Array.isArray(rawFormula.weights)
      ? rawFormula
      : attendanceOnlyFormula();

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

  const prunedFormula = pruneFormulaWeightsToLabels(formulaIn, forest.labels);

  const changed =
    forest.changed || metricsChanged || prunedFormula.changed;
  if (!changed) {
    return { touched: false, note: `${labelsKey}: already current` };
  }

  if (rawLabels != null || forest.labels.length > 0) {
    ctx.setJson(labelsKey, forest.labels);
  }
  if (rawMetrics != null || metrics.length > 0) {
    ctx.setJson(metricsKey, metrics);
  }
  if (rawFormula != null || prunedFormula.formula.weights.length > 0) {
    ctx.setJson(formulaKey, prunedFormula.formula);
  }

  return {
    touched: true,
    note: `${labelsKey}: normalized label parents / tree membership`,
  };
}

/**
 * v14 — Optional `parentLabelId` on labels (max depth 1). Strip invalid
 * parents, tree-duplicate metric memberships, and subcategory formula weights.
 */
export function migration014LabelParent(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const unscoped = migrateHierarchyScope(
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
    const scoped = migrateHierarchyScope(
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
    notes.push('No label-hierarchy blobs needed updates.');
  }
  ctx.log(`014: ${notes.join(' | ')}`);
  return { changed, notes };
}
