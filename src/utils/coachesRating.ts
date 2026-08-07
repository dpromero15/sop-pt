import type { CoachBallot, Player, PlayerRanking } from '../types';
import { assignCompetitionRanks } from './scoring';

/** Active roster used for complete coach ballots. */
export function activePlayers(players: Player[]): Player[] {
  return players.filter((p) => p.status === 'active');
}

/**
 * A ballot is complete when every active player has a unique ordinal 1…N.
 */
export function isCompleteBallot(
  ballot: CoachBallot,
  activePlayerIds: string[],
): boolean {
  const n = activePlayerIds.length;
  if (n === 0) return false;

  const ranks = activePlayerIds.map((id) => ballot.ranks[id]);
  if (ranks.some((r) => r === undefined || r === null || !Number.isFinite(r))) {
    return false;
  }

  const ints = ranks.map((r) => Number(r));
  if (ints.some((r) => !Number.isInteger(r) || r < 1 || r > n)) {
    return false;
  }

  return new Set(ints).size === n;
}

export interface CoachesTotalResult {
  sum: number;
  rank: number;
}

/**
 * Sum ordinals across **complete** ballots only, then competition-rank
 * (lower sum = better). Incomplete ballots are ignored.
 */
export function computeCoachesTotals(
  players: Player[],
  ballots: CoachBallot[],
): Map<string, CoachesTotalResult> {
  const active = activePlayers(players);
  const activeIds = active.map((p) => p.id);
  const complete = ballots.filter((b) => isCompleteBallot(b, activeIds));

  const result = new Map<string, CoachesTotalResult>();
  if (complete.length === 0 || activeIds.length === 0) {
    return result;
  }

  const sums = activeIds.map((playerId) => {
    let sum = 0;
    for (const ballot of complete) {
      sum += ballot.ranks[playerId];
    }
    return sum;
  });

  const ranks = assignCompetitionRanks(sums, false);
  activeIds.forEach((playerId, i) => {
    const rank = ranks[i];
    if (rank !== null) {
      result.set(playerId, { sum: sums[i], rank });
    }
  });

  return result;
}

/** Merge coaches totals onto rankings (inactive / no ballots → null). */
export function attachCoachesTotals(
  rankings: PlayerRanking[],
  players: Player[],
  ballots: CoachBallot[],
): PlayerRanking[] {
  const totals = computeCoachesTotals(players, ballots);
  return rankings.map((r) => {
    const t = totals.get(r.player.id);
    return {
      ...r,
      coachesTotalSum: t?.sum ?? null,
      coachesRank: t?.rank ?? null,
    };
  });
}
