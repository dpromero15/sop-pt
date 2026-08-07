import { describe, expect, it } from 'vitest';
import {
  categoryScoreTagLabel,
  compareOptionalRankValue,
  compareRankings,
  isUnscoredForRankMode,
  metricsForCategory,
  selectionAfterCategoryChange,
} from './rankingsFilter';
import type {
  CalculatedFieldDefinition,
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
    aggregationMode: 'best',
  },
  {
    id: 'm_shuttle',
    name: 'Shuttle Run',
    labelId: 'agility',
    type: 'time_seconds',
    unit: 's',
    higherIsBetter: false,
    aggregationMode: 'best',
  },
  {
    id: 'm_juggle',
    name: 'Juggling',
    labelId: 'technical',
    type: 'count',
    unit: 'reps',
    higherIsBetter: true,
    aggregationMode: 'best',
  },
];

const calcFields: CalculatedFieldDefinition[] = [
  {
    id: 'cf_40m_avg',
    name: '40m Average',
    kind: 'average',
    baseMetricId: 'm_40m',
    enabled: true,
    higherIsBetter: false,
    unit: 's',
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

type LabelScoreInput = Omit<PlayerRanking['labelScores'][string], 'weightedScore'> & {
  weightedScore?: number | null;
};

function ranking(
  id: string,
  total: number | null,
  labelScores: Record<string, LabelScoreInput>,
  calculatedValues: Record<string, number> = {},
  weightedTotal: number | null = total,
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
  const withWeighted: PlayerRanking['labelScores'] = {};
  for (const [key, ls] of Object.entries(labelScores)) {
    withWeighted[key] = {
      ...ls,
      weightedScore:
        ls.weightedScore !== undefined ? ls.weightedScore : ls.score,
    };
  }
  return {
    player,
    totalScore: total,
    weightedTotalScore: weightedTotal,
    labelScores: withWeighted,
    rank: 1,
    attendanceRate: 100,
    recentTrend: 'stable',
    calculatedValues,
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

  it('keeps calculated field when switching to all', () => {
    expect(
      selectionAfterCategoryChange('all', 'cf_40m_avg', metrics, calcFields),
    ).toEqual({
      selectedMetricId: 'cf_40m_avg',
      sortBy: 'calculated',
    });
  });
});

describe('compareOptionalRankValue', () => {
  it('puts missing after any real value for higher-is-better', () => {
    expect(compareOptionalRankValue(null, 0, true)).toBeGreaterThan(0);
    expect(compareOptionalRankValue(0, null, true)).toBeLessThan(0);
    expect(compareOptionalRankValue(null, 50, true)).toBeGreaterThan(0);
  });

  it('puts missing after any real value for lower-is-better', () => {
    expect(compareOptionalRankValue(null, 5.5, false)).toBeGreaterThan(0);
    expect(compareOptionalRankValue(5.5, null, false)).toBeLessThan(0);
    expect(compareOptionalRankValue(null, 0, false)).toBeGreaterThan(0);
  });

  it('treats recorded 0 as worst among scored higher-is-better values', () => {
    expect(compareOptionalRankValue(0, 1, true)).toBeGreaterThan(0);
    expect(compareOptionalRankValue(10, 0, true)).toBeLessThan(0);
  });
});

describe('compareRankings', () => {
  const fast = ranking(
    'fast',
    70,
    {
      speed: {
        labelId: 'speed',
        labelName: 'Speed',
        score: 90,
        entryCount: 1,
        metrics: [
          {
            metricId: 'm_40m',
            metricName: '40 Meter Dash',
            aggregatedValue: 4.9,
            unit: 's',
            normalizedScore: 90,
          },
        ],
      },
    },
    { cf_40m_avg: 5.0 },
  );
  const slow = ranking(
    'slow',
    85,
    {
      speed: {
        labelId: 'speed',
        labelName: 'Speed',
        score: 60,
        entryCount: 1,
        metrics: [
          {
            metricId: 'm_40m',
            metricName: '40 Meter Dash',
            aggregatedValue: 5.5,
            unit: 's',
            normalizedScore: 60,
          },
        ],
      },
    },
    { cf_40m_avg: 5.8 },
  );
  const unscored = ranking('unscored', null, {
    speed: {
      labelId: 'speed',
      labelName: 'Speed',
      score: null,
      entryCount: 0,
      metrics: [],
    },
  });
  const zeroTotal = ranking('zero', 0, {
    speed: {
      labelId: 'speed',
      labelName: 'Speed',
      score: 0,
      entryCount: 1,
      metrics: [
        {
          metricId: 'm_40m',
          metricName: '40 Meter Dash',
          aggregatedValue: 8,
          unit: 's',
          normalizedScore: 0,
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

  it('sorts calculated fields by direction', () => {
    expect(
      compareRankings(
        fast,
        slow,
        'calculated',
        'speed',
        'cf_40m_avg',
        metrics,
        calcFields,
      ),
    ).toBeLessThan(0);
  });

  it('ranks unscored after scored for lower-is-better metrics', () => {
    expect(
      compareRankings(unscored, slow, 'metric', 'speed', 'm_40m', metrics),
    ).toBeGreaterThan(0);
  });

  it('ranks unscored after a recorded zero total', () => {
    expect(
      compareRankings(unscored, zeroTotal, 'total', 'all', 'none', metrics),
    ).toBeGreaterThan(0);
  });

  it('ranks zero total after positive totals', () => {
    expect(
      compareRankings(zeroTotal, fast, 'total', 'all', 'none', metrics),
    ).toBeGreaterThan(0);
  });

  it('sorts by weighted total mode', () => {
    const highOverallLowWeighted = ranking(
      'a',
      100,
      {
        speed: {
          labelId: 'speed',
          labelName: 'Speed',
          score: 100,
          weightedScore: 50,
          entryCount: 1,
          metrics: [],
        },
      },
      {},
      50,
    );
    const midBoth = ranking(
      'b',
      70,
      {
        speed: {
          labelId: 'speed',
          labelName: 'Speed',
          score: 70,
          weightedScore: 70,
          entryCount: 1,
          metrics: [],
        },
      },
      {},
      70,
    );
    expect(
      compareRankings(
        highOverallLowWeighted,
        midBoth,
        'total',
        'all',
        'none',
        metrics,
        [],
        'weighted',
      ),
    ).toBeGreaterThan(0);
    expect(
      compareRankings(
        highOverallLowWeighted,
        midBoth,
        'total',
        'all',
        'none',
        metrics,
        [],
        'overall',
      ),
    ).toBeLessThan(0);
  });
});

describe('isUnscoredForRankMode', () => {
  const scored = ranking(
    'scored',
    70,
    {
      speed: {
        labelId: 'speed',
        labelName: 'Speed',
        score: 90,
        entryCount: 1,
        metrics: [
          {
            metricId: 'm_40m',
            metricName: '40 Meter Dash',
            aggregatedValue: 4.9,
            unit: 's',
            normalizedScore: 90,
          },
        ],
      },
    },
    { cf_40m_avg: 5.0 },
  );
  const empty = ranking('empty', null, {
    speed: {
      labelId: 'speed',
      labelName: 'Speed',
      score: null,
      entryCount: 0,
      metrics: [],
    },
  });

  it('detects missing total', () => {
    expect(
      isUnscoredForRankMode(empty, 'total', 'all', 'none', metrics),
    ).toBe(true);
    expect(
      isUnscoredForRankMode(scored, 'total', 'all', 'none', metrics),
    ).toBe(false);
  });

  it('detects missing metric', () => {
    expect(
      isUnscoredForRankMode(empty, 'metric', 'speed', 'm_40m', metrics),
    ).toBe(true);
    expect(
      isUnscoredForRankMode(scored, 'metric', 'speed', 'm_40m', metrics),
    ).toBe(false);
  });
});

describe('categoryScoreTagLabel', () => {
  it('appends score to the label name', () => {
    expect(categoryScoreTagLabel(speedLabel)).toBe('Speed score');
  });
});
