import { describe, expect, it } from 'vitest';
import type { ComplianceRequirement, Player, PlayerRanking } from '../types';
import {
  applyEligibilityToAdjustedRanks,
  isEligibleToPlay,
  isEligibleToPractice,
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

describe('isEligibleToPlay', () => {
  it('is true when no blocking requirements', () => {
    expect(isEligibleToPlay('p1', [], {})).toBe(true);
    expect(isEligibleToPlay('p1', [reqs[1]], {})).toBe(true);
  });

  it('is false when a blocksPlay item is incomplete', () => {
    expect(isEligibleToPlay('p1', reqs, {})).toBe(false);
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
    expect(missing.map((r) => r.id)).toEqual(['req_physical', 'req_red_card']);
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
    expect(missing.map((r) => r.id)).toEqual([
      'req_physical',
      'req_fee',
      'req_red_card',
    ]);
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

describe('applyEligibilityToAdjustedRanks', () => {
  it('ranks only eligible players; ineligible get null adjustedRank', () => {
    const rankings = [
      stubRanking('a', 90),
      stubRanking('b', 80),
      stubRanking('c', 70),
    ];
    const next = applyEligibilityToAdjustedRanks(
      rankings,
      new Set(['a', 'c']),
    );
    expect(next.find((r) => r.player.id === 'a')?.adjustedRank).toBe(1);
    expect(next.find((r) => r.player.id === 'c')?.adjustedRank).toBe(2);
    expect(next.find((r) => r.player.id === 'b')?.adjustedRank).toBeNull();
    expect(next.find((r) => r.player.id === 'b')?.eligibleToPlay).toBe(false);
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
