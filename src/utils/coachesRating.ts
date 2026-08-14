import type {
  CoachBallot,
  Player,
  PlayerRanking,
  PlayerRankingPool,
} from '../types';
import { assignCompetitionRanks } from './scoring';
import { activePlayers } from './playerStatus';
import { rankingPoolForPlayer } from './playerRankingPools';

export { activePlayers } from './playerStatus';

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
  /** Mean ordinal across complete ballots (sum / ballot count). */
  average: number;
  rank: number;
  ballotCount: number;
}

/**
 * Average ordinals across **complete** ballots only, then competition-rank
 * (lower average = better; same order as sum). Incomplete ballots are ignored.
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

  const ballotCount = complete.length;
  const averages = activeIds.map((playerId) => {
    let sum = 0;
    for (const ballot of complete) {
      sum += ballot.ranks[playerId];
    }
    return sum / ballotCount;
  });

  const ranks = assignCompetitionRanks(averages, false);
  activeIds.forEach((playerId, i) => {
    const rank = ranks[i];
    if (rank !== null) {
      const average = averages[i];
      result.set(playerId, {
        sum: average * ballotCount,
        average,
        rank,
        ballotCount,
      });
    }
  });

  return result;
}

/**
 * Ordinals from one coach's complete ballot (1 = best).
 * Empty map when the ballot is missing or incomplete.
 */
export function coachBallotOrdinals(
  players: Player[],
  ballot: CoachBallot | undefined,
): Map<string, number> {
  const activeIds = activePlayers(players).map((p) => p.id);
  const result = new Map<string, number>();
  if (!ballot || !isCompleteBallot(ballot, activeIds)) return result;
  for (const id of activeIds) {
    result.set(id, ballot.ranks[id]);
  }
  return result;
}

/** Re-rank one complete coach ballot from 1…N inside a player pool. */
export function coachPoolBallotOrdinals(
  players: Player[],
  ballot: CoachBallot | undefined,
  pool: PlayerRankingPool,
): Map<string, number> {
  const global = coachBallotOrdinals(players, ballot);
  if (global.size === 0) return global;
  const pooled = activePlayers(players)
    .filter((player) => rankingPoolForPlayer(player) === pool)
    .sort((a, b) => global.get(a.id)! - global.get(b.id)!);
  return new Map(pooled.map((player, index) => [player.id, index + 1]));
}

/** Filter Coaches Rank to one pool and competition-rank coach averages locally. */
export function coachesRankingsForPool(
  rankings: PlayerRanking[],
  pool: PlayerRankingPool,
): PlayerRanking[] {
  const pooled = rankings.filter(
    (ranking) => rankingPoolForPlayer(ranking.player) === pool,
  );
  const values = pooled.map((ranking) => ranking.coachesTotalSum);
  const scoredValues = values.map((value) =>
    value == null ? Number.POSITIVE_INFINITY : value,
  );
  const localRanks = assignCompetitionRanks(scoredValues, false);
  return pooled.map((ranking, index) => ({
    ...ranking,
    coachesRank:
      ranking.coachesTotalSum == null ? null : localRanks[index],
  }));
}

/** Merge coaches averages onto rankings (inactive / no ballots → null). */
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
