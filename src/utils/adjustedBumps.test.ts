import { describe, expect, it } from 'vitest';
import type { Player, PlayerRanking } from '../types';
import {
  applyAdjustedBumps,
  bumpBudgetRemaining,
  canApplyBump,
  DEFAULT_BUMP_BUDGET,
  legacyNetsToTransactions,
  netBumpsFromTransactions,
  parseStoredBumpTransactions,
  playerBumpNetForCoach,
  playerBumpNetFromOthers,
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
    eligibleToPlay: true,
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

describe('bump transactions', () => {
  it('derives nets and splits mine vs others', () => {
    const txs = [
      {
        id: '1',
        playerId: 'p1',
        coachId: 'me',
        delta: 1 as const,
        createdAt: '2026-08-07T12:00:00.000Z',
      },
      {
        id: '2',
        playerId: 'p1',
        coachId: 'me',
        delta: 1 as const,
        createdAt: '2026-08-07T12:01:00.000Z',
      },
      {
        id: '3',
        playerId: 'p1',
        coachId: 'them',
        delta: -1 as const,
        createdAt: '2026-08-07T12:02:00.000Z',
      },
    ];
    expect(netBumpsFromTransactions(txs)).toEqual({ p1: 1 });
    expect(playerBumpNetForCoach(txs, 'p1', 'me')).toBe(2);
    expect(playerBumpNetFromOthers(txs, 'p1', 'me')).toBe(-1);
  });

  it('migrates legacy net maps into unit transactions', () => {
    const txs = legacyNetsToTransactions(
      { a: 2, b: -1 },
      '2026-01-01T00:00:00.000Z',
    );
    expect(txs).toHaveLength(3);
    expect(netBumpsFromTransactions(txs)).toEqual({ a: 2, b: -1 });
    expect(parseStoredBumpTransactions({ a: 1 })).toHaveLength(1);
    expect(parseStoredBumpTransactions(txs)).toEqual(txs);
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
