import {
  LabelDefinition,
  MetricDefinition,
  PlayerRanking,
} from '../types';
import { formatMetricValue } from './scoring';
import { metricInCategory, metricPrimaryLabelId } from './metricLabels';

export type RankingsSortMode = 'total' | 'label' | 'metric';

/**
 * How totals are ranked:
 * - overall (Statistical Rank) / adjusted: formula standing (higher better)
 * - coaches: average ordinals from complete coach ballots (lower better)
 */
export type RankingsTotalMode = 'overall' | 'adjusted' | 'coaches';

export type RankingsMetricSelection = string | 'none';

/** Metrics visible for the active category tab (membership). */
export function metricsForCategory(
  metrics: MetricDefinition[],
  selectedLabelId: string | 'all',
): MetricDefinition[] {
  if (selectedLabelId === 'all') return metrics;
  return metrics.filter((m) => metricInCategory(m, selectedLabelId));
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
    const stillValidMetric =
      previousMetricId === 'none' ||
      metrics.some((m) => m.id === previousMetricId);
    if (stillValidMetric && previousMetricId !== 'none') {
      return { selectedMetricId: previousMetricId, sortBy: 'metric' };
    }
    return { selectedMetricId: 'none', sortBy: 'total' };
  }

  const inCategory =
    previousMetricId !== 'none' &&
    metrics.some(
      (m) => m.id === previousMetricId && metricInCategory(m, labelId),
    );

  if (inCategory) {
    return { selectedMetricId: previousMetricId, sortBy: 'metric' };
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
  if (detail?.aggregatedValue != null) return detail.aggregatedValue;
  if (metricId === 'm_attendance') return ranking.attendanceRate;
  return null;
}

/** Standing / coaches sum for the active total mode. */
export function totalForMode(
  ranking: PlayerRanking,
  totalMode: RankingsTotalMode,
): number | null {
  if (totalMode === 'adjusted') {
    if (ranking.adjustedTotalScore === null) return null;
    // Include ±1 bumps so Adjusted list order matches adjustedRank.
    return ranking.adjustedTotalScore + (ranking.adjustedBump ?? 0);
  }
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
  const fromLabel =
    totalMode === 'adjusted' ? ls?.adjustedScore : ls?.score;
  if (fromLabel != null) return fromLabel;
  if (labelId === 'attendance') return ranking.attendanceRate;
  return null;
}

/** Whether total sort treats higher values as better (false for coaches ordinal sums). */
export function totalHigherIsBetter(totalMode: RankingsTotalMode): boolean {
  return totalMode !== 'coaches';
}

/** True when this player has any logged standing (formula, attendance, or category entries). */
export function playerHasLoggedStanding(ranking: PlayerRanking): boolean {
  if (ranking.totalScore != null || ranking.adjustedTotalScore != null) {
    return true;
  }
  if (ranking.attendanceRate != null) return true;
  return Object.values(ranking.labelScores).some(
    (ls) =>
      (ls?.entryCount ?? 0) > 0 ||
      ls?.score != null ||
      ls?.adjustedScore != null,
  );
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
    return (
      metricAggregatedValue(
        ranking,
        selectedMetricId,
        metricPrimaryLabelId(metric),
      ) === null
    );
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

/**
 * Whether the current Rankings filter has anything to show
 * (Statistical / Adjusted include attendance-only logs).
 */
export function scopeHasRankingsData(opts: {
  rankings: PlayerRanking[];
  hasLoggedData: boolean;
  sortBy: RankingsSortMode;
  selectedLabelId: string | 'all';
  selectedMetricId: RankingsMetricSelection;
  metrics: MetricDefinition[];
  totalMode: RankingsTotalMode;
  individualCoachOrdinals?: Map<string, number> | null;
}): boolean {
  const {
    rankings,
    hasLoggedData,
    sortBy,
    selectedLabelId,
    selectedMetricId,
    metrics,
    totalMode,
    individualCoachOrdinals,
  } = opts;

  if (totalMode === 'coaches') {
    if (individualCoachOrdinals && individualCoachOrdinals.size > 0) {
      return true;
    }
    return rankings.some((r) => r.coachesTotalSum !== null);
  }

  if (!hasLoggedData) return false;

  if (sortBy === 'metric' && selectedMetricId !== 'none') {
    const metric = metrics.find((m) => m.id === selectedMetricId);
    if (!metric) return false;
    const primaryId = metricPrimaryLabelId(metric);
    const isAttendance =
      metric.type === 'attendance' || metric.id === 'm_attendance';
    return rankings.some((r) => {
      if (metricAggregatedValue(r, metric.id, primaryId) != null) return true;
      return isAttendance && r.attendanceRate != null;
    });
  }

  if (selectedLabelId !== 'all') {
    if (selectedLabelId === 'attendance') {
      return rankings.some(
        (r) =>
          r.attendanceRate != null ||
          (r.labelScores.attendance?.entryCount ?? 0) > 0 ||
          r.labelScores.attendance?.score != null ||
          r.labelScores.attendance?.adjustedScore != null,
      );
    }
    if (totalMode === 'adjusted') {
      return rankings.some(
        (r) => r.labelScores[selectedLabelId]?.adjustedScore != null,
      );
    }
    return rankings.some(
      (r) => (r.labelScores[selectedLabelId]?.entryCount ?? 0) > 0,
    );
  }

  return rankings.some(playerHasLoggedStanding);
}

export function compareRankings(
  a: PlayerRanking,
  b: PlayerRanking,
  sortBy: RankingsSortMode,
  selectedLabelId: string | 'all',
  selectedMetricId: RankingsMetricSelection,
  metrics: MetricDefinition[],
  totalMode: RankingsTotalMode = 'overall',
): number {
  // Adjusted / specialty: ineligible players always sort to the bottom.
  if (totalMode === 'adjusted') {
    const aInelig = a.eligibleToPlay === false;
    const bInelig = b.eligibleToPlay === false;
    if (aInelig !== bInelig) return aInelig ? 1 : -1;
  }

  if (sortBy === 'label' && selectedLabelId !== 'all') {
    return compareOptionalRankValue(
      labelScoreForMode(a, selectedLabelId, totalMode),
      labelScoreForMode(b, selectedLabelId, totalMode),
      true,
    );
  }

  if (sortBy === 'metric' && selectedMetricId !== 'none') {
    const metric = metrics.find((m) => m.id === selectedMetricId);
    const labelId = metric ? metricPrimaryLabelId(metric) : '';
    return compareOptionalRankValue(
      metricAggregatedValue(a, selectedMetricId, labelId),
      metricAggregatedValue(b, selectedMetricId, labelId),
      metric?.higherIsBetter ?? true,
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

export interface TeamMetricSummary {
  avg: number | null;
  best: number | null;
  scored: number;
  roster: number;
}

/** Squad rollup for the selected measurable metric (informational). */
export function teamMetricSummary(
  rankings: PlayerRanking[],
  metric: MetricDefinition,
): TeamMetricSummary {
  const primaryId = metricPrimaryLabelId(metric);
  const values: number[] = [];
  for (const r of rankings) {
    const v = metricAggregatedValue(r, metric.id, primaryId);
    if (v !== null) values.push(v);
  }
  if (values.length === 0) {
    return { avg: null, best: null, scored: 0, roster: rankings.length };
  }
  const sum = values.reduce((acc, v) => acc + v, 0);
  const avg = Math.round((sum / values.length) * 100) / 100;
  const best = metric.higherIsBetter
    ? Math.max(...values)
    : Math.min(...values);
  return {
    avg,
    best,
    scored: values.length,
    roster: rankings.length,
  };
}

/** Format an aggregated metric value for team / ranking display. */
export function formatTeamMetricValue(
  value: number,
  metric: MetricDefinition,
): string {
  if (metric.type === 'attendance') {
    return `${Math.round(value)}%`;
  }
  return formatMetricValue(value, metric);
}
