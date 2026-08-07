import { describe, expect, it } from 'vitest';
import {
  categoryScoreTagLabel,
  compareRankings,
  metricsForCategory,
  selectionAfterCategoryChange,
} from './rankingsFilter';
import type {
  LabelDefinition,
  MetricDefinition,
  Player,
  PlayerRanking,
} from '../types';

const metrics: MetricDefinition[] = [
  {
    id: 'm_40m',
    name: '40 Meter Dash',
    labelId: 'speed',
    type: 'time_seconds',
    unit: 's',
    higherIsBetter: false,
  },
  {
    id: 'm_shuttle',
    name: 'Shuttle Run',
    labelId: 'agility',
    type: 'time_seconds',
    unit: 's',
    higherIsBetter: false,
  },
  {
    id: 'm_juggle',
    name: 'Juggling',
    labelId: 'technical',
    type: 'count',
    unit: 'reps',
    higherIsBetter: true,
  },
];

const speedLabel: LabelDefinition = {
  id: 'speed',
  name: 'Speed',
  description: 'Sprint',
  color: 'blue',
  badgeBg: '',
  badgeText: '',
};

function ranking(
  id: string,
  total: number,
  labelScores: PlayerRanking['labelScores'],
): PlayerRanking {
  const player: Player = {
    id,
    name: id,
    jerseyNumber: 1,
    position: 'ST',
    preferredFoot: 'Right',
    joinedDate: '2026-01-01',
    status: 'active',
  };
  return {
    player,
    totalScore: total,
    labelScores,
    rank: 1,
    attendanceRate: 100,
    recentTrend: 'stable',
  };
}

describe('metricsForCategory', () => {
  it('returns all metrics for all categories', () => {
    expect(metricsForCategory(metrics, 'all')).toHaveLength(3);
  });

  it('returns only metrics for the selected label', () => {
    expect(metricsForCategory(metrics, 'speed').map((m) => m.id)).toEqual([
      'm_40m',
    ]);
  });
});

describe('selectionAfterCategoryChange', () => {
  it('defaults to overall total when switching to all', () => {
    expect(selectionAfterCategoryChange('all', 'm_40m', metrics)).toEqual({
      selectedMetricId: 'm_40m',
      sortBy: 'metric',
    });
  });

  it('defaults to category score when metric is not in the new category', () => {
    expect(selectionAfterCategoryChange('speed', 'm_juggle', metrics)).toEqual({
      selectedMetricId: 'none',
      sortBy: 'label',
    });
  });

  it('keeps metric when it belongs to the new category', () => {
    expect(selectionAfterCategoryChange('speed', 'm_40m', metrics)).toEqual({
      selectedMetricId: 'm_40m',
      sortBy: 'metric',
    });
  });

  it('defaults to total when entering all with no metric', () => {
    expect(selectionAfterCategoryChange('all', 'none', metrics)).toEqual({
      selectedMetricId: 'none',
      sortBy: 'total',
    });
  });
});

describe('compareRankings', () => {
  const fast = ranking('fast', 70, {
    speed: {
      labelId: 'speed',
      labelName: 'Speed',
      score: 90,
      entryCount: 1,
      metrics: [
        {
          metricId: 'm_40m',
          metricName: '40 Meter Dash',
          latestValue: 4.9,
          unit: 's',
          normalizedScore: 90,
        },
      ],
    },
  });
  const slow = ranking('slow', 85, {
    speed: {
      labelId: 'speed',
      labelName: 'Speed',
      score: 60,
      entryCount: 1,
      metrics: [
        {
          metricId: 'm_40m',
          metricName: '40 Meter Dash',
          latestValue: 5.5,
          unit: 's',
          normalizedScore: 60,
        },
      ],
    },
  });

  it('sorts by total score', () => {
    expect(
      compareRankings(fast, slow, 'total', 'all', 'none', metrics),
    ).toBeGreaterThan(0);
  });

  it('sorts by label score', () => {
    expect(
      compareRankings(fast, slow, 'label', 'speed', 'none', metrics),
    ).toBeLessThan(0);
  });

  it('sorts lower-is-better metrics ascending', () => {
    expect(
      compareRankings(fast, slow, 'metric', 'speed', 'm_40m', metrics),
    ).toBeLessThan(0);
  });
});

describe('categoryScoreTagLabel', () => {
  it('appends score to the label name', () => {
    expect(categoryScoreTagLabel(speedLabel)).toBe('Speed score');
  });
});
