import {
  MetricDefinition,
  MetricEntry,
  Player,
  LabelDefinition,
  ScoringFormulaConfig,
  PlayerRanking,
  PlayerLabelScore,
} from '../types';
import { aggregateMetricValue, percentileAmong } from './metricAggregation';
import { metricScoresInCategory } from './metricLabels';
import { ATTENDANCE_METRIC_ID } from './sessionMetrics';
import { visibleRankingLabels } from './formulaWeights';
import { rosterPlayers } from './playerStatus';

/** Used when the team blob has attendance entries but no attendance metric row. */
const ATTENDANCE_METRIC_FALLBACK: MetricDefinition = {
  id: ATTENDANCE_METRIC_ID,
  name: 'Session Attendance',
  labelIds: ['attendance'],
  primaryLabelId: 'attendance',
  type: 'attendance',
  unit: 'status',
  higherIsBetter: true,
  aggregationMode: 'average',
};

function metricsForRankings(metrics: MetricDefinition[]): MetricDefinition[] {
  if (
    metrics.some(
      (m) => m.type === 'attendance' || m.id === ATTENDANCE_METRIC_ID,
    )
  ) {
    return metrics;
  }
  return [...metrics, ATTENDANCE_METRIC_FALLBACK];
}

/**
 * Absolute min/max normalization — kept for optional standards / benchmarks
 * (not used for Statistical / Adjusted pool ranks).
 */
export function normalizeMetricValue(
  value: number,
  metric: MetricDefinition,
): number {
  if (metric.type === 'attendance') {
    return Math.min(100, Math.max(0, value));
  }

  if (metric.type === 'rating_10') {
    return Math.min(100, Math.max(0, value * 10));
  }

  if (metric.type === 'percentage') {
    return Math.min(100, Math.max(0, value));
  }

  const min = metric.minExpectedValue ?? 0;
  const max = metric.maxExpectedValue ?? (min > 0 ? min * 2 : 100);

  if (max === min) return 50;

  let scoreRatio: number;
  if (metric.higherIsBetter) {
    scoreRatio = (value - min) / (max - min);
  } else {
    scoreRatio = (max - value) / (max - min);
  }

  const normalized = scoreRatio * 100;
  return Math.min(100, Math.max(0, Math.round(normalized * 10) / 10));
}

/**
 * Formats a metric value with its unit for display.
 */
export function formatMetricValue(value: number, metric: MetricDefinition): string {
  if (metric.type === 'attendance') {
    if (value === 100) return 'Present';
    if (value === 50) return 'Late';
    if (value === 0) return 'Absent';
    return 'Excused';
  }
  if (metric.type === 'percentage') {
    return `${Math.round(value)}%`;
  }
  if (metric.type === 'rating_10') {
    return `${value.toFixed(1)}/10`;
  }
  if (metric.type === 'time_seconds') {
    return `${value.toFixed(2)}s`;
  }
  return `${value} ${metric.unit}`;
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Competition ranks (1 = best). Ties share the best place; next place skips.
 * Null scores stay null (unscored).
 */
export function assignCompetitionRanks(
  scores: Array<number | null>,
  higherIsBetter = true,
): Array<number | null> {
  const indexed = scores.map((score, index) => ({ score, index }));
  const scored = indexed.filter((x) => x.score !== null) as Array<{
    score: number;
    index: number;
  }>;

  scored.sort((a, b) =>
    higherIsBetter ? b.score - a.score : a.score - b.score,
  );

  const ranks: Array<number | null> = scores.map(() => null);
  let i = 0;
  while (i < scored.length) {
    let j = i;
    while (
      j + 1 < scored.length &&
      scored[j + 1].score === scored[i].score
    ) {
      j++;
    }
    const place = i + 1;
    for (let k = i; k <= j; k++) {
      ranks[scored[k].index] = place;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Calculates complete player rankings based on current metric entries and formula weights.
 *
 * Standing scores use **squad pool percentiles** per metric (not absolute min/max),
 * except **Attendance**, which uses the season attendance rate (0–100) directly so
 * the Attendance formula weight reflects reliability.
 * - **Statistical** omits unscored / excused values.
 * - **Adjusted** uses metrics with `includeInAdjustedTotal !== false`; missing
 *   values count as 0 when `treatNoScoreAsZero !== false`, otherwise omitted.
 * Pool places (`overallRank` / `adjustedRank`) are competition ranks from those scores.
 * Inactive players are omitted from the pool (no list row, no percentile / average).
 */
export function calculatePlayerRankings(
  players: Player[],
  entries: MetricEntry[],
  metrics: MetricDefinition[],
  labels: LabelDefinition[],
  formula: ScoringFormulaConfig,
): PlayerRanking[] {
  const roster = rosterPlayers(players);
  const rankingLabels = visibleRankingLabels(labels);
  const rankingMetrics = metricsForRankings(metrics);

  const metricMap = new Map<string, MetricDefinition>();
  rankingMetrics.forEach((m) => metricMap.set(m.id, m));

  const weightMap = new Map<string, { weightPercent: number; enabled: boolean }>();
  formula.weights.forEach((w) =>
    weightMap.set(w.labelId, {
      weightPercent: w.weightPercent,
      enabled: w.enabled,
    }),
  );

  // Aggregated raw value per player × metric (null = unscored).
  const aggByPlayer = new Map<string, Map<string, number | null>>();
  for (const player of roster) {
    const playerEntries = entries.filter((e) => e.playerId === player.id);
    const byMetric = new Map<string, number | null>();
    for (const m of rankingMetrics) {
      byMetric.set(m.id, aggregateMetricValue(playerEntries, m));
    }
    aggByPlayer.set(player.id, byMetric);
  }

  // Squad pools for percentile (only players with a value).
  const squadByMetric = new Map<string, number[]>();
  for (const m of rankingMetrics) {
    const values: number[] = [];
    for (const player of roster) {
      const v = aggByPlayer.get(player.id)?.get(m.id);
      if (v !== null && v !== undefined) values.push(v);
    }
    squadByMetric.set(m.id, values);
  }

  const rankings: PlayerRanking[] = roster.map((player) => {
    const playerEntries = entries.filter((e) => e.playerId === player.id);
    const playerAgg = aggByPlayer.get(player.id)!;
    const labelScoresRecord: Record<string, PlayerLabelScore> = {};

    rankingLabels.forEach((label) => {
      const labelMetrics = rankingMetrics.filter((m) =>
        metricScoresInCategory(m, label.id),
      );
      const metricDetails: PlayerLabelScore['metrics'] = [];
      let overallSum = 0;
      let overallCount = 0;
      const poolByMetric = new Map<string, number>();

      labelMetrics.forEach((m) => {
        const aggregated = playerAgg.get(m.id) ?? null;
        if (aggregated !== null) {
          // Attendance is already a 0–100 reliability rate; use it directly
          // in the formula blend so the Attendance weight reflects season rate.
          const poolScore =
            m.type === 'attendance'
              ? Math.min(100, Math.max(0, aggregated))
              : percentileAmong(
                  aggregated,
                  squadByMetric.get(m.id) ?? [],
                  m.higherIsBetter,
                );
          metricDetails.push({
            metricId: m.id,
            metricName: m.name,
            aggregatedValue: aggregated,
            unit: m.unit,
            poolScore,
          });
          poolByMetric.set(m.id, poolScore);
          overallSum += poolScore;
          overallCount++;
        }
      });

      const adjustedMetrics = labelMetrics.filter(
        (m) => m.includeInAdjustedTotal !== false,
      );
      let adjustedSum = 0;
      let adjustedCount = 0;

      adjustedMetrics.forEach((m) => {
        const aggregated = playerAgg.get(m.id) ?? null;
        if (aggregated !== null) {
          adjustedSum += poolByMetric.get(m.id) ?? 0;
          adjustedCount++;
        } else if (m.treatNoScoreAsZero !== false) {
          adjustedSum += 0;
          adjustedCount++;
        }
      });

      const overallScore =
        overallCount > 0 ? roundScore(overallSum / overallCount) : null;
      const adjustedScore =
        adjustedMetrics.length === 0 || adjustedCount === 0
          ? null
          : roundScore(adjustedSum / adjustedCount);

      labelScoresRecord[label.id] = {
        labelId: label.id,
        labelName: label.name,
        score: overallScore,
        adjustedScore,
        entryCount: overallCount,
        metrics: metricDetails,
      };
    });

    let overallNumerator = 0;
    let overallDenominator = 0;
    let adjustedNumerator = 0;
    let adjustedDenominator = 0;

    rankingLabels.forEach((label) => {
      const wConfig = weightMap.get(label.id);
      if (!wConfig || !wConfig.enabled || wConfig.weightPercent <= 0) return;

      const ls = labelScoresRecord[label.id];
      if (ls?.score !== null && ls?.score !== undefined) {
        overallNumerator += ls.score * wConfig.weightPercent;
        overallDenominator += wConfig.weightPercent;
      }
      // Adjusted uses category adjustedScore (metric gaps → 0). Labels with
      // no metrics stay null and are omitted from the blend.
      if (ls?.adjustedScore !== null && ls?.adjustedScore !== undefined) {
        adjustedNumerator += ls.adjustedScore * wConfig.weightPercent;
        adjustedDenominator += wConfig.weightPercent;
      }
    });

    const finalTotalScore =
      overallDenominator > 0
        ? roundScore(overallNumerator / overallDenominator)
        : null;

    const finalAdjustedTotal =
      adjustedDenominator > 0
        ? roundScore(adjustedNumerator / adjustedDenominator)
        : null;

    const attendanceEntries = playerEntries.filter((e) => {
      if (e.value < 0) return false;
      const m = metricMap.get(e.metricId);
      return (
        e.metricId === ATTENDANCE_METRIC_ID || m?.type === 'attendance'
      );
    });

    let attendanceRate: number | null = null;
    if (attendanceEntries.length > 0) {
      const sum = attendanceEntries.reduce((acc, curr) => acc + curr.value, 0);
      attendanceRate = Math.round(sum / attendanceEntries.length);
    }

    let recentTrend: 'up' | 'down' | 'stable' = 'stable';
    if (playerEntries.length >= 2) {
      const sorted = [...playerEntries].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      const first = sorted[0].value;
      const second = sorted[1].value;
      if (first > second) recentTrend = 'up';
      else if (first < second) recentTrend = 'down';
    }

    return {
      player,
      totalScore: finalTotalScore,
      adjustedTotalScore: finalAdjustedTotal,
      overallRank: null,
      adjustedRank: null,
      coachesTotalSum: null,
      coachesRank: null,
      adjustedBump: 0,
      eligibleToPlay: true,
      labelScores: labelScoresRecord,
      rank: 0,
      attendanceRate,
      recentTrend,
      calculatedValues: {},
    };
  });

  const overallRanks = assignCompetitionRanks(
    rankings.map((r) => r.totalScore),
    true,
  );
  const adjustedRanks = assignCompetitionRanks(
    rankings.map((r) => r.adjustedTotalScore),
    true,
  );

  rankings.forEach((item, idx) => {
    item.overallRank = overallRanks[idx];
    item.adjustedRank = adjustedRanks[idx];
    item.rank = overallRanks[idx] ?? rankings.length;
  });

  rankings.sort((a, b) => {
    if (a.totalScore === null && b.totalScore === null) return 0;
    if (a.totalScore === null) return 1;
    if (b.totalScore === null) return -1;
    return b.totalScore - a.totalScore;
  });

  return rankings;
}
