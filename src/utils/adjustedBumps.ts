import type { AdjustedBumpConfig, PlayerRanking } from '../types';
import { DEFAULT_BUMP_BUDGET } from '../data/initialData';
import { assignCompetitionRanks } from './scoring';

export { DEFAULT_BUMP_BUDGET };

/** Sum of positive bumps and abs-sum of negative bumps. */
export function bumpUsage(bumps: Record<string, number>): {
  plusUsed: number;
  minusUsed: number;
} {
  let plusUsed = 0;
  let minusUsed = 0;
  for (const v of Object.values(bumps)) {
    if (!Number.isFinite(v) || v === 0) continue;
    if (v > 0) plusUsed += v;
    else minusUsed += Math.abs(v);
  }
  return { plusUsed, minusUsed };
}

export function bumpBudgetRemaining(
  bumps: Record<string, number>,
  budget: AdjustedBumpConfig,
): { plusRemaining: number; minusRemaining: number } {
  const { plusUsed, minusUsed } = bumpUsage(bumps);
  return {
    plusRemaining: budget.plusBudget - plusUsed,
    minusRemaining: budget.minusBudget - minusUsed,
  };
}

/**
 * Whether applying `delta` (±1) for `playerId` stays within team budgets.
 */
export function canApplyBump(
  bumps: Record<string, number>,
  budget: AdjustedBumpConfig,
  playerId: string,
  delta: 1 | -1,
): boolean {
  const current = bumps[playerId] ?? 0;
  const next = current + delta;
  const nextBumps = { ...bumps };
  if (next === 0) {
    delete nextBumps[playerId];
  } else {
    nextBumps[playerId] = next;
  }
  const { plusUsed, minusUsed } = bumpUsage(nextBumps);
  return plusUsed <= budget.plusBudget && minusUsed <= budget.minusBudget;
}

/**
 * Apply net bumps as score offsets on Adjusted only, then re-rank.
 * Overall / coaches fields are unchanged. `adjustedBump` is set on each row.
 */
export function applyAdjustedBumps(
  rankings: PlayerRanking[],
  bumps: Record<string, number>,
): PlayerRanking[] {
  const withBumps = rankings.map((r) => {
    const bump = bumps[r.player.id] ?? 0;
    return { ...r, adjustedBump: bump };
  });

  const effectiveScores = withBumps.map((r) => {
    if (r.adjustedTotalScore === null) return null;
    return r.adjustedTotalScore + r.adjustedBump;
  });

  const adjustedRanks = assignCompetitionRanks(effectiveScores, true);
  return withBumps.map((r, i) => ({
    ...r,
    adjustedRank: adjustedRanks[i],
  }));
}
