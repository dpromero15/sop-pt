import { describe, expect, it } from 'vitest';
import { assignCompetitionRanks, calculatePlayerRankings } from './scoring';
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

function player(id: string, name = id): Player {
  return {
    id,
    name,
    jerseyNumber: 9,
    position: 'ST',
    preferredFoot: 'Right',
    joinedDate: '2026-01-01',
    status: 'active',
  };
}

const players: Player[] = [player('p1', 'Alex')];

describe('assignCompetitionRanks', () => {
  it('assigns 1-based places; ties share best place and skip', () => {
    expect(assignCompetitionRanks([90, 80, 80, 70])).toEqual([1, 2, 2, 4]);
  });

  it('keeps nulls unscored', () => {
    expect(assignCompetitionRanks([50, null, 100])).toEqual([2, null, 1]);
  });
});

describe('calculatePlayerRankings', () => {
  it('does not invent baseline scores for unlogged categories', () => {
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
    expect(ranking.totalScore).toBe(ranking.labelScores.speed.score);
    expect(ranking.attendanceRate).toBeNull();
  });

  it('returns null overall when nothing is logged; adjusted is 0', () => {
    const [ranking] = calculatePlayerRankings(
      players,
      [],
      metrics,
      labels,
      formula,
    );

    expect(ranking.totalScore).toBeNull();
    expect(ranking.adjustedTotalScore).toBe(0);
    expect(ranking.overallRank).toBeNull();
    expect(ranking.adjustedRank).toBe(1);
    expect(ranking.labelScores.speed.score).toBeNull();
    expect(ranking.labelScores.speed.adjustedScore).toBe(0);
    expect(ranking.labelScores.technical.score).toBeNull();
  });

  it('ranks unscored players after any recorded score', () => {
    const scored: Player = player('p-scored', 'Scored');
    const neverScored: Player = player('p-none', 'None');
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p-scored',
        metricId: 'm_juggle',
        value: 0,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const rankings = calculatePlayerRankings(
      [scored, neverScored],
      entries,
      metrics,
      labels,
      formula,
    );

    expect(rankings[0].player.id).toBe('p-scored');
    expect(rankings[0].totalScore).not.toBeNull();
    expect(rankings[0].overallRank).toBe(1);
    expect(rankings[1].player.id).toBe('p-none');
    expect(rankings[1].totalScore).toBeNull();
    expect(rankings[1].overallRank).toBeNull();
  });

  it('overall omits unscored labels; adjusted counts them as 0', () => {
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

    // Solo pool → 100 standing for logged 40m
    expect(ranking.labelScores.speed.score).toBe(100);
    expect(ranking.labelScores.technical.score).toBeNull();
    expect(ranking.totalScore).toBe(100);
    // Adjusted: (100*50 + 0*50) / 100 = 50
    expect(ranking.adjustedTotalScore).toBe(50);
    expect(ranking.labelScores.speed.adjustedScore).toBe(100);
    expect(ranking.labelScores.technical.adjustedScore).toBe(0);
    expect(ranking.overallRank).toBe(1);
    expect(ranking.adjustedRank).toBe(1);
  });

  it('uses squad pool percentiles, not absolute min/max', () => {
    const fast = player('fast');
    const mid = player('mid');
    const slow = player('slow');
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'fast',
        metricId: 'm_40m',
        value: 5.0,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'e2',
        sessionId: 's1',
        playerId: 'mid',
        metricId: 'm_40m',
        value: 5.5,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'e3',
        sessionId: 's1',
        playerId: 'slow',
        metricId: 'm_40m',
        value: 6.0,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const rankings = calculatePlayerRankings(
      [fast, mid, slow],
      entries,
      metrics,
      labels,
      formula,
    );

    const byId = Object.fromEntries(rankings.map((r) => [r.player.id, r]));
    expect(byId.fast.labelScores.speed.metrics[0].poolScore).toBe(100);
    expect(byId.mid.labelScores.speed.metrics[0].poolScore).toBe(50);
    expect(byId.slow.labelScores.speed.metrics[0].poolScore).toBe(0);
    expect(byId.fast.overallRank).toBe(1);
    expect(byId.mid.overallRank).toBe(2);
    expect(byId.slow.overallRank).toBe(3);
  });

  it('adjusted rank drops when gaps count against a strong single result', () => {
    const specialist = player('spec');
    const balanced = player('bal');
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'spec',
        metricId: 'm_40m',
        value: 4.5,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'e2',
        sessionId: 's1',
        playerId: 'bal',
        metricId: 'm_40m',
        value: 5.5,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'e3',
        sessionId: 's1',
        playerId: 'bal',
        metricId: 'm_juggle',
        value: 80,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const gapFormula: ScoringFormulaConfig = {
      id: 'f-gap',
      name: 'Gap',
      weights: [
        { labelId: 'speed', weightPercent: 40, enabled: true },
        { labelId: 'technical', weightPercent: 60, enabled: true },
      ],
    };

    const rankings = calculatePlayerRankings(
      [specialist, balanced],
      entries,
      metrics,
      labels,
      gapFormula,
    );
    const byId = Object.fromEntries(rankings.map((r) => [r.player.id, r]));

    // Specialist leads Overall (only speed, best time); Adjusted penalizes missing juggle
    expect(byId.spec.overallRank).toBe(1);
    expect(byId.bal.overallRank).toBe(2);
    // Adjusted: spec ≈ 40 (speed only), bal ≈ 60 (covers technical weight)
    expect(byId.spec.adjustedTotalScore!).toBeLessThan(byId.bal.adjustedTotalScore!);
    expect(byId.bal.adjustedRank).toBe(1);
    expect(byId.spec.adjustedRank).toBe(2);
  });

  it('treats excused attendance as unscored (omitted from overall)', () => {
    const attFormula: ScoringFormulaConfig = {
      id: 'f2',
      name: 'Att',
      weights: [{ labelId: 'attendance', weightPercent: 100, enabled: true }],
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
    expect(ranking.labelScores.attendance.adjustedScore).toBe(0);
    expect(ranking.totalScore).toBeNull();
    expect(ranking.adjustedTotalScore).toBe(0);
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

    expect(ranking.attendanceRate).toBe(75);
  });
});
