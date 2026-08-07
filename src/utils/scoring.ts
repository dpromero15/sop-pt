import { 
  MetricDefinition, 
  MetricEntry, 
  Player, 
  LabelDefinition, 
  ScoringFormulaConfig, 
  PlayerRanking, 
  PlayerLabelScore 
} from '../types';

/**
 * Normalizes a raw metric value into a standardized 0-100 score scale.
 */
export function normalizeMetricValue(
  value: number, 
  metric: MetricDefinition
): number {
  if (metric.type === 'attendance') {
    if (value < 0) return 100; // Excused / exempt does not penalize
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

/**
 * Calculates complete player rankings based on current metric entries and formula weights.
 */
export function calculatePlayerRankings(
  players: Player[],
  entries: MetricEntry[],
  metrics: MetricDefinition[],
  labels: LabelDefinition[],
  formula: ScoringFormulaConfig
): PlayerRanking[] {
  const metricMap = new Map<string, MetricDefinition>();
  metrics.forEach(m => metricMap.set(m.id, m));

  const labelMap = new Map<string, LabelDefinition>();
  labels.forEach(l => labelMap.set(l.id, l));

  // Build weight lookup map
  const weightMap = new Map<string, { weightPercent: number; enabled: boolean }>();
  formula.weights.forEach(w => weightMap.set(w.labelId, { weightPercent: w.weightPercent, enabled: w.enabled }));

  const rankings: PlayerRanking[] = players.map(player => {
    // Get all metric entries for this player
    const playerEntries = entries.filter(e => e.playerId === player.id);

    // Group latest values per metric ID
    const latestEntriesMap = new Map<string, MetricEntry>();
    playerEntries.forEach(entry => {
      const existing = latestEntriesMap.get(entry.metricId);
      if (!existing || new Date(entry.timestamp) > new Date(existing.timestamp)) {
        latestEntriesMap.set(entry.metricId, entry);
      }
    });

    // Group entries by Label ID
    const labelScoresRecord: Record<string, PlayerLabelScore> = {};

    labels.forEach(label => {
      // Find all metrics belonging to this label
      const labelMetrics = metrics.filter(m => m.labelId === label.id);
      const metricDetails: PlayerLabelScore['metrics'] = [];
      let totalNormalizedScoreSum = 0;
      let validMetricCount = 0;

      labelMetrics.forEach(m => {
        const latestEntry = latestEntriesMap.get(m.id);
        if (latestEntry && latestEntry.value >= 0) {
          const normScore = normalizeMetricValue(latestEntry.value, m);
          metricDetails.push({
            metricId: m.id,
            metricName: m.name,
            latestValue: latestEntry.value,
            unit: m.unit,
            normalizedScore: normScore
          });
          totalNormalizedScoreSum += normScore;
          validMetricCount++;
        }
      });

      const labelScoreAvg = validMetricCount > 0 
        ? Math.round((totalNormalizedScoreSum / validMetricCount) * 10) / 10 
        : 70; // Default baseline if no entries logged yet

      labelScoresRecord[label.id] = {
        labelId: label.id,
        labelName: label.name,
        score: labelScoreAvg,
        entryCount: validMetricCount,
        metrics: metricDetails
      };
    });

    // Calculate Total Weighted Score
    let totalScoreNumerator = 0;
    let totalWeightDenominator = 0;

    labels.forEach(label => {
      const wConfig = weightMap.get(label.id);
      if (wConfig && wConfig.enabled && wConfig.weightPercent > 0) {
        const lScore = labelScoresRecord[label.id]?.score ?? 70;
        totalScoreNumerator += lScore * wConfig.weightPercent;
        totalWeightDenominator += wConfig.weightPercent;
      }
    });

    const finalTotalScore = totalWeightDenominator > 0 
      ? Math.round((totalScoreNumerator / totalWeightDenominator) * 10) / 10 
      : 70;

    // Attendance Rate Calculation
    const attendanceEntries = playerEntries.filter(e => {
      const m = metricMap.get(e.metricId);
      return m && m.type === 'attendance' && e.value >= 0;
    });

    let attendanceRate = 100;
    if (attendanceEntries.length > 0) {
      const sum = attendanceEntries.reduce((acc, curr) => acc + curr.value, 0);
      attendanceRate = Math.round(sum / attendanceEntries.length);
    }

    // Determine recent trend
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
      labelScores: labelScoresRecord,
      rank: 0, // Will be set after sorting
      attendanceRate,
      recentTrend
    };
  });

  // Sort rankings descending by totalScore
  rankings.sort((a, b) => b.totalScore - a.totalScore);

  // Assign 1-indexed ranks
  rankings.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return rankings;
}
