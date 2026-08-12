import type { LabelDefinition, ScoringFormulaConfig } from '../types';

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
