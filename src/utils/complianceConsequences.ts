import type { ComplianceRequirement, PlayerComplianceState } from '../types';
import { isFlagRequirement, isRequirementComplete } from './eligibility';

export type ComplianceConsequence = 'ineligible' | 'noPlay' | 'noPractice' | 'noEquipment';

export const CONSEQUENCE_LABEL: Record<ComplianceConsequence, string> = {
  ineligible: 'Ineligible',
  noPlay: 'No play',
  noPractice: 'No practice',
  noEquipment: 'No equipment',
};

export const CONSEQUENCE_BADGE_CLASS: Record<ComplianceConsequence, string> = {
  ineligible:
    'bg-rose-500/15 text-rose-300 border-rose-500/30',
  noPlay: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  noPractice: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  noEquipment: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

/** Recommended CRHS / CHSSAA checklist. Apply from the Compliance manager. */
export const RECOMMENDED_COMPLIANCE_REQUIREMENTS: ComplianceRequirement[] = [
  {
    id: 'req_sports_physical',
    name: 'Physical',
    kind: 'paperwork',
    blocksPlay: false,
    blocksPractice: true,
    blocksEquipment: false,
    description: 'Current sports physical on file. Incomplete = no practice.',
    sortOrder: 1,
  },
  {
    id: 'req_grade_check',
    name: 'Grade Check',
    kind: 'eligibility',
    blocksPlay: true,
    blocksPractice: false,
    blocksEquipment: false,
    description: 'Check to flag failing grades (ineligible). Uncheck when cleared.',
    sortOrder: 2,
  },
  {
    id: 'req_crhs_policy',
    name: 'CRHS Policy',
    kind: 'paperwork',
    blocksPlay: true,
    blocksPractice: false,
    blocksEquipment: false,
    description: 'CRHS athletic policy acknowledged. Incomplete = no play.',
    sortOrder: 3,
  },
  {
    id: 'req_chssaa_policy',
    name: 'CHSSAA Policy',
    kind: 'paperwork',
    blocksPlay: true,
    blocksPractice: false,
    blocksEquipment: false,
    description: 'CHSSAA participation policy on file. Incomplete = no play.',
    sortOrder: 4,
  },
  {
    id: 'req_season_fee',
    name: 'Team fee',
    kind: 'fee',
    blocksPlay: true,
    blocksPractice: false,
    blocksEquipment: true,
    description: 'Team fee paid. Incomplete = no equipment and no play.',
    sortOrder: 5,
  },
];

export function requirementBlocksEquipment(
  req: Pick<ComplianceRequirement, 'blocksEquipment'>,
): boolean {
  return req.blocksEquipment === true;
}

/** Coach-facing effects when this item is incomplete / flagged. */
export function consequenceKeysForRequirement(
  req: ComplianceRequirement,
): ComplianceConsequence[] {
  const keys: ComplianceConsequence[] = [];
  if (req.blocksPlay && req.kind === 'eligibility') {
    keys.push('ineligible');
  } else if (req.blocksPlay) {
    keys.push('noPlay');
  }
  if (req.blocksPractice) keys.push('noPractice');
  if (requirementBlocksEquipment(req)) keys.push('noEquipment');
  return keys;
}

export function consequenceLabelsForRequirement(
  req: ComplianceRequirement,
): string[] {
  return consequenceKeysForRequirement(req).map((k) => CONSEQUENCE_LABEL[k]);
}

export function polarityHint(req: Pick<ComplianceRequirement, 'kind'>): string {
  return isFlagRequirement(req)
    ? 'Check to flag (out of compliance). Uncheck when cleared.'
    : 'Check when complete.';
}

export function isEligibleForEquipment(
  playerId: string,
  requirements: ComplianceRequirement[],
  state: PlayerComplianceState,
): boolean {
  const blocking = requirements.filter(requirementBlocksEquipment);
  if (blocking.length === 0) return true;
  return blocking.every((r) => isRequirementComplete(state, playerId, r));
}

export function playerConsequenceBadges(
  playerId: string,
  requirements: ComplianceRequirement[],
  state: PlayerComplianceState,
): ComplianceConsequence[] {
  const seen = new Set<ComplianceConsequence>();
  for (const req of requirements) {
    if (isRequirementComplete(state, playerId, req)) continue;
    for (const key of consequenceKeysForRequirement(req)) {
      seen.add(key);
    }
  }
  const order: ComplianceConsequence[] = [
    'ineligible',
    'noPlay',
    'noPractice',
    'noEquipment',
  ];
  return order.filter((k) => seen.has(k));
}

/** Upsert recommended items by id; keep extra custom rows (e.g. red-card). */
export function mergeRecommendedCompliance(
  existing: ComplianceRequirement[],
): ComplianceRequirement[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const next = existing.map((r) => {
    const rec = RECOMMENDED_COMPLIANCE_REQUIREMENTS.find((x) => x.id === r.id);
    if (!rec) return r;
    return {
      ...r,
      name: rec.name,
      kind: rec.kind,
      blocksPlay: rec.blocksPlay,
      blocksPractice: rec.blocksPractice,
      blocksEquipment: rec.blocksEquipment,
      description: rec.description,
    };
  });
  let maxOrder = next.reduce((m, r) => Math.max(m, r.sortOrder), 0);
  for (const rec of RECOMMENDED_COMPLIANCE_REQUIREMENTS) {
    if (byId.has(rec.id)) continue;
    maxOrder += 1;
    next.push({ ...rec, sortOrder: maxOrder });
  }
  return next;
}
