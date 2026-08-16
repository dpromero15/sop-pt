import type {
  ComplianceRequirement,
  PlayerComplianceState,
  PlayerRanking,
} from '../types';
import { assignCompetitionRanks } from './scoring';

/** Eligibility / disciplinary: checking the box raises a flag (out of compliance). */
export function isFlagRequirement(
  req: Pick<ComplianceRequirement, 'kind'>,
): boolean {
  return req.kind === 'eligibility' || req.kind === 'disciplinary';
}

/** Checkbox checked state: flag kinds invert stored `complete`. */
export function isRequirementChecked(
  req: Pick<ComplianceRequirement, 'kind'>,
  complete: boolean,
): boolean {
  return isFlagRequirement(req) ? !complete : complete;
}

/** Map a checkbox toggle back to stored `complete`. */
export function completeFromChecked(
  req: Pick<ComplianceRequirement, 'kind'>,
  checked: boolean,
): boolean {
  return isFlagRequirement(req) ? !checked : checked;
}

/**
 * Whether this item is in compliance for the player.
 * Paperwork / fees: missing counts as incomplete.
 * Flag kinds (eligibility / disciplinary): missing counts as cleared
 * (not flagged) — only an explicit `complete: false` raises the flag.
 */
export function isRequirementComplete(
  state: PlayerComplianceState,
  playerId: string,
  req: Pick<ComplianceRequirement, 'id'> &
    Partial<Pick<ComplianceRequirement, 'kind'>>,
): boolean {
  const stored = state[playerId]?.[req.id]?.complete;
  if (req.kind && isFlagRequirement({ kind: req.kind })) {
    return stored !== false;
  }
  return stored === true;
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
  return blocking.every((r) => isRequirementComplete(state, playerId, r));
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
  return blocking.every((r) => isRequirementComplete(state, playerId, r));
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
    .filter(
      (r) => r.blocksPlay || r.blocksPractice || r.blocksEquipment === true,
    )
    .filter((r) => !isRequirementComplete(state, playerId, r))
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
    .filter((r) => !isRequirementComplete(state, playerId, r))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Any requirements still incomplete for a player (blocking and soft). */
export function missingRequirements(
  playerId: string,
  requirements: ComplianceRequirement[],
  state: PlayerComplianceState,
): ComplianceRequirement[] {
  return requirements
    .filter((r) => !isRequirementComplete(state, playerId, r))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** True unless the coach manually marked the player ineligible for Adjusted Rank. */
export function isRankingEligible(player: {
  rankingIneligible?: boolean;
}): boolean {
  return player.rankingIneligible !== true;
}

/**
 * Mark eligibility and re-assign Adjusted competition ranks among eligible
 * players only. Ineligible rows get adjustedRank null (scores unchanged).
 * Uses the coach's manual `rankingIneligible` flag — not compliance.
 */
export function applyEligibilityToAdjustedRanks(
  rankings: PlayerRanking[],
): PlayerRanking[] {
  const tagged = rankings.map((r) => ({
    ...r,
    eligibleToPlay: isRankingEligible(r.player),
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

export { specialtyAdjustedRankings } from './positionRankings';
