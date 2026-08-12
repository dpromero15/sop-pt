import type {
  ComplianceRequirement,
  PlayerComplianceState,
  PlayerRanking,
} from '../types';
import { assignCompetitionRanks } from './scoring';

/** Missing completion counts as incomplete. */
export function isRequirementComplete(
  state: PlayerComplianceState,
  playerId: string,
  requirementId: string,
): boolean {
  return state[playerId]?.[requirementId]?.complete === true;
}

/**
 * Eligible to play when every requirement with blocksPlay is complete.
 * No blocking requirements ⇒ everyone eligible.
 */
export function isEligibleToPlay(
  playerId: string,
  requirements: ComplianceRequirement[],
  state: PlayerComplianceState,
): boolean {
  const blocking = requirements.filter((r) => r.blocksPlay);
  if (blocking.length === 0) return true;
  return blocking.every((r) => isRequirementComplete(state, playerId, r.id));
}

/**
 * Eligible for practice when every requirement with blocksPractice is complete.
 * No practice-blocking requirements ⇒ everyone eligible.
 */
export function isEligibleToPractice(
  playerId: string,
  requirements: ComplianceRequirement[],
  state: PlayerComplianceState,
): boolean {
  const blocking = requirements.filter((r) => r.blocksPractice);
  if (blocking.length === 0) return true;
  return blocking.every((r) => isRequirementComplete(state, playerId, r.id));
}

export function eligiblePlayerIdSet(
  playerIds: string[],
  requirements: ComplianceRequirement[],
  state: PlayerComplianceState,
): Set<string> {
  return new Set(
    playerIds.filter((id) => isEligibleToPlay(id, requirements, state)),
  );
}

/** Play- or practice-blocking requirements that are still incomplete. */
export function missingBlockingRequirements(
  playerId: string,
  requirements: ComplianceRequirement[],
  state: PlayerComplianceState,
): ComplianceRequirement[] {
  return requirements
    .filter((r) => r.blocksPlay || r.blocksPractice)
    .filter((r) => !isRequirementComplete(state, playerId, r.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Practice-blocking requirements that are still incomplete for a player. */
export function missingPracticeBlockingRequirements(
  playerId: string,
  requirements: ComplianceRequirement[],
  state: PlayerComplianceState,
): ComplianceRequirement[] {
  return requirements
    .filter((r) => r.blocksPractice)
    .filter((r) => !isRequirementComplete(state, playerId, r.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Any requirements still incomplete for a player (blocking and soft). */
export function missingRequirements(
  playerId: string,
  requirements: ComplianceRequirement[],
  state: PlayerComplianceState,
): ComplianceRequirement[] {
  return requirements
    .filter((r) => !isRequirementComplete(state, playerId, r.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Mark eligibility and re-assign Adjusted competition ranks among eligible
 * players only. Ineligible rows get adjustedRank null (scores unchanged).
 */
export function applyEligibilityToAdjustedRanks(
  rankings: PlayerRanking[],
  eligibleIds: Set<string>,
): PlayerRanking[] {
  const tagged = rankings.map((r) => ({
    ...r,
    eligibleToPlay: eligibleIds.has(r.player.id),
  }));

  const effectiveScores = tagged.map((r) => {
    if (!r.eligibleToPlay) return null;
    if (r.adjustedTotalScore === null) return null;
    return r.adjustedTotalScore + (r.adjustedBump ?? 0);
  });

  const adjustedRanks = assignCompetitionRanks(effectiveScores, true);
  return tagged.map((r, i) => ({
    ...r,
    adjustedRank: adjustedRanks[i],
  }));
}

/**
 * Specialty view: filter by position, re-rank Adjusted places among eligible
 * in that pool. Returns a new array (subset) with adjustedRank rewritten.
 */
export function specialtyAdjustedRankings(
  rankings: PlayerRanking[],
  position: string,
): PlayerRanking[] {
  const pool = rankings.filter((r) => r.player.position === position);
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
