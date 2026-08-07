import { describe, expect, it } from 'vitest';
import type { Player, PlayerRanking } from '../types';
import {
  applyAdjustedBumps,
  bumpBudgetRemaining,
  canApplyBump,
  DEFAULT_BUMP_BUDGET,
} from './adjustedBumps';

function ranking(
  id: string,
  adjustedTotal: number | null,
): PlayerRanking {
  const player: Player = {
    id,
    name: id,
    jerseyNumber: 1,
    position: 'ST',
    preferredFoot: 'Right',
    joinedDate: '2026-01-01',
    status: 'active',
  };
  return {
    player,
    totalScore: 80,
    adjustedTotalScore: adjustedTotal,
    overallRank: 1,
    adjustedRank: null,
    coachesTotalSum: null,
    coachesRank: null,
    adjustedBump: 0,
    labelScores: {},
    rank: 1,
    attendanceRate: null,
    recentTrend: 'stable',
    calculatedValues: {},
  };
}

describe('bump budgets', () => {
  const budget = DEFAULT_BUMP_BUDGET;

  it('tracks remaining plus/minus separately', () => {
    expect(bumpBudgetRemaining({ a: 2, b: -1 }, budget)).toEqual({
      plusRemaining: 1,
      minusRemaining: 2,
    });
  });

  it('blocks exceeding plus budget', () => {
    expect(canApplyBump({ a: 3 }, budget, 'b', 1)).toBe(false);
    expect(canApplyBump({ a: 2 }, budget, 'b', 1)).toBe(true);
  });

  it('blocks exceeding minus budget', () => {
    expect(canApplyBump({ a: -3 }, budget, 'b', -1)).toBe(false);
    expect(canApplyBump({ a: -3 }, budget, 'a', -1)).toBe(false);
    expect(canApplyBump({ a: -2 }, budget, 'a', -1)).toBe(true); // lands at budget
    expect(canApplyBump({ a: -2 }, budget, 'a', 1)).toBe(true);
  });

  it('allows moving toward zero even when budget was full', () => {
    expect(canApplyBump({ a: 3 }, budget, 'a', -1)).toBe(true);
  });
});

describe('applyAdjustedBumps', () => {
  it('offsets adjusted scores and re-ranks (higher better)', () => {
    const rankings = [
      ranking('a', 80),
      ranking('b', 82),
      ranking('c', 70),
    ];
    const next = applyAdjustedBumps(rankings, { a: 3, c: -1 });
    // effective: a=83, b=82, c=69
    expect(next.find((r) => r.player.id === 'a')?.adjustedRank).toBe(1);
    expect(next.find((r) => r.player.id === 'b')?.adjustedRank).toBe(2);
    expect(next.find((r) => r.player.id === 'c')?.adjustedRank).toBe(3);
    expect(next.find((r) => r.player.id === 'a')?.adjustedBump).toBe(3);
    expect(next.find((r) => r.player.id === 'b')?.adjustedBump).toBe(0);
  });

  it('leaves overall scores unchanged and keeps null adjusted unscored', () => {
    const rankings = [ranking('a', null), ranking('b', 50)];
    const next = applyAdjustedBumps(rankings, { a: 2, b: 1 });
    expect(next[0].adjustedRank).toBeNull();
    expect(next[0].totalScore).toBe(80);
    expect(next[1].adjustedRank).toBe(1);
    expect(next[1].adjustedBump).toBe(1);
  });
});
