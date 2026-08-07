import { describe, expect, it } from 'vitest';
import type { CoachBallot, Player } from '../types';
import {
  activePlayers,
  attachCoachesTotals,
  computeCoachesTotals,
  isCompleteBallot,
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

  it('sums complete ballots and ranks lower sum better', () => {
    const ballots: CoachBallot[] = [
      { coachId: 'c1', ranks: { a: 1, b: 2, c: 3 } },
      { coachId: 'c2', ranks: { a: 2, b: 1, c: 3 } },
    ];
    const totals = computeCoachesTotals(players, ballots);
    expect(totals.get('a')).toEqual({ sum: 3, rank: 1 });
    expect(totals.get('b')).toEqual({ sum: 3, rank: 1 }); // tie
    expect(totals.get('c')).toEqual({ sum: 6, rank: 3 });
    expect(totals.has('d')).toBe(false);
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
