import type {
  LabelDefinition,
  MetricDefinition,
  ScoringFormulaConfig,
} from '../types';
import {
  childrenOf,
  isSubcategory,
  normalizeLabelForest,
  parentIdsOf,
  primaryParentIdOf,
  rootLabels,
} from './labelTree';
import { normalizeMetricLabels } from './metricLabels';

/** Default Attendance share of the total-score formula when missing or invalid. */
export const DEFAULT_ATTENDANCE_WEIGHT_PERCENT = 20;

/** Built-in Attendance category — always present; cannot be cleared or deleted. */
export const ATTENDANCE_LABEL: LabelDefinition = {
  id: 'attendance',
  name: 'Attendance',
  description: 'Punctuality, practice attendance, and team reliability',
  color: 'emerald',
  badgeBg:
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  badgeText: 'text-emerald-700 dark:text-emerald-300',
  iconName: 'CalendarCheck',
  system: true,
};

/**
 * Thunder FC sample category ids. Unused ones (no metrics) are pruned so they
 * do not ghost on Rankings when absent from Config.
 */
export const SAMPLE_CATEGORY_IDS = [
  'speed',
  'agility',
  'technical',
  'offense',
  'defense',
  'fitness',
  'character',
] as const;

const SAMPLE_CATEGORY_ID_SET = new Set<string>(SAMPLE_CATEGORY_IDS);

/** Attendance-only formula used for empty teams (not the full Thunder FC demo). */
export function attendanceOnlyFormula(): ScoringFormulaConfig {
  return {
    id: 'default_formula',
    name: 'Balanced Coach Rating',
    weights: [
      {
        labelId: 'attendance',
        weightPercent: DEFAULT_ATTENDANCE_WEIGHT_PERCENT,
        enabled: true,
      },
    ],
  };
}

/**
 * Category tabs / formula sliders: Attendance first, then every **root** label.
 * Subcategories are folders under a parent, not their own formula rows.
 */
export function visibleRankingLabels(
  labels: LabelDefinition[],
): LabelDefinition[] {
  const { labels: forest } = normalizeLabelForest(labels);
  const roots = rootLabels(forest);
  const attendance =
    roots.find((l) => l.id === 'attendance') ?? ATTENDANCE_LABEL;
  const withoutAtt = roots.filter((l) => l.id !== 'attendance');
  return [attendance, ...withoutAtt];
}

/**
 * Active Weights chips: enabled formula rows that still have a real label.
 */
export function visibleActiveWeights(
  formula: ScoringFormulaConfig,
  labels: LabelDefinition[],
): ScoringFormulaConfig['weights'] {
  const labelIds = new Set(visibleRankingLabels(labels).map((l) => l.id));
  labelIds.add('attendance');
  return [...formula.weights]
    .filter(
      (w) =>
        w.enabled && w.weightPercent > 0 && labelIds.has(w.labelId),
    )
    .sort((a, b) => {
      if (a.labelId === 'attendance') return -1;
      if (b.labelId === 'attendance') return 1;
      return 0;
    });
}

/**
 * Drop formula weights whose labelId is not in the current category list.
 * Always re-ensures Attendance afterward.
 */
export function pruneFormulaWeightsToLabels(
  formula: ScoringFormulaConfig,
  labels: LabelDefinition[],
): { formula: ScoringFormulaConfig; changed: boolean } {
  const labelIds = new Set(visibleRankingLabels(labels).map((l) => l.id));
  labelIds.add('attendance');
  const pruned = formula.weights.filter((w) => labelIds.has(w.labelId));
  const prunedChanged = pruned.length !== formula.weights.length;
  const base = prunedChanged ? { ...formula, weights: pruned } : formula;
  const { formula: ensured, changed: attChanged } =
    ensureAttendanceFormulaWeight(base);
  return { formula: ensured, changed: prunedChanged || attChanged };
}

/**
 * Remove orphan sample categories / metrics / formula weights so Rankings and
 * Config share one category set.
 */
export function pruneGhostCategories(opts: {
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
  formula: ScoringFormulaConfig;
}): {
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
  formula: ScoringFormulaConfig;
  changed: boolean;
} {
  let changed = false;

  const ensuredLabels = ensureAttendanceLabel(opts.labels);
  let labels = ensuredLabels.labels;
  if (ensuredLabels.changed) changed = true;

  const labelIdSet = new Set(labels.map((l) => l.id));
  const metrics: MetricDefinition[] = [];
  for (const m of opts.metrics) {
    const normalized = normalizeMetricLabels(m);
    if (m.type === 'attendance' || m.id === 'm_attendance') {
      if (
        normalized.labelIds.length !== 1 ||
        normalized.labelIds[0] !== 'attendance' ||
        normalized.primaryLabelId !== 'attendance'
      ) {
        changed = true;
      }
      metrics.push({
        ...m,
        labelIds: ['attendance'],
        primaryLabelId: 'attendance',
      });
      continue;
    }

    const ids = normalized.labelIds.filter((id) => labelIdSet.has(id));
    if (ids.length === 0) {
      changed = true;
      continue;
    }
    const primaryLabelId = ids.includes(normalized.primaryLabelId)
      ? normalized.primaryLabelId
      : ids[0];
    if (
      ids.length !== normalized.labelIds.length ||
      primaryLabelId !== normalized.primaryLabelId ||
      ids.some((id, i) => id !== normalized.labelIds[i])
    ) {
      changed = true;
    }
    metrics.push({ ...m, labelIds: ids, primaryLabelId });
  }

  const usedByMetrics = new Set<string>();
  for (const m of metrics) {
    for (const id of m.labelIds) usedByMetrics.add(id);
  }

  const { labels: forest, changed: forestChanged } = normalizeLabelForest(labels);
  if (forestChanged) changed = true;

  const filteredLabels = forest.filter((l) => {
    if (l.id === 'attendance' || l.system) return true;
    if (!SAMPLE_CATEGORY_ID_SET.has(l.id)) return true;
    if (usedByMetrics.has(l.id)) return true;
    return childrenOf(forest, l.id).some(
      (child) =>
        !SAMPLE_CATEGORY_ID_SET.has(child.id) || usedByMetrics.has(child.id),
    );
  });
  const keptIds = new Set(filteredLabels.map((l) => l.id));
  const withoutOrphans: LabelDefinition[] = [];
  for (const l of filteredLabels) {
    const parents = parentIdsOf(l).filter((p) => keptIds.has(p));
    if (isSubcategory(l) && parents.length === 0) {
      changed = true;
      continue;
    }
    if (parents.length === 0) {
      withoutOrphans.push(l);
      continue;
    }
    const primary =
      parents.includes(primaryParentIdOf(l) ?? '')
        ? primaryParentIdOf(l)!
        : parents[0];
    if (
      parents.length !== parentIdsOf(l).length ||
      primary !== primaryParentIdOf(l) ||
      l.parentLabelId !== primary
    ) {
      changed = true;
      withoutOrphans.push({
        ...l,
        parentLabelIds: parents,
        primaryParentLabelId: primary,
        parentLabelId: primary,
      });
      continue;
    }
    withoutOrphans.push(l);
  }
  if (withoutOrphans.length !== labels.length) changed = true;
  const reEnsured = ensureAttendanceLabel(withoutOrphans);
  labels = reEnsured.labels;
  if (reEnsured.changed) changed = true;

  const prunedFormula = pruneFormulaWeightsToLabels(opts.formula, labels);
  if (prunedFormula.changed) changed = true;

  return {
    labels,
    metrics,
    formula: prunedFormula.formula,
    changed,
  };
}

/**
 * Attendance label must exist in the category list (system, non-removable).
 */
export function ensureAttendanceLabel(
  labels: LabelDefinition[],
): { labels: LabelDefinition[]; changed: boolean } {
  const idx = labels.findIndex((l) => l.id === 'attendance');
  if (idx < 0) {
    return {
      labels: [{ ...ATTENDANCE_LABEL }, ...labels],
      changed: true,
    };
  }

  const current = labels[idx];
  if (current.system) {
    return { labels, changed: false };
  }

  const next = labels.slice();
  next[idx] = {
    ...ATTENDANCE_LABEL,
    ...current,
    id: 'attendance',
    system: true,
    name: current.name?.trim() || ATTENDANCE_LABEL.name,
    description: current.description || ATTENDANCE_LABEL.description,
    badgeBg: current.badgeBg || ATTENDANCE_LABEL.badgeBg,
    badgeText: current.badgeText || ATTENDANCE_LABEL.badgeText,
  };
  return { labels: next, changed: true };
}

/**
 * Attendance is a system category: always enabled in the formula with a
 * positive weight. Coaches may change the percent; they cannot turn it off.
 */
export function ensureAttendanceFormulaWeight(
  formula: ScoringFormulaConfig,
): { formula: ScoringFormulaConfig; changed: boolean } {
  const weights = formula.weights.map((w) => ({ ...w }));
  const idx = weights.findIndex((w) => w.labelId === 'attendance');
  let changed = false;

  if (idx < 0) {
    weights.unshift({
      labelId: 'attendance',
      weightPercent: DEFAULT_ATTENDANCE_WEIGHT_PERCENT,
      enabled: true,
    });
    changed = true;
  } else {
    const current = weights[idx];
    const weightPercent =
      current.weightPercent > 0
        ? current.weightPercent
        : DEFAULT_ATTENDANCE_WEIGHT_PERCENT;
    if (!current.enabled || current.weightPercent !== weightPercent) {
      weights[idx] = {
        ...current,
        enabled: true,
        weightPercent,
      };
      changed = true;
    }
    // Keep Attendance first in the Active Weights strip.
    if (idx > 0) {
      const [att] = weights.splice(idx, 1);
      weights.unshift(att);
      changed = true;
    }
  }

  return {
    formula: changed ? { ...formula, weights } : formula,
    changed,
  };
}
