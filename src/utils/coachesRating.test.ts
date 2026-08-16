import { describe, expect, it } from 'vitest';
import type { CoachBallot, CoachPositionBallot, Player } from '../types';
import {
  activePlayers,
  attachCoachesTotals,
  coachBallotOrdinals,
  coachPoolBallotOrdinals,
  coachesRankingsForPool,
  coachesRankingsForPosition,
  computeCoachesTotals,
  computePositionCoachesTotals,
  isCompleteBallot,
  isCompletePositionBallot,
  playersForPosition,
} from './coachesRating';
import type { PlayerRanking } from '../types';

function player(id: string, status: Player['status'] = 'active'): Player {
  return {
    id,
    name: id,
    jerseyNumber: 1,
    position: 'ST',
    preferredFoot: 'Right',
    joinedDate: '2026-01-01',
    status,
  };
}

describe('isCompleteBallot', () => {
  const ids = ['a', 'b', 'c'];

  it('accepts unique 1…N over all active players', () => {
    expect(
      isCompleteBallot({ coachId: 'c1', ranks: { a: 1, b: 2, c: 3 } }, ids),
    ).toBe(true);
  });

  it('rejects missing players', () => {
    expect(
      isCompleteBallot({ coachId: 'c1', ranks: { a: 1, b: 2 } }, ids),
    ).toBe(false);
  });

  it('rejects duplicate ranks', () => {
    expect(
      isCompleteBallot({ coachId: 'c1', ranks: { a: 1, b: 1, c: 2 } }, ids),
    ).toBe(false);
  });

  it('rejects out-of-range ranks', () => {
    expect(
      isCompleteBallot({ coachId: 'c1', ranks: { a: 1, b: 2, c: 4 } }, ids),
    ).toBe(false);
  });

  it('rejects empty active roster', () => {
    expect(isCompleteBallot({ coachId: 'c1', ranks: {} }, [])).toBe(false);
  });
});

describe('computeCoachesTotals', () => {
  const players = [player('a'), player('b'), player('c'), player('d', 'inactive')];

  it('ignores incomplete ballots', () => {
    const ballots: CoachBallot[] = [
      { coachId: 'c1', ranks: { a: 1, b: 2 } }, // incomplete
    ];
    expect(computeCoachesTotals(players, ballots).size).toBe(0);
  });

  it('averages complete ballots and ranks lower average better', () => {
    const ballots: CoachBallot[] = [
      { coachId: 'c1', ranks: { a: 1, b: 2, c: 3 } },
      { coachId: 'c2', ranks: { a: 2, b: 1, c: 3 } },
    ];
    const totals = computeCoachesTotals(players, ballots);
    expect(totals.get('a')).toEqual({
      sum: 3,
      average: 1.5,
      rank: 1,
      ballotCount: 2,
    });
    expect(totals.get('b')).toEqual({
      sum: 3,
      average: 1.5,
      rank: 1,
      ballotCount: 2,
    }); // tie
    expect(totals.get('c')).toEqual({
      sum: 6,
      average: 3,
      rank: 3,
      ballotCount: 2,
    });
    expect(totals.has('d')).toBe(false);
  });

  it('exposes ordinals from a complete individual ballot', () => {
    const ballot: CoachBallot = {
      coachId: 'c1',
      ranks: { a: 1, b: 2, c: 3 },
    };
    const ordinals = coachBallotOrdinals(players, ballot);
    expect(ordinals.get('a')).toBe(1);
    expect(ordinals.get('b')).toBe(2);
    expect(ordinals.get('c')).toBe(3);
    expect(ordinals.has('d')).toBe(false);
  });

  it('returns empty ordinals for incomplete ballots', () => {
    expect(
      coachBallotOrdinals(players, {
        coachId: 'c1',
        ranks: { a: 1, b: 2 },
      }).size,
    ).toBe(0);
  });

  it('uses only active players for completeness', () => {
    expect(activePlayers(players).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('attachCoachesTotals', () => {
  it('writes null when no complete ballots', () => {
    const rankings = [
      {
        player: player('a'),
        totalScore: 50,
        adjustedTotalScore: 50,
        overallRank: 1,
        adjustedRank: 1,
        coachesTotalSum: 99,
        coachesRank: 1,
        adjustedBump: 0,
        eligibleToPlay: true,
        labelScores: {},
        rank: 1,
        attendanceRate: null,
        recentTrend: 'stable' as const,
        calculatedValues: {},
      },
    ] satisfies PlayerRanking[];
    const next = attachCoachesTotals(rankings, [player('a')], []);
    expect(next[0].coachesTotalSum).toBeNull();
    expect(next[0].coachesRank).toBeNull();
  });
});

describe('position-pool coach rankings', () => {
  const players = [
    { ...player('a'), position: 'LB' as const, rankingPool: 'wingbacks' as const },
    { ...player('b'), position: 'RB' as const, rankingPool: 'wingbacks' as const },
    { ...player('c'), position: 'CB' as const, rankingPool: 'center-defense' as const },
  ];
  const ballot: CoachBallot = {
    coachId: 'c1',
    ranks: { c: 1, b: 2, a: 3 },
  };

  it('re-numbers an individual complete ballot inside the selected pool', () => {
    expect(
      [...coachPoolBallotOrdinals(players, ballot, 'wingbacks').entries()],
    ).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
  });

  it('filters and competition-ranks coach averages inside the pool', () => {
    const rankings = attachCoachesTotals(
      players.map((p) => ({
        player: p,
        totalScore: null,
        adjustedTotalScore: null,
        overallRank: null,
        adjustedRank: null,
        coachesTotalSum: null,
        coachesRank: null,
        adjustedBump: 0,
        eligibleToPlay: true,
        labelScores: {},
        rank: null,
        attendanceRate: null,
        recentTrend: 'stable' as const,
        calculatedValues: {},
      })),
      players,
      [ballot],
    );
    const pooled = coachesRankingsForPool(rankings, 'wingbacks');
    expect(pooled.map((r) => [r.player.id, r.coachesRank])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });
});

describe('per-position coach rankings', () => {
  const players: Player[] = [
    { ...player('a'), position: 'LCB', positions: ['LCB', 'RCB'] },
    { ...player('b'), position: 'RCB', positions: ['RCB'] },
    { ...player('c'), position: 'ST', positions: ['ST'] },
  ];

  it('includes anyone assigned the role, not only primary', () => {
    expect(playersForPosition(players, 'RCB').map((p) => p.id)).toEqual([
      'a',
      'b',
    ]);
    expect(playersForPosition(players, 'ST').map((p) => p.id)).toEqual(['c']);
  });

  it('treats a complete position ballot as unique 1…N of that role', () => {
    const ids = ['a', 'b'];
    expect(
      isCompletePositionBallot(
        { coachId: 'c1', position: 'RCB', ranks: { a: 1, b: 2 } },
        ids,
      ),
    ).toBe(true);
    expect(
      isCompletePositionBallot(
        { coachId: 'c1', position: 'RCB', ranks: { a: 1 } },
        ids,
      ),
    ).toBe(false);
  });

  it('does not reuse the squad 1–N ballot for a position list', () => {
    const squad: CoachBallot = {
      coachId: 'c1',
      ranks: { a: 3, b: 2, c: 1 },
    };
    const positionBallots: CoachPositionBallot[] = [
      { coachId: 'c1', position: 'RCB', ranks: { a: 1, b: 2 } },
    ];
    const totals = computePositionCoachesTotals(
      players,
      positionBallots,
      'RCB',
    );
    expect(totals.get('a')?.rank).toBe(1);
    expect(totals.get('b')?.rank).toBe(2);
    expect(totals.has('c')).toBe(false);
    expect(squad.ranks.c).toBe(1);
  });

  it('attaches independent position ranks onto the filtered list', () => {
    const rankings = players.map((p, i) => ({
      player: p,
      totalScore: 50,
      adjustedTotalScore: 50,
      overallRank: i + 1,
      adjustedRank: i + 1,
      coachesTotalSum: null,
      coachesRank: null,
      adjustedBump: 0,
      eligibleToPlay: true,
      labelScores: {},
      rank: i + 1,
      attendanceRate: null,
      recentTrend: 'stable' as const,
      calculatedValues: {},
    }));
    const next = coachesRankingsForPosition(
      rankings,
      players,
      [{ coachId: 'c1', position: 'RCB', ranks: { b: 1, a: 2 } }],
      'RCB',
    );
    expect(next.map((r) => [r.player.id, r.coachesRank])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });
});
