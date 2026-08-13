import { describe, expect, it } from 'vitest';
import type {
  LabelDefinition,
  MetricDefinition,
  Player,
  PlayerRanking,
} from '../types';
import { compareRankings } from './rankingsFilter';
import {
  buildRankingsPrintDocument,
  rankingsPrintHtml,
} from './rankingsPrint';

const metrics: MetricDefinition[] = [
  {
    id: 'm_40m',
    name: '40 Meter Dash',
    labelIds: ['speed'],
    primaryLabelId: 'speed',
    type: 'time_seconds',
    unit: 's',
    higherIsBetter: false,
    aggregationMode: 'best',
  },
];

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

function ranking(
  id: string,
  dash: number | null,
  coachesSum: number | null = null,
): PlayerRanking {
  const player: Player = {
    id,
    name: id,
    jerseyNumber: Number(id.replace(/\D/g, '') || 1),
    position: 'ST',
    preferredFoot: 'Right',
    joinedDate: '2026-01-01',
    status: 'active',
  };
  return {
    player,
    totalScore: dash == null ? null : 50,
    adjustedTotalScore: dash == null ? null : 50,
    overallRank: dash == null ? null : 1,
    adjustedRank: dash == null ? null : 1,
    coachesTotalSum: coachesSum,
    coachesRank: coachesSum == null ? null : 1,
    adjustedBump: 0,
    eligibleToPlay: true,
    labelScores: {
      speed: {
        labelId: 'speed',
        labelName: 'Speed',
        score: dash == null ? null : 80,
        adjustedScore: dash == null ? null : 80,
        entryCount: dash == null ? 0 : 1,
        metrics:
          dash == null
            ? []
            : [
                {
                  metricId: 'm_40m',
                  metricName: '40 Meter Dash',
                  aggregatedValue: dash,
                  unit: 's',
                  poolScore: 80,
                },
              ],
      },
    },
    rank: 1,
    attendanceRate: null,
    recentTrend: 'stable',
    calculatedValues: {},
  };
}

describe('buildRankingsPrintDocument', () => {
  it('ranks all players by a single Statistical metric with unlabeled cuts', () => {
    const pool = [
      ranking('p1', 5.5),
      ranking('p2', 4.8),
      ranking('p3', null),
      ranking('p4', 5.1),
    ];
    const sorted = [...pool].sort((a, b) =>
      compareRankings(a, b, 'metric', 'speed', 'm_40m', metrics, 'overall'),
    );
    const doc = buildRankingsPrintDocument({
      teamName: 'Thunder FC',
      season: '2026',
      rankings: sorted,
      sortBy: 'metric',
      selectedLabelId: 'speed',
      selectedMetricId: 'm_40m',
      metrics,
      labels,
      totalMode: 'overall',
      cutLines: [2, 18],
      printedAt: new Date('2026-08-13T12:00:00Z'),
    });

    expect(doc.title).toBe('40 Meter Dash');
    expect(doc.scopeLine).toMatch(/Statistical/);
    expect(doc.rows.map((r) => r.playerId)).toEqual(['p2', 'p4', 'p1', 'p3']);
    expect(doc.rows.map((r) => r.place)).toEqual([1, 2, 3, null]);
    expect(doc.rows.map((r) => r.value)).toEqual(['4.80s', '5.10s', '5.50s', '—']);
    expect(doc.rows.map((r) => r.showCutBelow)).toEqual([
      false,
      true,
      false,
      false,
    ]);

    const html = rankingsPrintHtml(doc);
    expect(html).toContain('Thunder FC');
    expect(html).toContain('40 Meter Dash');
    expect(html).toContain('cut-after');
    expect(html).not.toMatch(/Cut @/i);
  });

  it('prints Coaches Rank with the same unlabeled cut lines', () => {
    const pool = [
      { ...ranking('a', 50, 9), coachesRank: 3 },
      { ...ranking('b', 50, 3), coachesRank: 1 },
      { ...ranking('c', 50, 6), coachesRank: 2 },
    ];
    const sorted = [...pool].sort((a, b) =>
      compareRankings(a, b, 'total', 'all', 'none', metrics, 'coaches'),
    );
    const doc = buildRankingsPrintDocument({
      teamName: 'Thunder FC',
      rankings: sorted,
      sortBy: 'total',
      selectedLabelId: 'all',
      selectedMetricId: 'none',
      metrics,
      labels,
      totalMode: 'coaches',
      coachesScopeLabel: 'All coaches',
      completeBallotCount: 2,
      cutLines: [1, 2],
    });

    expect(doc.title).toBe('Coaches Rank');
    expect(doc.rows.map((r) => r.playerId)).toEqual(['b', 'c', 'a']);
    expect(doc.rows.map((r) => r.place)).toEqual([1, 2, 3]);
    expect(doc.rows[0].showCutBelow).toBe(true);
    expect(doc.rows[1].showCutBelow).toBe(true);
    expect(rankingsPrintHtml(doc)).not.toMatch(/Cut @/i);
  });
});
