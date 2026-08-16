import type { PlayerPosition, PlayerRankingPool } from '../types';
import { defaultRankingPoolForPositionCode } from './playerPositions';

export const PLAYER_RANKING_POOLS: Array<{
  id: PlayerRankingPool;
  label: string;
  primaryCut: number;
  secondaryCut: number;
}> = [
  { id: 'wingbacks', label: 'Wingbacks', primaryCut: 2, secondaryCut: 3 },
  {
    id: 'center-defense',
    label: 'Center Defense',
    primaryCut: 2,
    secondaryCut: 3,
  },
  {
    id: 'central-midfield',
    label: 'Central Midfield',
    primaryCut: 2,
    secondaryCut: 3,
  },
  { id: 'forwards', label: 'Forwards', primaryCut: 2, secondaryCut: 6 },
  { id: 'goalkeepers', label: 'Goalkeepers', primaryCut: 1, secondaryCut: 1 },
];

export const PLAYER_RANKING_POOL_IDS = PLAYER_RANKING_POOLS.map((pool) => pool.id);

export const DEFAULT_POOL_CUTS = Object.fromEntries(
  PLAYER_RANKING_POOLS.map((pool) => [
    pool.id,
    { primaryCut: pool.primaryCut, secondaryCut: pool.secondaryCut },
  ]),
) as Record<PlayerRankingPool, { primaryCut: number; secondaryCut: number }>;

const POOL_ID_SET = new Set<string>(PLAYER_RANKING_POOL_IDS);
const POOL_LABELS = Object.fromEntries(
  PLAYER_RANKING_POOLS.map((pool) => [pool.id, pool.label]),
) as Record<PlayerRankingPool, string>;

const DEFAULT_POOL_BY_POSITION: Record<string, PlayerRankingPool> = {
  GK: 'goalkeepers',
  RB: 'wingbacks',
  RWB: 'wingbacks',
  LB: 'wingbacks',
  LWB: 'wingbacks',
  WB: 'wingbacks',
  CB: 'center-defense',
  RCB: 'center-defense',
  LCB: 'center-defense',
  CDM: 'center-defense',
  CM: 'central-midfield',
  CAM: 'central-midfield',
  ST: 'central-midfield',
  SS: 'central-midfield',
  CF: 'central-midfield',
  F9: 'central-midfield',
  RM: 'forwards',
  LM: 'forwards',
  RW: 'forwards',
  LW: 'forwards',
};

export function isPlayerRankingPool(value: unknown): value is PlayerRankingPool {
  return typeof value === 'string' && POOL_ID_SET.has(value);
}

export function defaultRankingPoolForPosition(
  position: PlayerPosition,
): PlayerRankingPool {
  return defaultRankingPoolForPositionCode(position);
}

export function rankingPoolForPlayer(player: {
  position: PlayerPosition;
  rankingPool?: PlayerRankingPool;
}): PlayerRankingPool {
  return isPlayerRankingPool(player.rankingPool)
    ? player.rankingPool
    : defaultRankingPoolForPosition(player.position);
}

export function formatPlayerRankingPool(pool: PlayerRankingPool): string {
  return POOL_LABELS[pool];
}

export function assignDefaultPlayerRankingPools(
  rows: Record<string, unknown>[],
): { rows: Record<string, unknown>[]; changed: boolean } {
  let changed = false;
  const next = rows.map((row) => {
    if (isPlayerRankingPool(row.rankingPool)) return row;
    const position = row.position;
    if (typeof position !== 'string') return row;
    const pool =
      DEFAULT_POOL_BY_POSITION[position] ??
      defaultRankingPoolForPositionCode(position);
    if (!pool) return row;
    changed = true;
    return {
      ...row,
      rankingPool: pool,
    };
  });
  return { rows: next, changed };
}
