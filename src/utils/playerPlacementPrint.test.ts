import { describe, expect, it } from 'vitest';
import type {
  LabelDefinition,
  MetricDefinition,
  Player,
  PlayerRanking,
  PositionDefinition,
  Session,
  Team,
} from '../types';
import {
  buildAttendancePrintSummary,
  buildPlayerPlacementDocument,
  formatPlace,
  formatPositionPoolLeaders,
  playerPlacementHtml,
} from './playerPlacementPrint';
import { publicIdFromSeed } from './playerPublicId';
import { ATTENDANCE_METRIC_ID } from './sessionMetrics';

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
    id: ATTENDANCE_METRIC_ID,
    name: 'Attendance',
    labelIds: ['attendance'],
    primaryLabelId: 'attendance',
    type: 'attendance',
    unit: '%',
    higherIsBetter: true,
    aggregationMode: 'average',
  },
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

function session(
  id: string,
  date: string,
  title: string,
  extras: Partial<Session> = {},
): Session {
  return {
    id,
    date,
    title,
    type: 'session',
    status: 'closed',
    metricIds: [ATTENDANCE_METRIC_ID],
    ...extras,
  };
}

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

describe('formatPositionPoolLeaders', () => {
  const pool = [
    { id: 'ryan', name: 'Ryan Cole', rank: 1 },
    { id: 'paul', name: 'Paul Diaz', rank: 2 },
    { id: 'alex', name: 'Alex Kim', rank: 3 },
    { id: 'mark', name: 'Mark Vale', rank: 5 },
  ];

  it('omits a third name when the player is in the top two', () => {
    expect(formatPositionPoolLeaders(pool, 'ryan')).toBe('1. Ryan  2. Paul');
    expect(formatPositionPoolLeaders(pool, 'paul')).toBe('1. Ryan  2. Paul');
  });

  it('appends this player after an ellipsis when they sit outside the top two', () => {
    expect(formatPositionPoolLeaders(pool, 'mark')).toBe(
      '1. Ryan  2. Paul  ···  5. Mark',
    );
  });
});

describe('playerPlacementPrint', () => {
  const lucas = player('lucas', { name: 'Lucas Silva', jerseyNumber: 7 });
  const nine = player('nine', {
    name: 'Noah Nine',
    jerseyNumber: 9,
    position: 'ST',
    positions: ['ST'],
  });
  const mark = player('mark', {
    name: 'Mark Vale',
    jerseyNumber: 11,
    position: 'ST',
    positions: ['ST'],
  });

  const ctx = {
    team,
    rankings: [
      rankingFor(lucas, 2, 1),
      rankingFor(nine, 1, 2),
      rankingFor(mark, 3, 3),
    ],
    labels,
    metrics,
    sessions: [
      session('s1', '2026-08-01', 'Fitness'),
      session('s2', '2026-08-03', 'Match vs United', { type: 'match' }),
      session('s3', '2026-08-05', 'Recovery'),
      session('s4', '2026-08-08', 'Scrimmage'),
    ],
    entries: [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'lucas',
        metricId: 'm_40m',
        value: 5.4,
        timestamp: '2026-08-01T00:00:00Z',
      },
      {
        id: 'e2',
        sessionId: 's1',
        playerId: 'nine',
        metricId: 'm_40m',
        value: 5.1,
        timestamp: '2026-08-01T00:00:00Z',
      },
      {
        id: 'e3',
        sessionId: 's1',
        playerId: 'mark',
        metricId: 'm_40m',
        value: 5.8,
        timestamp: '2026-08-01T00:00:00Z',
      },
      {
        id: 'a1',
        sessionId: 's1',
        playerId: 'lucas',
        metricId: ATTENDANCE_METRIC_ID,
        value: 100,
        timestamp: '2026-08-01T00:00:00Z',
      },
      {
        id: 'a2',
        sessionId: 's2',
        playerId: 'lucas',
        metricId: ATTENDANCE_METRIC_ID,
        value: 50,
        timestamp: '2026-08-03T00:00:00Z',
      },
      {
        id: 'a3',
        sessionId: 's3',
        playerId: 'lucas',
        metricId: ATTENDANCE_METRIC_ID,
        value: 0,
        timestamp: '2026-08-05T00:00:00Z',
      },
      {
        id: 'a4',
        sessionId: 's4',
        playerId: 'lucas',
        metricId: ATTENDANCE_METRIC_ID,
        value: -1,
        timestamp: '2026-08-08T00:00:00Z',
      },
    ],
    positions,
    coachBallots: [
      { coachId: 'c1', ranks: { lucas: 1, nine: 2, mark: 3 } },
    ],
    coachPositionBallots: [
      { coachId: 'c1', position: 'ST', ranks: { lucas: 2, nine: 1, mark: 3 } },
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

  it('treats metric standing as a percentile and adds statistical rank', () => {
    const lucasDoc = buildPlayerPlacementDocument(lucas, ctx);
    const dash = lucasDoc.metrics.find((row) => row.metricId === 'm_40m');
    expect(dash?.standing).toBe('90');
    expect(dash?.rank).toBe('#2 of 3');

    const markDoc = buildPlayerPlacementDocument(mark, ctx);
    expect(
      markDoc.metrics.find((row) => row.metricId === 'm_40m')?.rank,
    ).toBe('#3 of 3');
  });

  it('formats a place as #rank of pool', () => {
    expect(formatPlace({ rank: 2, of: 11, detail: 'Standing 81' })).toBe(
      '#2 of 11',
    );
    expect(formatPlace({ rank: 1, of: 0, detail: '' })).toBe('#1');
    expect(formatPlace({ rank: null, of: 11, detail: 'Unscored' })).toBe('—');
  });

  it('lists top two in each position pool, then this player if outside that pair', () => {
    const lucasDoc = buildPlayerPlacementDocument(lucas, ctx);
    const lucasSt = lucasDoc.positions.find((row) => row.code === 'ST');
    expect(lucasSt?.statisticalLeaders).toBe('1. Noah  2. Lucas');
    expect(lucasDoc.positions.find((row) => row.code === 'RW')?.statisticalLeaders).toBe(
      '1. Lucas',
    );

    const markDoc = buildPlayerPlacementDocument(mark, ctx);
    const markSt = markDoc.positions.find((row) => row.code === 'ST');
    expect(markSt?.statisticalLeaders).toBe('1. Noah  2. Lucas  ···  3. Mark');
  });

  it('builds a two-page named sheet', () => {
    const doc = buildPlayerPlacementDocument(lucas, ctx);
    const html = playerPlacementHtml([doc]);
    expect(html).toContain('Lucas Silva');
    expect(html).toContain('Player placement sheet');
    expect(html).toContain('Assigned position ranks');
    expect(html).toContain('Percentile');
    expect(html).toContain('#2 of 3');
    expect(html).toContain('1. Noah  2. Lucas');
    expect(html).not.toContain('Squad standing</th>');
    expect(html).toContain('Page 1 of 2');
    expect(html).toContain('Page 2 of 2');
    expect(html.match(/class="page"/g)?.length).toBe(2);
    expect(html).toMatch(/page-break-inside:\s*avoid/);
    expect(html).toMatch(/max-height:\s*11in/);
    expect(html).toMatch(/min-height:\s*10/);
    expect(html).not.toMatch(/\.sheet \{[^}]*\n\s*height:\s*10\.2in/);
  });

  it('lists only late and absent session titles, not present or excused', () => {
    const doc = buildPlayerPlacementDocument(lucas, ctx);
    expect(doc.attendance).toEqual({
      present: 1,
      late: 1,
      absent: 1,
      excused: 1,
      exceptions: [
        {
          sessionId: 's3',
          dateLabel: 'Aug 5',
          title: 'Recovery',
          status: 'absent',
        },
        {
          sessionId: 's2',
          dateLabel: 'Aug 3',
          title: 'Match vs United',
          status: 'late',
        },
      ],
    });
    expect(doc.attendance.exceptions.map((row) => row.title)).not.toContain(
      'Fitness',
    );
    expect(doc.attendance.exceptions.map((row) => row.title)).not.toContain(
      'Scrimmage',
    );

    const html = playerPlacementHtml([doc]);
    expect(html).toContain('94% · Present 1 · Late 1 · Absent 1 · Excused 1');
    expect(html).toContain('Aug 3 Match vs United');
    expect(html).toContain('Aug 5 Recovery');
    expect(html).toContain('1 late · 1 absent');
    expect(html).not.toContain('Aug 1 Fitness');
    expect(html).not.toContain('Aug 8 Scrimmage');
  });

  it('omits soft-deleted sessions from the attendance summary', () => {
    const summary = buildAttendancePrintSummary(
      'lucas',
      ctx.entries,
      [
        ...ctx.sessions,
        session('s5', '2026-08-12', 'Deleted practice', {
          deletedAt: '2026-08-13T00:00:00Z',
        }),
      ],
      metrics,
    );
    const withDeletedEntry = buildAttendancePrintSummary(
      'lucas',
      [
        ...ctx.entries,
        {
          id: 'a5',
          sessionId: 's5',
          playerId: 'lucas',
          metricId: ATTENDANCE_METRIC_ID,
          value: 0,
          timestamp: '2026-08-12T00:00:00Z',
        },
      ],
      [
        ...ctx.sessions,
        session('s5', '2026-08-12', 'Deleted practice', {
          deletedAt: '2026-08-13T00:00:00Z',
        }),
      ],
      metrics,
    );
    expect(summary.absent).toBe(1);
    expect(withDeletedEntry.absent).toBe(1);
    expect(
      withDeletedEntry.exceptions.some((row) => row.title === 'Deleted practice'),
    ).toBe(false);
  });

  it('says when there are no late or absent sessions', () => {
    const nineDoc = buildPlayerPlacementDocument(nine, ctx);
    expect(nineDoc.attendance.exceptions).toEqual([]);
    expect(playerPlacementHtml([nineDoc])).toContain(
      'No late or absent sessions.',
    );
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
