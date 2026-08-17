import { describe, expect, it } from 'vitest';
import type {
  LabelDefinition,
  MetricDefinition,
  Player,
  PlayerRanking,
} from '../types';
import { compareRankings } from './rankingsFilter';
import {
  buildPlayerIdLegendDocument,
  buildRankingsPrintDocument,
  computePrintScale,
  fitPrintSheetToPage,
  playerIdLegendHtml,
  printColumnCount,
  rankingsPrintHtml,
  splitPrintRows,
} from './rankingsPrint';
import { publicIdFromSeed } from './playerPublicId';

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
    publicId: publicIdFromSeed(id),
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
    expect(html).toContain('breakout');
    expect(html).not.toMatch(/Cut @/i);
    expect(html).toMatch(/border-bottom:\s*2px dotted/);
    expect(html).toMatch(/size:\s*letter portrait/);
    expect(html).toMatch(/height:\s*11in/);
    expect(html).toMatch(/page-break-inside:\s*avoid/);
    expect(html).toContain('class="columns cols-1"');
    expect(html).toContain('>Player<');
    expect(html).toContain('>p2<');
  });

  it('prints player IDs instead of names when requested', () => {
    const pool = [ranking('p1', 5.5), ranking('p2', 4.8)];
    const doc = buildRankingsPrintDocument({
      teamName: 'Thunder FC',
      rankings: pool,
      sortBy: 'metric',
      selectedLabelId: 'speed',
      selectedMetricId: 'm_40m',
      metrics,
      labels,
      totalMode: 'overall',
      cutLines: [],
      nameMode: 'publicId',
    });
    expect(doc.nameHeader).toBe('ID');
    expect(doc.rows.map((r) => r.name)).toEqual([
      publicIdFromSeed('p1'),
      publicIdFromSeed('p2'),
    ]);
    const html = rankingsPrintHtml(doc);
    expect(html).toContain('>ID<');
    expect(html).toContain(publicIdFromSeed('p1'));
    expect(html).not.toContain('>p1<');
  });

  it('prints Avg / Latest / Best columns when entries are provided', () => {
    const pool = [ranking('p1', 5.5), ranking('p2', 4.8)];
    const entries = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_40m',
        value: 5.5,
        timestamp: '2026-01-01T10:00:00Z',
      },
      {
        id: 'e2',
        sessionId: 's2',
        playerId: 'p1',
        metricId: 'm_40m',
        value: 5.1,
        timestamp: '2026-01-15T10:00:00Z',
      },
      {
        id: 'e3',
        sessionId: 's1',
        playerId: 'p2',
        metricId: 'm_40m',
        value: 4.8,
        timestamp: '2026-01-08T10:00:00Z',
      },
    ];
    const doc = buildRankingsPrintDocument({
      teamName: 'Thunder FC',
      rankings: pool,
      sortBy: 'metric',
      selectedLabelId: 'speed',
      selectedMetricId: 'm_40m',
      metrics,
      labels,
      totalMode: 'overall',
      cutLines: [],
      entries,
      printedAt: new Date('2026-08-13T12:00:00Z'),
    });

    expect(doc.showMetricStats).toBe(true);
    expect(doc.scopeLine).toMatch(/Avg \/ Latest \/ All-time best/);
    expect(doc.teamStatsLine).toMatch(/Team · Avg/);
    expect(doc.teamStatsLine).toMatch(/Latest best/);
    expect(doc.teamStatsLine).toMatch(/All-time/);
    expect(doc.rows[0].stats).toEqual({
      average: '5.30s',
      latest: '5.10s',
      best: '5.10s',
    });
    expect(doc.rows[1].stats).toEqual({
      average: '4.80s',
      latest: '4.80s',
      best: '4.80s',
    });

    const html = rankingsPrintHtml(doc);
    expect(html).toContain('>Avg<');
    expect(html).toContain('>Latest<');
    expect(html).toContain('>Best<');
    expect(html).toContain('team-stats');
    expect(html).not.toContain('>Pos<');
  });

  it('builds a name/ID legend for the live roster', () => {
    const players: Player[] = [
      {
        id: 'p1',
        name: 'Ada',
        publicId: publicIdFromSeed('p1'),
        jerseyNumber: 10,
        position: 'ST',
        preferredFoot: 'Right',
        joinedDate: '2026-01-01',
        status: 'active',
      },
      {
        id: 'p2',
        name: 'Bea',
        publicId: publicIdFromSeed('p2'),
        jerseyNumber: 7,
        position: 'CM',
        preferredFoot: 'Left',
        joinedDate: '2026-01-01',
        status: 'inactive',
      },
    ];
    const doc = buildPlayerIdLegendDocument({
      teamName: 'Thunder FC',
      season: '2026',
      players,
      printedAt: new Date('2026-08-13T12:00:00Z'),
    });
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0]).toMatchObject({
      name: 'Ada',
      jersey: 10,
      publicId: publicIdFromSeed('p1'),
    });
    const html = playerIdLegendHtml(doc);
    expect(html).toContain('Player ID Legend');
    expect(html).toContain('Ada');
    expect(html).toContain(publicIdFromSeed('p1'));
    expect(html).not.toContain('Bea');
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

  it('labels substitute and actual-cut meaning on pool printouts', () => {
    const doc = buildRankingsPrintDocument({
      teamName: 'Thunder FC',
      rankings: [ranking('a', 50, 1), ranking('b', 50, 2)],
      sortBy: 'total',
      selectedLabelId: 'all',
      selectedMetricId: 'none',
      metrics,
      labels,
      totalMode: 'coaches',
      rankingPoolLabel: 'Forwards',
      completeBallotCount: 2,
      cutLines: [2, 6],
    });
    expect(doc.title).toBe('Coaches Rank · Forwards');
    expect(doc.scopeLine).toContain('Substitutes after 2 · cuts after 6');
  });

  it('splits a large roster across columns so the sheet stays one page', () => {
    const pool = Array.from({ length: 36 }, (_, i) =>
      ranking(`p${i + 1}`, 4.5 + i * 0.01),
    );
    const doc = buildRankingsPrintDocument({
      teamName: 'Thunder FC',
      rankings: pool,
      sortBy: 'metric',
      selectedLabelId: 'speed',
      selectedMetricId: 'm_40m',
      metrics,
      labels,
      totalMode: 'overall',
      cutLines: [18, 36],
    });
    const html = rankingsPrintHtml(doc);
    expect(printColumnCount(doc.rows.length)).toBe(2);
    expect(html).toContain('class="columns cols-2"');
    expect(html.match(/<table>/g)?.length).toBe(2);
    expect(html).toMatch(/overflow:\s*hidden/);
    expect(html).toMatch(/page-break-after:\s*avoid/);
  });
});

describe('print layout helpers', () => {
  it('uses one column until a letter page would overflow', () => {
    expect(printColumnCount(18)).toBe(1);
    expect(printColumnCount(22)).toBe(1);
    expect(printColumnCount(23)).toBe(2);
    expect(printColumnCount(44)).toBe(2);
    expect(printColumnCount(45)).toBe(3);
  });

  it('splits rows evenly across columns', () => {
    const rows = Array.from({ length: 25 }, (_, i) => i);
    expect(splitPrintRows(rows, 2)).toEqual([
      rows.slice(0, 13),
      rows.slice(13),
    ]);
  });

  it('scales overflowing content onto the sheet and leaves fitting content alone', () => {
    expect(computePrintScale(700, 900, 740, 980)).toBe(1);
    expect(computePrintScale(700, 1200, 740, 980)).toBeCloseTo(
      (980 / 1200) * 0.98,
      5,
    );
  });

  it('collapses leftover layout after scaling a tall sheet', () => {
    const style = { transform: '', marginBottom: '' };
    const page = {
      clientWidth: 740,
      clientHeight: 980,
    };
    const sheet = {
      scrollWidth: 700,
      scrollHeight: 1400,
      style,
      closest: () => page,
    };
    const frameDoc = {
      querySelectorAll: () => [sheet],
      defaultView: {
        getComputedStyle: () => ({
          paddingLeft: '0',
          paddingRight: '0',
          paddingTop: '0',
          paddingBottom: '0',
        }),
      },
    } as unknown as Document;

    const scale = fitPrintSheetToPage(frameDoc);
    expect(scale).toBeCloseTo((980 / 1400) * 0.98, 5);
    expect(style.transform).toBe(`scale(${scale})`);
    expect(parseFloat(style.marginBottom)).toBeCloseTo(1400 * (scale - 1), 5);
  });
});
