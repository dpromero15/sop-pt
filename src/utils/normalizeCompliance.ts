import type { ComplianceRequirement, RequirementKind } from '../types';

const KNOWN_KINDS = new Set<RequirementKind>([
  'paperwork',
  'fee',
  'eligibility',
  'disciplinary',
  'other',
]);

/** Backfill fields added after the first compliance ship. */
export function normalizeComplianceRequirement(
  raw: ComplianceRequirement,
): ComplianceRequirement {
  const kind = KNOWN_KINDS.has(raw.kind) ? raw.kind : 'other';
  return {
    ...raw,
    kind,
    blocksPlay: raw.blocksPlay === true,
    blocksPractice: raw.blocksPractice === true,
  };
}

export function normalizeComplianceRequirements(
  list: ComplianceRequirement[],
): ComplianceRequirement[] {
  return list.map(normalizeComplianceRequirement);
}
