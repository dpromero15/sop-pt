import type { ScoringFormulaConfig } from '../types';

/** Default Attendance share of the total-score formula when missing or invalid. */
export const DEFAULT_ATTENDANCE_WEIGHT_PERCENT = 20;

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
  }

  return {
    formula: changed ? { ...formula, weights } : formula,
    changed,
  };
}
