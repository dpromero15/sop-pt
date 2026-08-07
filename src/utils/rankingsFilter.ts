import { LabelDefinition, MetricDefinition, PlayerRanking } from '../types';

export type RankingsSortMode = 'total' | 'label' | 'metric';

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
): { selectedMetricId: RankingsMetricSelection; sortBy: RankingsSortMode } {
  if (labelId === 'all') {
    const stillValid =
      previousMetricId === 'none' ||
      metrics.some((m) => m.id === previousMetricId);
    if (stillValid && previousMetricId !== 'none') {
      return { selectedMetricId: previousMetricId, sortBy: 'metric' };
    }
    return { selectedMetricId: 'none', sortBy: 'total' };
  }

  const inCategory =
    previousMetricId !== 'none' &&
    metrics.some((m) => m.id === previousMetricId && m.labelId === labelId);

  if (inCategory) {
    return { selectedMetricId: previousMetricId, sortBy: 'metric' };
  }
  return { selectedMetricId: 'none', sortBy: 'label' };
}

export function compareRankings(
  a: PlayerRanking,
  b: PlayerRanking,
  sortBy: RankingsSortMode,
  selectedLabelId: string | 'all',
  selectedMetricId: RankingsMetricSelection,
  metrics: MetricDefinition[],
): number {
  if (sortBy === 'label' && selectedLabelId !== 'all') {
    const scoreA = a.labelScores[selectedLabelId]?.score ?? 0;
    const scoreB = b.labelScores[selectedLabelId]?.score ?? 0;
    return scoreB - scoreA;
  }

  if (sortBy === 'metric' && selectedMetricId !== 'none') {
    const metric = metrics.find((m) => m.id === selectedMetricId);
    const valA =
      a.labelScores[metric?.labelId ?? '']?.metrics.find(
        (m) => m.metricId === selectedMetricId,
      )?.latestValue ?? -999;
    const valB =
      b.labelScores[metric?.labelId ?? '']?.metrics.find(
        (m) => m.metricId === selectedMetricId,
      )?.latestValue ?? -999;
    if (metric && !metric.higherIsBetter) {
      return valA - valB;
    }
    return valB - valA;
  }

  return b.totalScore - a.totalScore;
}

export function categoryScoreTagLabel(label: LabelDefinition): string {
  return `${label.name} score`;
}
