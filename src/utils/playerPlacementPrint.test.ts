import { describe, expect, it } from 'vitest';
import type {
  LabelDefinition,
  MetricDefinition,
  Player,
  PlayerRanking,
  PositionDefinition,
  Team,
} from '../types';
import {
  buildPlayerPlacementDocument,
  playerPlacementHtml,
} from './playerPlacementPrint';
import { publicIdFromSeed } from './playerPublicId';

const team: Team = {
  id: 't1',
  name: 'Thunder FC',
  shortName: 'THU',
  season: '2026',
  ageGroup: 'U16',
  clubName: 'Thunder Club',
  homeVenue: 'North Field',
  primaryColor: '#0f766e',
  secondaryColor: '#111111',
  timezone: 'America/Denver',
  updatedAt: '2026-08-15',
};

const positions: PositionDefinition[] = [
  {
    code: 'RW',
    name: 'RW',
    tacticalNumber: 7,
    line: 'fwd',
    rankingPool: 'forwards',
    sortOrder: 1,
  },
  {
    code: 'ST',
    name: 'ST',
    tacticalNumber: 9,
    line: 'fwd',
    rankingPool: 'forwards',
    sortOrder: 2,
  },
];

const labels: LabelDefinition[] = [
  {
    id: 'attendance',
    name: 'Attendance',
    description: '',
    color: 'emerald',
    badgeBg: '',
    badgeText: '',
    system: true,
  },
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
    name: '40 Meter Dash',
    labelIds: ['speed'],
    primaryLabelId: 'speed',
    type: 'time_seconds',
    unit: 's',
    higherIsBetter: false,
    aggregationMode: 'best',
  },
];

function player(
  id: string,
  extras: Partial<Player> = {},
): Player {
  return {
    id,
    name: extras.name ?? id,
    publicId: publicIdFromSeed(id),
    jerseyNumber: extras.jerseyNumber ?? 7,
    position: extras.position ?? 'RW',
    positions: extras.positions ?? ['RW', 'ST'],
    preferredFoot: 'Right',
    joinedDate: '2026-01-01',
    status: 'active',
    ...extras,
  };
}

function rankingFor(
  row: Player,
  overallRank: number,
  coachesRank: number | null,
): PlayerRanking {
  return {
    player: row,
    totalScore: 80 - overallRank,
    adjustedTotalScore: 78 - overallRank,
    overallRank,
    adjustedRank: overallRank,
    coachesTotalSum: coachesRank,
    coachesRank,
    adjustedBump: 0,
    eligibleToPlay: true,
    labelScores: {
      speed: {
        labelId: 'speed',
        labelName: 'Speed',
        score: 88,
        adjustedScore: 80,
        entryCount: 1,
        metrics: [
          {
            metricId: 'm_40m',
            metricName: '40 Meter Dash',
            aggregatedValue: 5.4,
            unit: 's',
            poolScore: 90,
          },
        ],
      },
    },
    rank: overallRank,
    attendanceRate: 94,
    recentTrend: 'stable',
    calculatedValues: {},
  };
}

describe('playerPlacementPrint', () => {
  const lucas = player('lucas', { name: 'Lucas Silva', jerseyNumber: 7 });
  const nine = player('nine', {
    name: 'Noah Nine',
    jerseyNumber: 9,
    position: 'ST',
    positions: ['ST'],
  });

  const ctx = {
    team,
    rankings: [
      rankingFor(lucas, 2, 1),
      rankingFor(nine, 1, 2),
    ],
    labels,
    metrics,
    entries: [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'lucas',
        metricId: 'm_40m',
        value: 5.4,
        timestamp: '2026-08-01T00:00:00Z',
      },
    ],
    positions,
    coachBallots: [
      { coachId: 'c1', ranks: { lucas: 1, nine: 2 } },
    ],
    coachPositionBallots: [
      { coachId: 'c1', position: 'ST', ranks: { lucas: 2, nine: 1 } },
      { coachId: 'c1', position: 'RW', ranks: { lucas: 1 } },
    ],
    printedAt: new Date('2026-08-15T12:00:00Z'),
  };

  it('includes overall ranks and every assigned position', () => {
    const doc = buildPlayerPlacementDocument(lucas, ctx);
    expect(doc.playerName).toBe('Lucas Silva');
    expect(doc.overall.statistical.rank).toBe(2);
    expect(doc.overall.coaches.rank).toBe(1);
    expect(doc.positions.map((row) => row.code)).toEqual(['RW', 'ST']);
    const st = doc.positions.find((row) => row.code === 'ST');
    expect(st?.coaches.rank).toBe(2);
    expect(st?.statistical.of).toBeGreaterThanOrEqual(2);
    expect(doc.attendanceRate).toBe('94%');
    expect(doc.metrics.some((row) => row.metricId === 'm_40m')).toBe(true);
  });

  it('builds a two-page named sheet', () => {
    const doc = buildPlayerPlacementDocument(lucas, ctx);
    const html = playerPlacementHtml([doc]);
    expect(html).toContain('Lucas Silva');
    expect(html).toContain('Player placement sheet');
    expect(html).toContain('Assigned position ranks');
    expect(html).toContain('Page 1 of 2');
    expect(html).toContain('Page 2 of 2');
    expect(html.match(/class="page"/g)?.length).toBe(2);
  });

  it('stacks two pages per player for a roster packet', () => {
    const html = playerPlacementHtml([
      buildPlayerPlacementDocument(lucas, ctx),
      buildPlayerPlacementDocument(nine, ctx),
    ]);
    expect(html.match(/class="page"/g)?.length).toBe(4);
    expect(html).toContain('Noah Nine');
  });
});
