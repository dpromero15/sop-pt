import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ATTENDANCE_WEIGHT_PERCENT,
  ensureAttendanceFormulaWeight,
} from './formulaWeights';
import type { ScoringFormulaConfig } from '../types';

describe('ensureAttendanceFormulaWeight', () => {
  it('adds attendance at default weight when missing', () => {
    const formula: ScoringFormulaConfig = {
      id: 'f1',
      name: 'Test',
      weights: [{ labelId: 'speed', weightPercent: 100, enabled: true }],
    };
    const { formula: next, changed } = ensureAttendanceFormulaWeight(formula);
    expect(changed).toBe(true);
    expect(next.weights[0]).toEqual({
      labelId: 'attendance',
      weightPercent: DEFAULT_ATTENDANCE_WEIGHT_PERCENT,
      enabled: true,
    });
    expect(next.weights[1].labelId).toBe('speed');
  });

  it('re-enables disabled attendance and restores zero weight', () => {
    const formula: ScoringFormulaConfig = {
      id: 'f1',
      name: 'Test',
      weights: [
        { labelId: 'attendance', weightPercent: 0, enabled: false },
        { labelId: 'speed', weightPercent: 100, enabled: true },
      ],
    };
    const { formula: next, changed } = ensureAttendanceFormulaWeight(formula);
    expect(changed).toBe(true);
    expect(next.weights.find((w) => w.labelId === 'attendance')).toEqual({
      labelId: 'attendance',
      weightPercent: DEFAULT_ATTENDANCE_WEIGHT_PERCENT,
      enabled: true,
    });
  });

  it('leaves a valid attendance weight unchanged', () => {
    const formula: ScoringFormulaConfig = {
      id: 'f1',
      name: 'Test',
      weights: [
        { labelId: 'attendance', weightPercent: 15, enabled: true },
        { labelId: 'speed', weightPercent: 85, enabled: true },
      ],
    };
    const { formula: next, changed } = ensureAttendanceFormulaWeight(formula);
    expect(changed).toBe(false);
    expect(next).toBe(formula);
  });
});
