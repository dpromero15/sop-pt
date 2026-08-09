import { describe, expect, it } from 'vitest';
import type { ComplianceRequirement, Player, PlayerRanking } from '../types';
import {
  applyEligibilityToAdjustedRanks,
  isEligibleToPlay,
  missingBlockingRequirements,
  specialtyAdjustedRankings,
} from './eligibility';

const reqs: ComplianceRequirement[] = [
  {
    id: 'req_physical',
    name: 'Sports Physical',
    kind: 'paperwork',
    blocksPlay: true,
    sortOrder: 1,
  },
  {
    id: 'req_fee',
    name: 'Season Fee',
    kind: 'fee',
    blocksPlay: false,
    sortOrder: 2,
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
    expect(
      isEligibleToPlay('p1', [reqs[1]], {}),
    ).toBe(true);
  });

  it('is false when a blocksPlay item is incomplete', () => {
    expect(isEligibleToPlay('p1', reqs, {})).toBe(false);
  });

  it('is true when all blocksPlay items are complete', () => {
    expect(
      isEligibleToPlay('p1', reqs, {
        p1: { req_physical: { complete: true, completedAt: '2026-01-01' } },
      }),
    ).toBe(true);
  });
});

describe('missingBlockingRequirements', () => {
  it('lists incomplete blocking items only', () => {
    const missing = missingBlockingRequirements('p1', reqs, {});
    expect(missing.map((r) => r.id)).toEqual(['req_physical']);
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
