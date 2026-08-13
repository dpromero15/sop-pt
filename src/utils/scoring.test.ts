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
    labelIds: ['speed'],
    primaryLabelId: 'speed',
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
    labelIds: ['technical'],
    primaryLabelId: 'technical',
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
    labelIds: ['attendance'],
    primaryLabelId: 'attendance',
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

  it('feeds season attendance rate into the weighted formula score', () => {
    const attFormula: ScoringFormulaConfig = {
      id: 'f-att',
      name: 'Attendance heavy',
      weights: [
        { labelId: 'attendance', weightPercent: 50, enabled: true },
        { labelId: 'speed', weightPercent: 50, enabled: true },
      ],
    };
    const twoPlayers: Player[] = [player('p1', 'Alex'), player('p2', 'Pat')];
    const entries: MetricEntry[] = [
      // Spotty: present, absent, present → ~66.7%
      {
        id: 'a1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_attendance',
        value: 100,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'a2',
        sessionId: 's2',
        playerId: 'p1',
        metricId: 'm_attendance',
        value: 0,
        timestamp: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'a3',
        sessionId: 's3',
        playerId: 'p1',
        metricId: 'm_attendance',
        value: 100,
        timestamp: '2026-01-03T00:00:00.000Z',
      },
      // Reliable: all present → 100% (latest alone would look identical)
      {
        id: 'b1',
        sessionId: 's1',
        playerId: 'p2',
        metricId: 'm_attendance',
        value: 100,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'b2',
        sessionId: 's2',
        playerId: 'p2',
        metricId: 'm_attendance',
        value: 100,
        timestamp: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'b3',
        sessionId: 's3',
        playerId: 'p2',
        metricId: 'm_attendance',
        value: 100,
        timestamp: '2026-01-03T00:00:00.000Z',
      },
      // Identical speed so only attendance should separate them
      {
        id: 's1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_40m',
        value: 5.2,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 's2',
        sessionId: 's1',
        playerId: 'p2',
        metricId: 'm_40m',
        value: 5.2,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const rankings = calculatePlayerRankings(
      twoPlayers,
      entries,
      metrics,
      labels,
      attFormula,
    );
    const byId = Object.fromEntries(rankings.map((r) => [r.player.id, r]));

    expect(byId.p1.labelScores.attendance.score).toBe(66.7);
    expect(byId.p2.labelScores.attendance.score).toBe(100);
    expect(byId.p2.totalScore!).toBeGreaterThan(byId.p1.totalScore!);
    expect(byId.p2.overallRank).toBe(1);
    expect(byId.p1.overallRank).toBe(2);
  });

  it('exempt metric does not gap-penalize unscored players in Adjusted', () => {
    const defenseLabel: LabelDefinition = {
      id: 'defense',
      name: 'Defense',
      description: '',
      color: 'rose',
      badgeBg: '',
      badgeText: '',
    };
    const labelsWithDefense = [...labels, defenseLabel];
    const metricsWithExempt: MetricDefinition[] = [
      ...metrics,
      {
        id: 'm_sparse_def',
        name: 'Sparse Def Look',
        labelIds: ['defense'],
    primaryLabelId: 'defense',
        type: 'rating_10',
        unit: '/10',
        higherIsBetter: true,
        aggregationMode: 'latest',
        includeInAdjustedTotal: false,
        treatNoScoreAsZero: true,
      },
    ];
    const formulaWithDef: ScoringFormulaConfig = {
      id: 'f-def',
      name: 'With defense',
      weights: [
        { labelId: 'speed', weightPercent: 50, enabled: true },
        { labelId: 'defense', weightPercent: 50, enabled: true },
      ],
    };
    const observed = player('obs', 'Observed');
    const other = player('oth', 'Other');
    const third = player('thd', 'Third');
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'obs',
        metricId: 'm_40m',
        value: 5.0,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'e2',
        sessionId: 's1',
        playerId: 'oth',
        metricId: 'm_40m',
        value: 5.5,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'e3',
        sessionId: 's1',
        playerId: 'thd',
        metricId: 'm_40m',
        value: 6.0,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'e4',
        sessionId: 's1',
        playerId: 'obs',
        metricId: 'm_sparse_def',
        value: 9,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const rankings = calculatePlayerRankings(
      [observed, other, third],
      entries,
      metricsWithExempt,
      labelsWithDefense,
      formulaWithDef,
    );
    const byId = Object.fromEntries(rankings.map((r) => [r.player.id, r]));

    // Defense category has only an exempt metric → null adjusted (no gap blend)
    expect(byId.obs.labelScores.defense.adjustedScore).toBeNull();
    expect(byId.oth.labelScores.defense.adjustedScore).toBeNull();
    // Mid speed standing is 50; without exemption Adjusted would be
    // (50*speed + 0*defense) / 100 = 25. Exemption keeps speed-only = 50.
    expect(byId.oth.labelScores.speed.adjustedScore).toBe(50);
    expect(byId.oth.adjustedTotalScore).toBe(50);
    expect(byId.obs.adjustedTotalScore).toBe(100);
  });

  it('treatNoScoreAsZero false omits missing from adjusted average', () => {
    const multiSpeed: MetricDefinition[] = [
      {
        id: 'm_40m',
        name: '40m',
        labelIds: ['speed'],
        primaryLabelId: 'speed',
        type: 'time_seconds',
        unit: 's',
        higherIsBetter: false,
        aggregationMode: 'best',
        includeInAdjustedTotal: true,
        treatNoScoreAsZero: true,
      },
      {
        id: 'm_shuttle',
        name: 'Shuttle',
        labelIds: ['speed'],
        primaryLabelId: 'speed',
        type: 'time_seconds',
        unit: 's',
        higherIsBetter: false,
        aggregationMode: 'best',
        includeInAdjustedTotal: true,
        treatNoScoreAsZero: false,
      },
    ];
    const speedOnlyFormula: ScoringFormulaConfig = {
      id: 'f-speed',
      name: 'Speed',
      weights: [{ labelId: 'speed', weightPercent: 100, enabled: true }],
    };
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_40m',
        value: 5.0,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const [ranking] = calculatePlayerRankings(
      players,
      entries,
      multiSpeed,
      labels,
      speedOnlyFormula,
    );

    // Solo pool on 40m → 100; shuttle omitted (no score + treatNoScoreAsZero false)
    // Adjusted average is only 40m, not (100 + 0) / 2
    expect(ranking.labelScores.speed.adjustedScore).toBe(100);
    expect(ranking.adjustedTotalScore).toBe(100);
  });

  it('scores multi-category metrics only under primaryLabelId', () => {
    const fitnessLabel = {
      id: 'fitness',
      name: 'Fitness',
      description: '',
      color: 'rose',
      badgeBg: '',
      badgeText: '',
    };
    const dual: MetricDefinition = {
      id: 'm_40m',
      name: '40m',
      labelIds: ['speed', 'fitness'],
      primaryLabelId: 'speed',
      type: 'time_seconds',
      unit: 's',
      higherIsBetter: false,
      aggregationMode: 'best',
    };
    const dualFormula: ScoringFormulaConfig = {
      id: 'f-dual',
      name: 'Dual',
      weights: [
        { labelId: 'speed', weightPercent: 50, enabled: true },
        { labelId: 'fitness', weightPercent: 50, enabled: true },
      ],
    };
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_40m',
        value: 5.0,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const [ranking] = calculatePlayerRankings(
      players,
      entries,
      [dual],
      [...labels, fitnessLabel],
      dualFormula,
    );

    expect(ranking.labelScores.speed.metrics.map((m) => m.metricId)).toEqual([
      'm_40m',
    ]);
    expect(ranking.labelScores.fitness.metrics).toEqual([]);
    expect(ranking.labelScores.fitness.score).toBeNull();
    // Only speed category contributes (50% weight with a score)
    expect(ranking.totalScore).toBe(100);
  });

  it('scores attendance into Statistical and Adjusted even if the label list omitted it', () => {
    const attFormula: ScoringFormulaConfig = {
      id: 'f-att-only',
      name: 'Attendance',
      weights: [{ labelId: 'attendance', weightPercent: 20, enabled: true }],
    };
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
    ];
    const [ranking] = calculatePlayerRankings(
      players,
      entries,
      metrics,
      labels.filter((l) => l.id !== 'attendance'),
      attFormula,
    );

    expect(ranking.attendanceRate).toBe(75);
    expect(ranking.labelScores.attendance.score).toBe(75);
    expect(ranking.labelScores.attendance.adjustedScore).toBe(75);
    expect(ranking.labelScores.attendance.entryCount).toBe(1);
    expect(ranking.totalScore).toBe(75);
    expect(ranking.adjustedTotalScore).toBe(75);
    expect(ranking.overallRank).toBe(1);
    expect(ranking.adjustedRank).toBe(1);
  });

  it('scores attendance entries when the metrics list has no attendance row', () => {
    const attFormula: ScoringFormulaConfig = {
      id: 'f-att-only',
      name: 'Attendance',
      weights: [{ labelId: 'attendance', weightPercent: 20, enabled: true }],
    };
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_attendance',
        value: 100,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];
    const [ranking] = calculatePlayerRankings(
      players,
      entries,
      metrics.filter((m) => m.type !== 'attendance'),
      labels,
      attFormula,
    );

    expect(ranking.attendanceRate).toBe(100);
    expect(ranking.labelScores.attendance.score).toBe(100);
    expect(ranking.totalScore).toBe(100);
    expect(ranking.adjustedTotalScore).toBe(100);
  });

  it('omits inactive players from rankings and percentile pools', () => {
    const cut = player('p-cut', 'Cut');
    cut.status = 'inactive';
    const entries: MetricEntry[] = [
      {
        id: 'e-live',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_juggle',
        value: 10,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'e-cut',
        sessionId: 's1',
        playerId: 'p-cut',
        metricId: 'm_juggle',
        value: 100,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];

    const rankings = calculatePlayerRankings(
      [players[0], cut],
      entries,
      metrics,
      labels,
      formula,
    );

    expect(rankings.map((r) => r.player.id)).toEqual(['p1']);
    // Solo live pool — cut player's 100 must not pull the percentile down.
    expect(rankings[0].labelScores.technical.score).toBe(100);
    expect(rankings[0].overallRank).toBe(1);
  });
});
