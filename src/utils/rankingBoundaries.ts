import type {
  PlayerPosition,
  PlayerRankingPool,
  RankingBoundariesConfig,
  RankingCutPair,
} from '../types';
import { DEFAULT_POOL_CUTS, PLAYER_RANKING_POOLS } from './playerRankingPools';

function normalizeCut(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function normalizePair(
  pair: Partial<RankingCutPair> | undefined,
  fallbacks: RankingCutPair,
): RankingCutPair {
  return {
    primaryCut: normalizeCut(pair?.primaryCut, fallbacks.primaryCut),
    secondaryCut: normalizeCut(pair?.secondaryCut, fallbacks.secondaryCut),
  };
}

function normalizePairMap(
  map: Record<string, Partial<RankingCutPair>> | undefined,
  fallbacks: RankingCutPair,
): Record<string, RankingCutPair> {
  if (!map || typeof map !== 'object') return {};
  const out: Record<string, RankingCutPair> = {};
  for (const [key, pair] of Object.entries(map)) {
    if (!key.trim()) continue;
    out[key] = normalizePair(pair, fallbacks);
  }
  return out;
}

/** Normalize stored / remote ranking boundaries (fills missing maps). */
export function normalizeRankingBoundaries(
  raw: Partial<RankingBoundariesConfig> | null | undefined,
): RankingBoundariesConfig {
  const primaryCut = normalizeCut(raw?.primaryCut, 18);
  const secondaryCut = normalizeCut(raw?.secondaryCut, 36);
  const fallbacks = { primaryCut, secondaryCut };
  const storedPoolCuts = raw?.poolCuts ?? {};
  return {
    primaryCut,
    secondaryCut,
    specialtyCuts: { GK: 4, ...(raw?.specialtyCuts ?? {}) },
    categoryCuts: normalizePairMap(raw?.categoryCuts, fallbacks),
    metricCuts: normalizePairMap(raw?.metricCuts, fallbacks),
    poolCuts: Object.fromEntries(
      PLAYER_RANKING_POOLS.map((pool) => [
        pool.id,
        normalizePair(storedPoolCuts[pool.id], DEFAULT_POOL_CUTS[pool.id]),
      ]),
    ),
  };
}

export type ResolveCutLinesArgs = {
  boundaries: RankingBoundariesConfig;
  specialtyPosition?: PlayerPosition | null;
  /** Category label id when filtering rankings (omit / empty / 'all' = overall). */
  selectedLabelId?: string | null;
  /** Metric or calculated-field id when ranking by one measure. */
  selectedMetricId?: string | null;
  /** Player pool when viewing Coaches Rank by roster role. */
  selectedRankingPool?: PlayerRankingPool | null;
  /** Overall cuts only apply on Adjusted (non-specialty) lists. */
  totalMode?: string;
};

/**
 * Resolve active cut places for the current rankings scope.
 * Priority: specialty → metric override → category override → global Adjusted.
 */
export function resolveActiveCutLines({
  boundaries,
  specialtyPosition,
  selectedLabelId,
  selectedMetricId,
  selectedRankingPool,
  totalMode = 'adjusted',
}: ResolveCutLinesArgs): number[] {
  const b = normalizeRankingBoundaries(boundaries);

  if (totalMode === 'coaches' && selectedRankingPool) {
    const pair = b.poolCuts?.[selectedRankingPool];
    return pair
      ? [pair.primaryCut, pair.secondaryCut].sort((a, c) => a - c)
      : [];
  }

  if (specialtyPosition) {
    const cut =
      b.specialtyCuts[specialtyPosition] ??
      (specialtyPosition === 'GK' ? 4 : null);
    return cut != null ? [cut] : [];
  }

  const metricId = selectedMetricId?.trim() || '';
  if (metricId && b.metricCuts[metricId]) {
    const pair = b.metricCuts[metricId];
    return [pair.primaryCut, pair.secondaryCut].sort((a, c) => a - c);
  }

  const labelId = selectedLabelId?.trim() || '';
  if (labelId && labelId !== 'all' && b.categoryCuts[labelId]) {
    const pair = b.categoryCuts[labelId];
    return [pair.primaryCut, pair.secondaryCut].sort((a, c) => a - c);
  }

  if (totalMode !== 'adjusted') return [];
  return [b.primaryCut, b.secondaryCut].sort((a, c) => a - c);
}

/**
 * Cut places for a print sheet. Always includes a pair: metric override,
 * else category override, else global 18 / 36 (including Statistical and Coaches).
 */
export function resolvePrintCutLines(args: ResolveCutLinesArgs): number[] {
  const scoped = resolveActiveCutLines(args);
  if (scoped.length > 0) return scoped;
  const b = normalizeRankingBoundaries(args.boundaries);
  return [b.primaryCut, b.secondaryCut].sort((a, c) => a - c);
}
