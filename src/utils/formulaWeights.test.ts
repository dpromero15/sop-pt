import { describe, expect, it } from 'vitest';
import {
  ATTENDANCE_LABEL,
  DEFAULT_ATTENDANCE_WEIGHT_PERCENT,
  attendanceOnlyFormula,
  ensureAttendanceFormulaWeight,
  ensureAttendanceLabel,
  pruneFormulaWeightsToLabels,
  pruneGhostCategories,
  visibleActiveWeights,
  visibleRankingLabels,
} from './formulaWeights';
import type { LabelDefinition, MetricDefinition, ScoringFormulaConfig } from '../types';

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

describe('visibleRankingLabels / visibleActiveWeights', () => {
  it('puts Attendance first for tabs', () => {
    const labels: LabelDefinition[] = [
      {
        id: 'speed',
        name: 'Speed',
        description: '',
        color: 'blue',
        badgeBg: '',
        badgeText: '',
      },
      { ...ATTENDANCE_LABEL },
    ];
    expect(visibleRankingLabels(labels).map((l) => l.id)).toEqual([
      'attendance',
      'speed',
    ]);
  });

  it('hides Active Weights chips for labels that no longer exist', () => {
    const labels: LabelDefinition[] = [{ ...ATTENDANCE_LABEL }];
    const formula: ScoringFormulaConfig = {
      id: 'f1',
      name: 'Test',
      weights: [
        { labelId: 'attendance', weightPercent: 20, enabled: true },
        { labelId: 'speed', weightPercent: 15, enabled: true },
        { labelId: 'fitness', weightPercent: 5, enabled: true },
      ],
    };
    expect(visibleActiveWeights(formula, labels).map((w) => w.labelId)).toEqual([
      'attendance',
    ]);
  });
});

describe('pruneFormulaWeightsToLabels', () => {
  it('drops orphan weight rows and keeps Attendance', () => {
    const formula: ScoringFormulaConfig = {
      id: 'f1',
      name: 'Test',
      weights: [
        { labelId: 'attendance', weightPercent: 20, enabled: true },
        { labelId: 'speed', weightPercent: 80, enabled: true },
      ],
    };
    const { formula: next, changed } = pruneFormulaWeightsToLabels(formula, [
      { ...ATTENDANCE_LABEL },
    ]);
    expect(changed).toBe(true);
    expect(next.weights.map((w) => w.labelId)).toEqual(['attendance']);
  });
});

describe('pruneGhostCategories', () => {
  it('removes unused sample labels, orphan metrics, and orphan weights', () => {
    const labels: LabelDefinition[] = [
      { ...ATTENDANCE_LABEL },
      {
        id: 'speed',
        name: 'Speed',
        description: '',
        color: 'blue',
        badgeBg: '',
        badgeText: '',
      },
      {
        id: 'fitness',
        name: 'Fitness',
        description: '',
        color: 'orange',
        badgeBg: '',
        badgeText: '',
      },
      {
        id: 'custom_power',
        name: 'Power',
        description: '',
        color: 'red',
        badgeBg: '',
        badgeText: '',
      },
    ];
    const metrics: MetricDefinition[] = [
      {
        id: 'm_attendance',
        name: 'Session Attendance',
        labelIds: ['attendance'],
        primaryLabelId: 'attendance',
        type: 'attendance',
        unit: 'status',
        higherIsBetter: true,
        aggregationMode: 'latest',
      },
      {
        id: 'm_orphan',
        name: 'Orphan Beep',
        labelIds: ['missing_cat'],
        primaryLabelId: 'missing_cat',
        type: 'count',
        unit: 'reps',
        higherIsBetter: true,
        aggregationMode: 'latest',
      },
    ];
    const formula: ScoringFormulaConfig = {
      ...attendanceOnlyFormula(),
      weights: [
        { labelId: 'attendance', weightPercent: 20, enabled: true },
        { labelId: 'speed', weightPercent: 15, enabled: true },
        { labelId: 'fitness', weightPercent: 5, enabled: true },
      ],
    };

    const next = pruneGhostCategories({ labels, metrics, formula });
    expect(next.changed).toBe(true);
    expect(next.labels.map((l) => l.id).sort()).toEqual([
      'attendance',
      'custom_power',
    ]);
    expect(next.metrics.map((m) => m.id)).toEqual(['m_attendance']);
    expect(next.formula.weights.map((w) => w.labelId)).toEqual(['attendance']);
  });

  it('keeps sample labels that still have metrics', () => {
    const labels: LabelDefinition[] = [
      { ...ATTENDANCE_LABEL },
      {
        id: 'speed',
        name: 'Speed',
        description: '',
        color: 'blue',
        badgeBg: '',
        badgeText: '',
      },
    ];
    const metrics: MetricDefinition[] = [
      {
        id: 'm_40m',
        name: '40m',
        labelIds: ['speed'],
        primaryLabelId: 'speed',
        type: 'time_seconds',
        unit: 's',
        higherIsBetter: false,
        aggregationMode: 'best',
      },
    ];
    const formula = attendanceOnlyFormula();
    const next = pruneGhostCategories({ labels, metrics, formula });
    expect(next.labels.some((l) => l.id === 'speed')).toBe(true);
    expect(next.metrics).toHaveLength(1);
  });
});
