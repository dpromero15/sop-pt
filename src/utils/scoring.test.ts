import { describe, expect, it } from 'vitest';
import { calculatePlayerRankings } from './scoring';
import type {
  LabelDefinition,
  MetricDefinition,
  MetricEntry,
  Player,
  ScoringFormulaConfig,
} from '../types';

const labels: LabelDefinition[] = [
  {
    id: 'speed',
    name: 'Speed',
    description: '',
    color: 'blue',
    badgeBg: '',
    badgeText: '',
  },
  {
    id: 'technical',
    name: 'Technical',
    description: '',
    color: 'purple',
    badgeBg: '',
    badgeText: '',
  },
  {
    id: 'attendance',
    name: 'Attendance',
    description: '',
    color: 'emerald',
    badgeBg: '',
    badgeText: '',
  },
];

const metrics: MetricDefinition[] = [
  {
    id: 'm_40m',
    name: '40m',
    labelId: 'speed',
    type: 'time_seconds',
    unit: 's',
    higherIsBetter: false,
    aggregationMode: 'best',
    minExpectedValue: 4,
    maxExpectedValue: 8,
  },
  {
    id: 'm_juggle',
    name: 'Juggle',
    labelId: 'technical',
    type: 'count',
    unit: 'reps',
    higherIsBetter: true,
    aggregationMode: 'best',
    minExpectedValue: 0,
    maxExpectedValue: 100,
  },
  {
    id: 'm_attendance',
    name: 'Attendance',
    labelId: 'attendance',
    type: 'attendance',
    unit: '%',
    higherIsBetter: true,
    aggregationMode: 'latest',
  },
];

const formula: ScoringFormulaConfig = {
  id: 'f1',
  name: 'Default',
  weights: [
    { labelId: 'speed', weightPercent: 50, enabled: true },
    { labelId: 'technical', weightPercent: 50, enabled: true },
  ],
};

const players: Player[] = [
  {
    id: 'p1',
    name: 'Alex',
    jerseyNumber: 9,
    position: 'ST',
    preferredFoot: 'Right',
    joinedDate: '2026-01-01',
    status: 'active',
  },
];

describe('calculatePlayerRankings', () => {
  it('does not invent baseline 70 scores for unlogged categories', () => {
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_40m',
        value: 5,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const [ranking] = calculatePlayerRankings(
      players,
      entries,
      metrics,
      labels,
      formula,
    );

    expect(ranking.labelScores.speed.score).not.toBeNull();
    expect(ranking.labelScores.technical.score).toBeNull();
    expect(ranking.labelScores.technical.entryCount).toBe(0);
    // Overall uses only labels with data (speed), not a fake technical 70
    expect(ranking.totalScore).toBe(ranking.labelScores.speed.score);
    expect(ranking.attendanceRate).toBeNull();
  });

  it('returns null overall when nothing is logged', () => {
    const [ranking] = calculatePlayerRankings(
      players,
      [],
      metrics,
      labels,
      formula,
    );

    expect(ranking.totalScore).toBeNull();
    expect(ranking.weightedTotalScore).toBe(0);
    expect(ranking.labelScores.speed.score).toBeNull();
    expect(ranking.labelScores.speed.weightedScore).toBe(0);
    expect(ranking.labelScores.technical.score).toBeNull();
  });

  it('ranks unscored players after recorded zero totals', () => {
    const scoredZero: Player = {
      ...players[0],
      id: 'p-zero',
      name: 'Zero',
    };
    const neverScored: Player = {
      ...players[0],
      id: 'p-none',
      name: 'None',
    };
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p-zero',
        metricId: 'm_juggle',
        value: 0,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const rankings = calculatePlayerRankings(
      [scoredZero, neverScored],
      entries,
      metrics,
      labels,
      formula,
    );

    expect(rankings[0].player.id).toBe('p-zero');
    expect(rankings[0].totalScore).toBe(0);
    expect(rankings[1].player.id).toBe('p-none');
    expect(rankings[1].totalScore).toBeNull();
  });

  it('overall omits unscored labels; weighted counts them as 0', () => {
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_40m',
        value: 4,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const [ranking] = calculatePlayerRankings(
      players,
      entries,
      metrics,
      labels,
      formula,
    );

    // Perfect speed (4s → 100), no technical
    expect(ranking.labelScores.speed.score).toBe(100);
    expect(ranking.labelScores.technical.score).toBeNull();
    expect(ranking.totalScore).toBe(100);
    // Weighted: (100*50 + 0*50) / 100 = 50
    expect(ranking.weightedTotalScore).toBe(50);
    // Category weighted: only m_40m in speed → still 100; technical has m_juggle → 0
    expect(ranking.labelScores.speed.weightedScore).toBe(100);
    expect(ranking.labelScores.technical.weightedScore).toBe(0);
  });

  it('treats excused attendance as unscored (omitted from overall)', () => {
    const attFormula: ScoringFormulaConfig = {
      id: 'f2',
      name: 'Att',
      weights: [
        { labelId: 'attendance', weightPercent: 100, enabled: true },
      ],
    };
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_attendance',
        value: -1,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const [ranking] = calculatePlayerRankings(
      players,
      entries,
      metrics,
      labels,
      attFormula,
    );

    expect(ranking.labelScores.attendance.score).toBeNull();
    expect(ranking.labelScores.attendance.weightedScore).toBe(0);
    expect(ranking.totalScore).toBeNull();
    expect(ranking.weightedTotalScore).toBe(0);
    expect(ranking.attendanceRate).toBeNull();
  });

  it('averages present/late/absent for attendance rate; skips excused', () => {
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_attendance',
        value: 100,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'e2',
        sessionId: 's2',
        playerId: 'p1',
        metricId: 'm_attendance',
        value: 50,
        timestamp: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'e3',
        sessionId: 's3',
        playerId: 'p1',
        metricId: 'm_attendance',
        value: -1,
        timestamp: '2026-01-03T00:00:00.000Z',
      },
    ];

    const [ranking] = calculatePlayerRankings(
      players,
      entries,
      metrics,
      labels,
      formula,
    );

    // (100 + 50) / 2 — excused omitted
    expect(ranking.attendanceRate).toBe(75);
  });
});
