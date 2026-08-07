import { describe, expect, it } from 'vitest';
import {
  aggregateMetricValue,
  averageMetricValue,
  defaultAggregationMode,
  migrateMetricsAggregation,
  percentileAmong,
  perSessionRate,
} from './metricAggregation';
import type { MetricAggregationMode, MetricDefinition, MetricEntry } from '../types';

const dash: MetricDefinition = {
  id: 'm_40m',
  name: '40m',
  labelId: 'speed',
  type: 'time_seconds',
  unit: 's',
  higherIsBetter: false,
  aggregationMode: 'best',
};

const goals: MetricDefinition = {
  id: 'm_goals',
  name: 'Goals',
  labelId: 'offense',
  type: 'count',
  unit: 'goals',
  higherIsBetter: true,
  aggregationMode: 'sum',
};

function entry(
  metricId: string,
  value: number,
  timestamp: string,
  sessionId = 's1',
): MetricEntry {
  return {
    id: `e_${timestamp}`,
    sessionId,
    playerId: 'p1',
    metricId,
    value,
    timestamp,
  };
}

describe('defaultAggregationMode', () => {
  it('uses best for time metrics', () => {
    expect(defaultAggregationMode({ type: 'time_seconds', unit: 's' })).toBe(
      'best',
    );
  });

  it('uses sum for goals/assists/tackles', () => {
    expect(defaultAggregationMode({ type: 'count', unit: 'goals' })).toBe(
      'sum',
    );
  });

  it('uses latest for ratings', () => {
    expect(defaultAggregationMode({ type: 'rating_10', unit: '/10' })).toBe(
      'latest',
    );
  });
});

describe('migrateMetricsAggregation', () => {
  it('fills missing aggregationMode', () => {
    const legacy = { ...dash } as MetricDefinition & {
      aggregationMode?: MetricAggregationMode;
    };
    delete legacy.aggregationMode;
    const { metrics, changed } = migrateMetricsAggregation([legacy]);
    expect(changed).toBe(true);
    expect(metrics[0].aggregationMode).toBe('best');
  });

  it('defaults Adjusted flags to true when missing', () => {
    const legacy = { ...dash } as MetricDefinition & {
      includeInAdjustedTotal?: boolean;
      treatNoScoreAsZero?: boolean;
    };
    delete legacy.includeInAdjustedTotal;
    delete legacy.treatNoScoreAsZero;
    const { metrics, changed } = migrateMetricsAggregation([legacy]);
    expect(changed).toBe(true);
    expect(metrics[0].includeInAdjustedTotal).toBe(true);
    expect(metrics[0].treatNoScoreAsZero).toBe(true);
  });

  it('preserves explicit false Adjusted flags', () => {
    const custom: MetricDefinition = {
      ...dash,
      includeInAdjustedTotal: false,
      treatNoScoreAsZero: false,
    };
    const { metrics, changed } = migrateMetricsAggregation([custom]);
    expect(changed).toBe(false);
    expect(metrics[0].includeInAdjustedTotal).toBe(false);
    expect(metrics[0].treatNoScoreAsZero).toBe(false);
  });
});

describe('aggregateMetricValue', () => {
  it('sums goals across sessions', () => {
    const entries = [
      entry('m_goals', 2, '2026-01-01T10:00:00Z', 's1'),
      entry('m_goals', 1, '2026-01-08T10:00:00Z', 's2'),
    ];
    expect(aggregateMetricValue(entries, goals)).toBe(3);
  });

  it('picks all-time lowest for 40m best', () => {
    const entries = [
      entry('m_40m', 5.5, '2026-01-01T10:00:00Z'),
      entry('m_40m', 4.9, '2026-01-08T10:00:00Z'),
      entry('m_40m', 5.1, '2026-01-15T10:00:00Z'),
    ];
    expect(aggregateMetricValue(entries, dash)).toBe(4.9);
  });

  it('uses latest when mode is latest', () => {
    const rating: MetricDefinition = {
      ...goals,
      id: 'm_rating',
      type: 'rating_10',
      unit: '/10',
      aggregationMode: 'latest',
    };
    const entries = [
      entry('m_rating', 7, '2026-01-01T10:00:00Z'),
      entry('m_rating', 9, '2026-01-08T10:00:00Z'),
    ];
    expect(aggregateMetricValue(entries, rating)).toBe(9);
  });
});

describe('average and per-session', () => {
  it('averages times', () => {
    expect(
      averageMetricValue([
        entry('m_40m', 5.0, '2026-01-01T10:00:00Z'),
        entry('m_40m', 6.0, '2026-01-08T10:00:00Z'),
      ]),
    ).toBe(5.5);
  });

  it('computes goals per session', () => {
    expect(
      perSessionRate([
        entry('m_goals', 2, '2026-01-01T10:00:00Z', 's1'),
        entry('m_goals', 1, '2026-01-08T10:00:00Z', 's2'),
      ]),
    ).toBe(1.5);
  });
});

describe('percentileAmong', () => {
  it('gives 100 to the best lower-is-better time', () => {
    expect(percentileAmong(4.9, [4.9, 5.2, 5.5], false)).toBe(100);
  });

  it('gives 0 to the worst', () => {
    expect(percentileAmong(5.5, [4.9, 5.2, 5.5], false)).toBe(0);
  });
});
