import { describe, expect, it } from 'vitest';
import {
  ATTENDANCE_LABEL,
  DEFAULT_ATTENDANCE_WEIGHT_PERCENT,
  ensureAttendanceFormulaWeight,
  ensureAttendanceLabel,
} from './formulaWeights';
import type { LabelDefinition, ScoringFormulaConfig } from '../types';

describe('ensureAttendanceLabel', () => {
  it('inserts Attendance when missing', () => {
    const labels: LabelDefinition[] = [
      {
        id: 'speed',
        name: 'Speed',
        description: '',
        color: 'blue',
        badgeBg: '',
        badgeText: '',
      },
    ];
    const { labels: next, changed } = ensureAttendanceLabel(labels);
    expect(changed).toBe(true);
    expect(next[0]).toMatchObject({ id: 'attendance', system: true });
    expect(next[1].id).toBe('speed');
  });

  it('marks existing Attendance as system', () => {
    const labels: LabelDefinition[] = [
      { ...ATTENDANCE_LABEL, system: undefined },
    ];
    const { labels: next, changed } = ensureAttendanceLabel(labels);
    expect(changed).toBe(true);
    expect(next[0].system).toBe(true);
  });
});

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

  it('leaves a valid attendance weight unchanged when already first', () => {
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

  it('moves attendance to the front of the weights list', () => {
    const formula: ScoringFormulaConfig = {
      id: 'f1',
      name: 'Test',
      weights: [
        { labelId: 'speed', weightPercent: 80, enabled: true },
        { labelId: 'attendance', weightPercent: 20, enabled: true },
      ],
    };
    const { formula: next, changed } = ensureAttendanceFormulaWeight(formula);
    expect(changed).toBe(true);
    expect(next.weights.map((w) => w.labelId)).toEqual(['attendance', 'speed']);
  });
});
