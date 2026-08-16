import type { Player, PlayerRanking, PositionDefinition } from '../types';
import { assignCompetitionRanks } from './scoring';
import { playerHasPosition } from './playerPositions';
import { activePlayers } from './playerStatus';

export const POSITION_OVERVIEW_SCOPE = 'overview';

export function isPositionOverview(scope: string | null): boolean {
  return scope === POSITION_OVERVIEW_SCOPE;
}

export function catalogPositionsWithPlayers(
  catalog: PositionDefinition[],
  players: Player[],
): PositionDefinition[] {
  const roster = activePlayers(players);
  return catalog.filter((position) =>
    roster.some((player) => playerHasPosition(player, position.code)),
  );
}

function playersAtPosition(
  rankings: PlayerRanking[],
  position: string,
): PlayerRanking[] {
  return rankings.filter((ranking) =>
    playerHasPosition(ranking.player, position),
  );
}

/** Re-rank Statistical standing among players assigned to a position. */
export function specialtyStatisticalRankings(
  rankings: PlayerRanking[],
  position: string,
): PlayerRanking[] {
  const pool = playersAtPosition(rankings, position);
  const ranks = assignCompetitionRanks(
    pool.map((ranking) => ranking.totalScore),
    true,
  );
  return pool.map((ranking, index) => ({
    ...ranking,
    overallRank: ranks[index],
  }));
}

/**
 * Specialty view: filter by assigned positions (not only primary), re-rank
 * Adjusted places among eligible in that pool.
 */
export function specialtyAdjustedRankings(
  rankings: PlayerRanking[],
  position: string,
): PlayerRanking[] {
  const pool = playersAtPosition(rankings, position);
  const effectiveScores = pool.map((r) => {
    if (!r.eligibleToPlay) return null;
    if (r.adjustedTotalScore === null) return null;
    return r.adjustedTotalScore + (r.adjustedBump ?? 0);
  });
  const ranks = assignCompetitionRanks(effectiveScores, true);
  return pool.map((r, i) => ({
    ...r,
    adjustedRank: ranks[i],
  }));
}
