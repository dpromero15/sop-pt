import type {
  AdjustedBumpConfig,
  AdjustedBumpTransaction,
  PlayerRanking,
} from '../types';
import { DEFAULT_BUMP_BUDGET } from '../data/initialData';
import { LEGACY_BUMP_COACH_ID } from '../types';
import { assignCompetitionRanks } from './scoring';

export { DEFAULT_BUMP_BUDGET, LEGACY_BUMP_COACH_ID };

/** Sum of positive bumps and abs-sum of negative bumps (from net map). */
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

/** Collapse transactions into playerId → net bump. */
export function netBumpsFromTransactions(
  transactions: AdjustedBumpTransaction[],
): Record<string, number> {
  const nets: Record<string, number> = {};
  for (const tx of transactions) {
    if (!Number.isFinite(tx.delta)) continue;
    nets[tx.playerId] = (nets[tx.playerId] ?? 0) + tx.delta;
  }
  for (const [id, net] of Object.entries(nets)) {
    if (net === 0) delete nets[id];
  }
  return nets;
}

/** Net bump for one player from all coaches. */
export function playerBumpNet(
  transactions: AdjustedBumpTransaction[],
  playerId: string,
): number {
  let net = 0;
  for (const tx of transactions) {
    if (tx.playerId === playerId) net += tx.delta;
  }
  return net;
}

/** Net bump for one player from one coach. */
export function playerBumpNetForCoach(
  transactions: AdjustedBumpTransaction[],
  playerId: string,
  coachId: string,
): number {
  let net = 0;
  for (const tx of transactions) {
    if (tx.playerId === playerId && tx.coachId === coachId) net += tx.delta;
  }
  return net;
}

/** Net bump for one player from everyone except `coachId`. */
export function playerBumpNetFromOthers(
  transactions: AdjustedBumpTransaction[],
  playerId: string,
  coachId: string,
): number {
  return (
    playerBumpNet(transactions, playerId) -
    playerBumpNetForCoach(transactions, playerId, coachId)
  );
}

/** Player transactions newest-first. */
export function transactionsForPlayer(
  transactions: AdjustedBumpTransaction[],
  playerId: string,
): AdjustedBumpTransaction[] {
  return transactions
    .filter((tx) => tx.playerId === playerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Expand a legacy playerId→net map into unit transactions (no coach attribution).
 */
export function legacyNetsToTransactions(
  nets: Record<string, number>,
  createdAt = new Date().toISOString(),
): AdjustedBumpTransaction[] {
  const out: AdjustedBumpTransaction[] = [];
  for (const [playerId, net] of Object.entries(nets)) {
    if (!Number.isFinite(net) || net === 0) continue;
    const delta: 1 | -1 = net > 0 ? 1 : -1;
    const count = Math.abs(Math.trunc(net));
    for (let i = 0; i < count; i++) {
      out.push({
        id: `bump_legacy_${playerId}_${i}`,
        playerId,
        coachId: LEGACY_BUMP_COACH_ID,
        delta,
        createdAt,
      });
    }
  }
  return out;
}

/**
 * Normalize raw storage: transaction array, or legacy net map.
 */
export function parseStoredBumpTransactions(raw: unknown): AdjustedBumpTransaction[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (tx): tx is AdjustedBumpTransaction =>
        !!tx &&
        typeof tx === 'object' &&
        typeof (tx as AdjustedBumpTransaction).id === 'string' &&
        typeof (tx as AdjustedBumpTransaction).playerId === 'string' &&
        typeof (tx as AdjustedBumpTransaction).coachId === 'string' &&
        ((tx as AdjustedBumpTransaction).delta === 1 ||
          (tx as AdjustedBumpTransaction).delta === -1) &&
        typeof (tx as AdjustedBumpTransaction).createdAt === 'string',
    );
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const nets: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v !== 0) {
        nets[k] = v;
      }
    }
    return legacyNetsToTransactions(nets);
  }
  return [];
}

export function createBumpTransaction(
  playerId: string,
  coachId: string,
  delta: 1 | -1,
): AdjustedBumpTransaction {
  return {
    id: `bump_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    playerId,
    coachId,
    delta,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Apply net bumps as score offsets on Adjusted only, then re-rank.
 * Statistical / coaches fields are unchanged. `adjustedBump` is set on each row.
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
