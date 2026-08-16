import { describe, expect, it } from 'vitest';
import type { PlayerRanking, PositionDefinition } from '../types';
import {
  catalogPositionsWithPlayers,
  specialtyAdjustedRankings,
  specialtyStatisticalRankings,
} from './positionRankings';

function stubRanking(
  id: string,
  totalScore: number,
  position: string,
  extras: string[] = [],
): PlayerRanking {
  return {
    player: {
      id,
      name: id,
      jerseyNumber: 1,
      position,
      positions: extras.length ? extras : [position],
      preferredFoot: 'Right',
      joinedDate: '2026-01-01',
      status: 'active',
    },
    totalScore,
    adjustedTotalScore: totalScore,
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

const catalog: PositionDefinition[] = [
  {
    code: 'ST',
    name: 'ST',
    tacticalNumber: 9,
    line: 'fwd',
    rankingPool: 'forwards',
    sortOrder: 1,
  },
  {
    code: 'RW',
    name: 'RW',
    tacticalNumber: 7,
    line: 'fwd',
    rankingPool: 'forwards',
    sortOrder: 2,
  },
  {
    code: 'LCB',
    name: 'LCB',
    tacticalNumber: 5,
    line: 'def',
    rankingPool: 'center-defense',
    sortOrder: 3,
  },
];

describe('positionRankings', () => {
  it('lists catalog roles that have at least one assigned player', () => {
    const players = [
      stubRanking('a', 80, 'RW', ['RW', 'ST']).player,
      stubRanking('b', 70, 'LCB').player,
    ];
    expect(
      catalogPositionsWithPlayers(catalog, players).map((p) => p.code),
    ).toEqual(['ST', 'RW', 'LCB']);
  });

  it('re-ranks statistical standing among anyone assigned the role', () => {
    const rankings = [
      stubRanking('wing', 60, 'RW', ['RW', 'ST']),
      stubRanking('nine', 90, 'ST'),
      stubRanking('cb', 99, 'LCB'),
    ];
    const st = specialtyStatisticalRankings(rankings, 'ST');
    expect(st.map((r) => r.player.id)).toEqual(['wing', 'nine']);
    expect(st.find((r) => r.player.id === 'nine')?.overallRank).toBe(1);
    expect(st.find((r) => r.player.id === 'wing')?.overallRank).toBe(2);
  });

  it('re-ranks adjusted standing the same way', () => {
    const rankings = [
      stubRanking('wing', 60, 'RW', ['RW', 'ST']),
      stubRanking('nine', 90, 'ST'),
    ];
    const st = specialtyAdjustedRankings(rankings, 'ST');
    expect(st.find((r) => r.player.id === 'nine')?.adjustedRank).toBe(1);
    expect(st.find((r) => r.player.id === 'wing')?.adjustedRank).toBe(2);
  });
});
