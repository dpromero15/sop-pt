import {
  CalculatedFieldDefinition,
  LabelDefinition,
  MetricDefinition,
  PlayerRanking,
} from '../types';

export type RankingsSortMode = 'total' | 'label' | 'metric' | 'calculated';

/**
 * How totals are ranked:
 * - overall / adjusted: formula standing (higher better)
 * - coaches: sum of ordinals from complete coach ballots (lower better)
 */
export type RankingsTotalMode = 'overall' | 'adjusted' | 'coaches';

export type RankingsMetricSelection = string | 'none';

/** Metrics visible for the active category tab. */
export function metricsForCategory(
  metrics: MetricDefinition[],
  selectedLabelId: string | 'all',
): MetricDefinition[] {
  if (selectedLabelId === 'all') return metrics;
  return metrics.filter((m) => m.labelId === selectedLabelId);
}

/**
 * When switching categories, clear a metric that no longer belongs
 * and set the default sort for that category.
 */
export function selectionAfterCategoryChange(
  labelId: string | 'all',
  previousMetricId: RankingsMetricSelection,
  metrics: MetricDefinition[],
  calculatedFields: CalculatedFieldDefinition[] = [],
): { selectedMetricId: RankingsMetricSelection; sortBy: RankingsSortMode } {
  if (labelId === 'all') {
    const stillValidMetric =
      previousMetricId === 'none' ||
      metrics.some((m) => m.id === previousMetricId);
    const stillValidCalc =
      previousMetricId !== 'none' &&
      calculatedFields.some((f) => f.id === previousMetricId && f.enabled);
    if (stillValidMetric && previousMetricId !== 'none') {
      return { selectedMetricId: previousMetricId, sortBy: 'metric' };
    }
    if (stillValidCalc) {
      return { selectedMetricId: previousMetricId, sortBy: 'calculated' };
    }
    return { selectedMetricId: 'none', sortBy: 'total' };
  }

  const inCategory =
    previousMetricId !== 'none' &&
    metrics.some((m) => m.id === previousMetricId && m.labelId === labelId);

  if (inCategory) {
    return { selectedMetricId: previousMetricId, sortBy: 'metric' };
  }

  const calcInCategory =
    previousMetricId !== 'none' &&
    calculatedFields.some((f) => {
      if (f.id !== previousMetricId || !f.enabled) return false;
      const base = metrics.find((m) => m.id === f.baseMetricId);
      return base?.labelId === labelId;
    });

  if (calcInCategory) {
    return { selectedMetricId: previousMetricId, sortBy: 'calculated' };
  }

  return { selectedMetricId: 'none', sortBy: 'label' };
}

/**
 * Sort comparator for optional numeric rankings values.
 * Missing / unrecorded always ranks worst (after any real value, including 0).
 */
export function compareOptionalRankValue(
  a: number | null | undefined,
  b: number | null | undefined,
  higherIsBetter: boolean,
): number {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return higherIsBetter ? b - a : a - b;
}

function metricAggregatedValue(
  ranking: PlayerRanking,
  metricId: string,
  labelId: string,
): number | null {
  const detail = ranking.labelScores[labelId]?.metrics.find(
    (m) => m.metricId === metricId,
  );
  return detail?.aggregatedValue ?? null;
}

/** Standing / coaches sum for the active total mode. */
export function totalForMode(
  ranking: PlayerRanking,
  totalMode: RankingsTotalMode,
): number | null {
  if (totalMode === 'adjusted') return ranking.adjustedTotalScore;
  if (totalMode === 'coaches') return ranking.coachesTotalSum;
  return ranking.totalScore;
}

/** Pool place for the active total mode. */
export function rankForMode(
  ranking: PlayerRanking,
  totalMode: RankingsTotalMode,
): number | null {
  if (totalMode === 'adjusted') return ranking.adjustedRank;
  if (totalMode === 'coaches') return ranking.coachesRank;
  return ranking.overallRank;
}

/** Category standing score — coaches mode falls back to overall category scores. */
export function labelScoreForMode(
  ranking: PlayerRanking,
  labelId: string,
  totalMode: RankingsTotalMode,
): number | null {
  const ls = ranking.labelScores[labelId];
  if (!ls) return null;
  return totalMode === 'adjusted' ? ls.adjustedScore : ls.score;
}

/** Whether total sort treats higher values as better (false for coaches ordinal sums). */
export function totalHigherIsBetter(totalMode: RankingsTotalMode): boolean {
  return totalMode !== 'coaches';
}

/** True when the player has no value for the active rank-by mode. */
export function isUnscoredForRankMode(
  ranking: PlayerRanking,
  sortBy: RankingsSortMode,
  selectedLabelId: string | 'all',
  selectedMetricId: RankingsMetricSelection,
  metrics: MetricDefinition[],
  totalMode: RankingsTotalMode = 'overall',
): boolean {
  if (sortBy === 'metric' && selectedMetricId !== 'none') {
    const metric = metrics.find((m) => m.id === selectedMetricId);
    if (!metric) return true;
    return metricAggregatedValue(ranking, selectedMetricId, metric.labelId) === null;
  }

  if (sortBy === 'calculated' && selectedMetricId !== 'none') {
    return ranking.calculatedValues[selectedMetricId] === undefined;
  }

  if (sortBy === 'label' && selectedLabelId !== 'all') {
    const score = labelScoreForMode(ranking, selectedLabelId, totalMode);
    return score === null || score === undefined;
  }

  if (sortBy === 'total') {
    const score = totalForMode(ranking, totalMode);
    return score === null || score === undefined;
  }

  return totalForMode(ranking, totalMode) === null;
}

export function compareRankings(
  a: PlayerRanking,
  b: PlayerRanking,
  sortBy: RankingsSortMode,
  selectedLabelId: string | 'all',
  selectedMetricId: RankingsMetricSelection,
  metrics: MetricDefinition[],
  calculatedFields: CalculatedFieldDefinition[] = [],
  totalMode: RankingsTotalMode = 'overall',
): number {
  if (sortBy === 'label' && selectedLabelId !== 'all') {
    return compareOptionalRankValue(
      labelScoreForMode(a, selectedLabelId, totalMode),
      labelScoreForMode(b, selectedLabelId, totalMode),
      true,
    );
  }

  if (sortBy === 'metric' && selectedMetricId !== 'none') {
    const metric = metrics.find((m) => m.id === selectedMetricId);
    const labelId = metric?.labelId ?? '';
    return compareOptionalRankValue(
      metricAggregatedValue(a, selectedMetricId, labelId),
      metricAggregatedValue(b, selectedMetricId, labelId),
      metric?.higherIsBetter ?? true,
    );
  }

  if (sortBy === 'calculated' && selectedMetricId !== 'none') {
    const field = calculatedFields.find((f) => f.id === selectedMetricId);
    return compareOptionalRankValue(
      a.calculatedValues[selectedMetricId],
      b.calculatedValues[selectedMetricId],
      field?.higherIsBetter ?? true,
    );
  }

  return compareOptionalRankValue(
    totalForMode(a, totalMode),
    totalForMode(b, totalMode),
    totalHigherIsBetter(totalMode),
  );
}

export function categoryScoreTagLabel(label: LabelDefinition): string {
  return `${label.name} standing`;
}
