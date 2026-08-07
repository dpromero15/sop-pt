import { 
  MetricDefinition, 
  MetricEntry, 
  Player, 
  LabelDefinition, 
  ScoringFormulaConfig, 
  PlayerRanking, 
  PlayerLabelScore,
  CalculatedFieldDefinition,
} from '../types';
import { aggregateMetricValue } from './metricAggregation';
import { computeAllCalculatedValues } from './calculatedFields';

/**
 * Normalizes a raw metric value into a standardized 0-100 score scale.
 * Attendance: present=100, late=50, absent=0. Excused (negative value) is unscored
 * and must be filtered out before calling — never normalized as a score.
 */
export function normalizeMetricValue(
  value: number, 
  metric: MetricDefinition
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
    // Lower is better (e.g., sprint time)
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
 * Calculates complete player rankings based on current metric entries and formula weights.
 *
 * - **Overall** totals omit unscored / excused values (not counted against the player).
 * - **Weighted** totals treat unscored / excused as 0.
 */
export function calculatePlayerRankings(
  players: Player[],
  entries: MetricEntry[],
  metrics: MetricDefinition[],
  labels: LabelDefinition[],
  formula: ScoringFormulaConfig,
  calculatedFields: CalculatedFieldDefinition[] = [],
): PlayerRanking[] {
  const metricMap = new Map<string, MetricDefinition>();
  metrics.forEach(m => metricMap.set(m.id, m));

  const weightMap = new Map<string, { weightPercent: number; enabled: boolean }>();
  formula.weights.forEach(w => weightMap.set(w.labelId, { weightPercent: w.weightPercent, enabled: w.enabled }));

  const calculatedByPlayer = computeAllCalculatedValues(
    players,
    entries,
    metrics,
    calculatedFields,
  );

  const rankings: PlayerRanking[] = players.map(player => {
    const playerEntries = entries.filter(e => e.playerId === player.id);

    const labelScoresRecord: Record<string, PlayerLabelScore> = {};

    labels.forEach(label => {
      const labelMetrics = metrics.filter(m => m.labelId === label.id);
      const metricDetails: PlayerLabelScore['metrics'] = [];
      let overallSum = 0;
      let overallCount = 0;
      let weightedSum = 0;

      labelMetrics.forEach(m => {
        // Excused attendance (value < 0) is excluded by aggregate → unscored.
        const aggregated = aggregateMetricValue(playerEntries, m);
        if (aggregated !== null) {
          const normScore = normalizeMetricValue(aggregated, m);
          metricDetails.push({
            metricId: m.id,
            metricName: m.name,
            aggregatedValue: aggregated,
            unit: m.unit,
            normalizedScore: normScore
          });
          overallSum += normScore;
          overallCount++;
          weightedSum += normScore;
        } else {
          // Missing / unscored / excused → 0 for weighted average only.
          weightedSum += 0;
        }
      });

      const overallScore =
        overallCount > 0 ? roundScore(overallSum / overallCount) : null;
      const weightedScore =
        labelMetrics.length > 0
          ? roundScore(weightedSum / labelMetrics.length)
          : null;

      labelScoresRecord[label.id] = {
        labelId: label.id,
        labelName: label.name,
        score: overallScore,
        weightedScore,
        entryCount: overallCount,
        metrics: metricDetails
      };
    });

    // Overall total: only labels with real scores contribute (unscored omitted).
    let overallNumerator = 0;
    let overallDenominator = 0;

    // Weighted total: every enabled weight counts; missing labels = 0.
    let weightedNumerator = 0;
    let weightedDenominator = 0;

    labels.forEach(label => {
      const wConfig = weightMap.get(label.id);
      if (!wConfig || !wConfig.enabled || wConfig.weightPercent <= 0) return;

      weightedDenominator += wConfig.weightPercent;
      const lScore = labelScoresRecord[label.id]?.score;
      if (lScore !== null && lScore !== undefined) {
        overallNumerator += lScore * wConfig.weightPercent;
        overallDenominator += wConfig.weightPercent;
        weightedNumerator += lScore * wConfig.weightPercent;
      }
      // else weighted contributes 0 for this label (already via skipping add)
    });

    const finalTotalScore =
      overallDenominator > 0
        ? roundScore(overallNumerator / overallDenominator)
        : null;

    const finalWeightedTotal =
      weightedDenominator > 0
        ? roundScore(weightedNumerator / weightedDenominator)
        : null;

    // Attendance rate: present/late/absent only — excused is unscored / omitted.
    const attendanceEntries = playerEntries.filter(e => {
      const m = metricMap.get(e.metricId);
      return m && m.type === 'attendance' && e.value >= 0;
    });

    let attendanceRate: number | null = null;
    if (attendanceEntries.length > 0) {
      const sum = attendanceEntries.reduce((acc, curr) => acc + curr.value, 0);
      attendanceRate = Math.round(sum / attendanceEntries.length);
    }

    let recentTrend: 'up' | 'down' | 'stable' = 'stable';
    if (playerEntries.length >= 2) {
      const sorted = [...playerEntries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const first = sorted[0].value;
      const second = sorted[1].value;
      if (first > second) recentTrend = 'up';
      else if (first < second) recentTrend = 'down';
    }

    return {
      player,
      totalScore: finalTotalScore,
      weightedTotalScore: finalWeightedTotal,
      labelScores: labelScoresRecord,
      rank: 0,
      attendanceRate,
      recentTrend,
      calculatedValues: calculatedByPlayer.get(player.id) ?? {},
    };
  });

  // Default ordering by overall total; null / unrecorded sorts worst.
  rankings.sort((a, b) => {
    if (a.totalScore === null && b.totalScore === null) return 0;
    if (a.totalScore === null) return 1;
    if (b.totalScore === null) return -1;
    return b.totalScore - a.totalScore;
  });

  rankings.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return rankings;
}
