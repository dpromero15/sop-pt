import { describe, expect, it } from 'vitest';
import type { CoachBallot, Player } from '../types';
import {
  activePlayers,
  attachCoachesTotals,
  coachBallotOrdinals,
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
