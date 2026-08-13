import { describe, expect, it } from 'vitest';
import type { ComplianceRequirement, Player, PlayerRanking } from '../types';
import {
  applyEligibilityToAdjustedRanks,
  isRankingEligible,
  completeFromChecked,
  isEligibleToPlay,
  isEligibleToPractice,
  isFlagRequirement,
  isRequirementChecked,
  isRequirementComplete,
  missingBlockingRequirements,
  missingPracticeBlockingRequirements,
  missingRequirements,
  specialtyAdjustedRankings,
} from './eligibility';

const reqs: ComplianceRequirement[] = [
  {
    id: 'req_physical',
    name: 'Sports Physical',
    kind: 'paperwork',
    blocksPlay: true,
    blocksPractice: true,
    sortOrder: 1,
  },
  {
    id: 'req_fee',
    name: 'Season Fee',
    kind: 'fee',
    blocksPlay: false,
    blocksPractice: false,
    sortOrder: 2,
  },
  {
    id: 'req_red_card',
    name: 'Red card sit-out',
    kind: 'disciplinary',
    blocksPlay: true,
    blocksPractice: false,
    sortOrder: 3,
  },
];

function stubRanking(
  id: string,
  adjustedTotalScore: number | null,
  position: Player['position'] = 'ST',
): PlayerRanking {
  return {
    player: {
      id,
      name: id,
      jerseyNumber: 1,
      position,
      preferredFoot: 'Right',
      joinedDate: '2026-01-01',
      status: 'active',
    },
    totalScore: adjustedTotalScore,
    adjustedTotalScore,
    overallRank: 1,
    adjustedRank: 1,
    coachesTotalSum: null,
    coachesRank: null,
    adjustedBump: 0,
    eligibleToPlay: true,
    labelScores: {},
    rank: 1,
    attendanceRate: null,
    recentTrend: 'stable',
    calculatedValues: {},
  };
}

describe('isFlagRequirement', () => {
  it('is true for eligibility and disciplinary', () => {
    expect(isFlagRequirement({ kind: 'eligibility' })).toBe(true);
    expect(isFlagRequirement({ kind: 'disciplinary' })).toBe(true);
  });

  it('is false for paperwork, fee, and other', () => {
    expect(isFlagRequirement({ kind: 'paperwork' })).toBe(false);
    expect(isFlagRequirement({ kind: 'fee' })).toBe(false);
    expect(isFlagRequirement({ kind: 'other' })).toBe(false);
  });
});

describe('isRequirementComplete', () => {
  const grade: ComplianceRequirement = {
    id: 'req_grade_check',
    name: 'Grade Check',
    kind: 'eligibility',
    blocksPlay: true,
    blocksPractice: false,
    sortOrder: 1,
  };
  const physical = reqs[0];

  it('treats missing paperwork as incomplete and missing flags as cleared', () => {
    expect(isRequirementComplete({}, 'p1', physical)).toBe(false);
    expect(isRequirementComplete({}, 'p1', grade)).toBe(true);
  });

  it('raises a flag only when complete is explicitly false', () => {
    expect(
      isRequirementComplete(
        { p1: { req_grade_check: { complete: false } } },
        'p1',
        grade,
      ),
    ).toBe(false);
    expect(
      isRequirementComplete(
        { p1: { req_grade_check: { complete: true } } },
        'p1',
        grade,
      ),
    ).toBe(true);
  });
});

describe('flag checkbox mapping', () => {
  it('shows paperwork checked when complete', () => {
    expect(isRequirementChecked({ kind: 'paperwork' }, true)).toBe(true);
    expect(isRequirementChecked({ kind: 'paperwork' }, false)).toBe(false);
    expect(completeFromChecked({ kind: 'paperwork' }, true)).toBe(true);
    expect(completeFromChecked({ kind: 'paperwork' }, false)).toBe(false);
  });

  it('shows disciplinary/eligibility checked when incomplete (flag raised)', () => {
    expect(isRequirementChecked({ kind: 'disciplinary' }, true)).toBe(false);
    expect(isRequirementChecked({ kind: 'disciplinary' }, false)).toBe(true);
    expect(isRequirementChecked({ kind: 'eligibility' }, false)).toBe(true);
    expect(completeFromChecked({ kind: 'disciplinary' }, true)).toBe(false);
    expect(completeFromChecked({ kind: 'disciplinary' }, false)).toBe(true);
  });
});

describe('isEligibleToPlay', () => {
  it('is true when no blocking requirements', () => {
    expect(isEligibleToPlay('p1', [], {})).toBe(true);
    expect(isEligibleToPlay('p1', [reqs[1]], {})).toBe(true);
  });

  it('is false when a blocksPlay item is incomplete', () => {
    expect(isEligibleToPlay('p1', reqs, {})).toBe(false);
  });

  it('treats untouched Grade Check / disciplinary flags as cleared', () => {
    const flags: ComplianceRequirement[] = [
      {
        id: 'req_grade_check',
        name: 'Grade Check',
        kind: 'eligibility',
        blocksPlay: true,
        blocksPractice: false,
        sortOrder: 1,
      },
      {
        id: 'req_red_card',
        name: 'Red card sit-out',
        kind: 'disciplinary',
        blocksPlay: true,
        blocksPractice: false,
        sortOrder: 2,
      },
    ];
    expect(isEligibleToPlay('p1', flags, {})).toBe(true);
    expect(
      isEligibleToPlay('p1', flags, {
        p1: { req_grade_check: { complete: false } },
      }),
    ).toBe(false);
  });

  it('is true when all blocksPlay items are complete', () => {
    expect(
      isEligibleToPlay('p1', reqs, {
        p1: {
          req_physical: { complete: true, completedAt: '2026-01-01' },
          req_red_card: { complete: true, completedAt: '2026-01-01' },
        },
      }),
    ).toBe(true);
  });
});

describe('isEligibleToPractice', () => {
  it('is true when no practice-blocking requirements', () => {
    expect(isEligibleToPractice('p1', [], {})).toBe(true);
    expect(isEligibleToPractice('p1', [reqs[1], reqs[2]], {})).toBe(true);
  });

  it('is false when a blocksPractice item is incomplete', () => {
    expect(isEligibleToPractice('p1', reqs, {})).toBe(false);
  });

  it('is true when all blocksPractice items are complete', () => {
    expect(
      isEligibleToPractice('p1', reqs, {
        p1: { req_physical: { complete: true, completedAt: '2026-01-01' } },
      }),
    ).toBe(true);
  });
});

describe('missingBlockingRequirements', () => {
  it('lists incomplete play or practice blockers', () => {
    const missing = missingBlockingRequirements('p1', reqs, {});
    expect(missing.map((r) => r.id)).toEqual(['req_physical']);
  });

  it('includes equipment-only blockers', () => {
    const kit: ComplianceRequirement = {
      id: 'req_kit',
      name: 'Kit deposit',
      kind: 'fee',
      blocksPlay: false,
      blocksPractice: false,
      blocksEquipment: true,
      sortOrder: 4,
    };
    const missing = missingBlockingRequirements('p1', [kit], {});
    expect(missing.map((r) => r.id)).toEqual(['req_kit']);
  });
});

describe('missingPracticeBlockingRequirements', () => {
  it('lists incomplete practice blockers only', () => {
    const missing = missingPracticeBlockingRequirements('p1', reqs, {});
    expect(missing.map((r) => r.id)).toEqual(['req_physical']);
  });
});

describe('missingRequirements', () => {
  it('lists all incomplete items including soft', () => {
    const missing = missingRequirements('p1', reqs, {});
    expect(missing.map((r) => r.id)).toEqual(['req_physical', 'req_fee']);
  });

  it('omits completed items', () => {
    const missing = missingRequirements('p1', reqs, {
      p1: {
        req_physical: { complete: true, completedAt: '2026-01-01' },
        req_fee: { complete: true, completedAt: '2026-01-01' },
        req_red_card: { complete: true, completedAt: '2026-01-01' },
      },
    });
    expect(missing).toEqual([]);
  });
});

describe('isRankingEligible', () => {
  it('is true unless rankingIneligible is explicitly set', () => {
    expect(isRankingEligible({})).toBe(true);
    expect(isRankingEligible({ rankingIneligible: false })).toBe(true);
    expect(isRankingEligible({ rankingIneligible: true })).toBe(false);
  });
});

describe('applyEligibilityToAdjustedRanks', () => {
  it('ranks only eligible players; ineligible get null adjustedRank', () => {
    const rankings = [
      stubRanking('a', 90),
      stubRanking('b', 80),
      stubRanking('c', 70),
    ];
    rankings[1] = {
      ...rankings[1],
      player: { ...rankings[1].player, rankingIneligible: true },
    };
    const next = applyEligibilityToAdjustedRanks(rankings);
    expect(next.find((r) => r.player.id === 'a')?.adjustedRank).toBe(1);
    expect(next.find((r) => r.player.id === 'c')?.adjustedRank).toBe(2);
    expect(next.find((r) => r.player.id === 'b')?.adjustedRank).toBeNull();
    expect(next.find((r) => r.player.id === 'b')?.eligibleToPlay).toBe(false);
  });

  it('does not drop players for incomplete compliance', () => {
    const rankings = [stubRanking('a', 90), stubRanking('b', 80)];
    const next = applyEligibilityToAdjustedRanks(rankings);
    expect(next.every((r) => r.eligibleToPlay)).toBe(true);
    expect(next.find((r) => r.player.id === 'a')?.adjustedRank).toBe(1);
    expect(next.find((r) => r.player.id === 'b')?.adjustedRank).toBe(2);
  });
});

describe('specialtyAdjustedRankings', () => {
  it('re-ranks within a position pool', () => {
    const rankings = [
      { ...stubRanking('g1', 50, 'GK'), eligibleToPlay: true },
      { ...stubRanking('g2', 90, 'GK'), eligibleToPlay: true },
      { ...stubRanking('s1', 99, 'ST'), eligibleToPlay: true },
    ];
    const gk = specialtyAdjustedRankings(rankings, 'GK');
    expect(gk).toHaveLength(2);
    expect(gk.find((r) => r.player.id === 'g2')?.adjustedRank).toBe(1);
    expect(gk.find((r) => r.player.id === 'g1')?.adjustedRank).toBe(2);
  });
});
