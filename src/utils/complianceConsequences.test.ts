import { describe, expect, it } from 'vitest';
import type { ComplianceRequirement } from '../types';
import {
  RECOMMENDED_COMPLIANCE_REQUIREMENTS,
  consequenceKeysForRequirement,
  isEligibleForEquipment,
  mergeRecommendedCompliance,
  playerConsequenceBadges,
  polarityHint,
} from './complianceConsequences';
import {
  completeFromChecked,
  isRequirementChecked,
} from './eligibility';

const physical = RECOMMENDED_COMPLIANCE_REQUIREMENTS.find(
  (r) => r.id === 'req_sports_physical',
)!;
const gradeCheck = RECOMMENDED_COMPLIANCE_REQUIREMENTS.find(
  (r) => r.id === 'req_grade_check',
)!;
const crhs = RECOMMENDED_COMPLIANCE_REQUIREMENTS.find(
  (r) => r.id === 'req_crhs_policy',
)!;
const fee = RECOMMENDED_COMPLIANCE_REQUIREMENTS.find(
  (r) => r.id === 'req_season_fee',
)!;

describe('recommended CRHS consequences', () => {
  it('maps Physical to No practice only', () => {
    expect(consequenceKeysForRequirement(physical)).toEqual(['noPractice']);
  });

  it('maps Grade Check to Ineligible (eligibility flag)', () => {
    expect(gradeCheck.kind).toBe('eligibility');
    expect(consequenceKeysForRequirement(gradeCheck)).toEqual(['ineligible']);
  });

  it('maps CRHS / CHSSAA policy to No play', () => {
    expect(consequenceKeysForRequirement(crhs)).toEqual(['noPlay']);
    const chssaa = RECOMMENDED_COMPLIANCE_REQUIREMENTS.find(
      (r) => r.id === 'req_chssaa_policy',
    )!;
    expect(consequenceKeysForRequirement(chssaa)).toEqual(['noPlay']);
  });

  it('maps Team fee to No play and No equipment', () => {
    expect(consequenceKeysForRequirement(fee)).toEqual([
      'noPlay',
      'noEquipment',
    ]);
  });
});

describe('Grade Check polarity', () => {
  it('checks the box when incomplete (flag raised)', () => {
    expect(isRequirementChecked(gradeCheck, false)).toBe(true);
    expect(isRequirementChecked(gradeCheck, true)).toBe(false);
    expect(completeFromChecked(gradeCheck, true)).toBe(false);
    expect(completeFromChecked(gradeCheck, false)).toBe(true);
    expect(polarityHint(gradeCheck)).toMatch(/flag/i);
  });
});

describe('playerConsequenceBadges', () => {
  const reqs = [physical, gradeCheck, crhs, fee];

  it('aggregates distinct badges for incomplete items', () => {
    expect(playerConsequenceBadges('p1', reqs, {})).toEqual([
      'noPlay',
      'noPractice',
      'noEquipment',
    ]);
  });

  it('adds Ineligible only when Grade Check is explicitly flagged', () => {
    expect(
      playerConsequenceBadges('p1', reqs, {
        p1: { req_grade_check: { complete: false } },
      }),
    ).toEqual(['ineligible', 'noPlay', 'noPractice', 'noEquipment']);
  });

  it('omits badges once those items are complete / cleared', () => {
    expect(
      playerConsequenceBadges('p1', reqs, {
        p1: {
          req_sports_physical: { complete: true, completedAt: '2026-01-01' },
          req_grade_check: { complete: true, completedAt: '2026-01-01' },
          req_crhs_policy: { complete: true, completedAt: '2026-01-01' },
          req_season_fee: { complete: true, completedAt: '2026-01-01' },
        },
      }),
    ).toEqual([]);
  });
});

describe('isEligibleForEquipment', () => {
  it('is false when a No equipment item is incomplete', () => {
    expect(isEligibleForEquipment('p1', [fee], {})).toBe(false);
  });

  it('is true when fee is paid', () => {
    expect(
      isEligibleForEquipment('p1', [fee], {
        p1: { req_season_fee: { complete: true, completedAt: '2026-01-01' } },
      }),
    ).toBe(true);
  });
});

describe('mergeRecommendedCompliance', () => {
  it('updates known ids and keeps custom rows', () => {
    const existing: ComplianceRequirement[] = [
      {
        id: 'req_sports_physical',
        name: 'Sports Physical',
        kind: 'paperwork',
        blocksPlay: true,
        blocksPractice: true,
        blocksEquipment: false,
        sortOrder: 1,
      },
      {
        id: 'req_red_card_sitout',
        name: 'Red card sit-out',
        kind: 'disciplinary',
        blocksPlay: true,
        blocksPractice: false,
        sortOrder: 2,
      },
    ];
    const next = mergeRecommendedCompliance(existing);
    expect(next.find((r) => r.id === 'req_sports_physical')).toMatchObject({
      name: 'Physical',
      blocksPlay: false,
      blocksPractice: true,
    });
    expect(next.find((r) => r.id === 'req_grade_check')?.kind).toBe(
      'eligibility',
    );
    expect(next.some((r) => r.id === 'req_red_card_sitout')).toBe(true);
  });
});
