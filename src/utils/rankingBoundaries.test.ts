import { describe, expect, it } from 'vitest';
import {
  normalizeRankingBoundaries,
  resolveActiveCutLines,
  resolvePrintCutLines,
} from './rankingBoundaries';
import type { RankingBoundariesConfig } from '../types';

const base: RankingBoundariesConfig = {
  primaryCut: 18,
  secondaryCut: 36,
  specialtyCuts: { GK: 4 },
  categoryCuts: {
    speed: { primaryCut: 8, secondaryCut: 16 },
  },
  metricCuts: {
    m_40m_dash: { primaryCut: 5, secondaryCut: 10 },
    cf_40m_avg: { primaryCut: 6, secondaryCut: 12 },
  },
};

describe('normalizeRankingBoundaries', () => {
  it('fills empty maps for legacy payloads', () => {
    const n = normalizeRankingBoundaries({
      primaryCut: 18,
      secondaryCut: 36,
      specialtyCuts: { GK: 4 },
    });
    expect(n.categoryCuts).toEqual({});
    expect(n.metricCuts).toEqual({});
    expect(n.poolCuts).toMatchObject({
      wingbacks: { primaryCut: 2, secondaryCut: 3 },
      'center-defense': { primaryCut: 2, secondaryCut: 3 },
      'central-midfield': { primaryCut: 2, secondaryCut: 3 },
      forwards: { primaryCut: 2, secondaryCut: 6 },
      goalkeepers: { primaryCut: 1, secondaryCut: 1 },
    });
  });
});

describe('resolveActiveCutLines', () => {
  it('uses specialty cut first', () => {
    expect(
      resolveActiveCutLines({
        boundaries: base,
        specialtyPosition: 'GK',
        selectedMetricId: 'm_40m_dash',
        selectedLabelId: 'speed',
      }),
    ).toEqual([4]);
  });

  it('prefers metric override over category and global', () => {
    expect(
      resolveActiveCutLines({
        boundaries: base,
        selectedLabelId: 'speed',
        selectedMetricId: 'm_40m_dash',
        totalMode: 'adjusted',
      }),
    ).toEqual([5, 10]);
  });

  it('uses category override when no metric override', () => {
    expect(
      resolveActiveCutLines({
        boundaries: base,
        selectedLabelId: 'speed',
        selectedMetricId: null,
        totalMode: 'formula',
      }),
    ).toEqual([8, 16]);
  });

  it('falls back to global adjusted cuts', () => {
    expect(
      resolveActiveCutLines({
        boundaries: base,
        selectedLabelId: 'all',
        totalMode: 'adjusted',
      }),
    ).toEqual([18, 36]);
  });

  it('hides global cuts outside adjusted mode', () => {
    expect(
      resolveActiveCutLines({
        boundaries: base,
        selectedLabelId: null,
        totalMode: 'formula',
      }),
    ).toEqual([]);
  });

  it('uses substitute and actual-cut lines for Coaches Rank by pool', () => {
    expect(
      resolveActiveCutLines({
        boundaries: base,
        selectedRankingPool: 'forwards',
        totalMode: 'coaches',
      }),
    ).toEqual([2, 6]);
  });
});

describe('resolvePrintCutLines', () => {
  it('uses metric cuts when present', () => {
    expect(
      resolvePrintCutLines({
        boundaries: base,
        selectedMetricId: 'm_40m_dash',
        totalMode: 'overall',
      }),
    ).toEqual([5, 10]);
  });

  it('falls back to global 18 / 36 for Statistical and Coaches', () => {
    expect(
      resolvePrintCutLines({
        boundaries: base,
        selectedLabelId: 'all',
        totalMode: 'overall',
      }),
    ).toEqual([18, 36]);
    expect(
      resolvePrintCutLines({
        boundaries: base,
        totalMode: 'coaches',
      }),
    ).toEqual([18, 36]);
  });
});
