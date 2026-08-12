import type {
  MetricAggregationMode,
  MetricDefinition,
  MetricEntry,
} from '../types';

type MetricAggregationHints = Pick<
  MetricDefinition,
  'type' | 'unit' | 'aggregationMode'
>;

/**
 * Infer aggregation when legacy metrics omit aggregationMode.
 * Time tests → best; additive game counts → sum; otherwise latest.
 */
export function defaultAggregationMode(
  metric: Pick<MetricDefinition, 'type' | 'unit'>,
): MetricAggregationMode {
  if (metric.type === 'time_seconds') return 'best';
  if (metric.type === 'count') {
    if (['goals', 'assists', 'tackles'].includes(metric.unit)) return 'sum';
    return 'best';
  }
  return 'latest';
}

type MetricMigrationInput = MetricDefinition & {
  aggregationMode?: MetricAggregationMode;
  includeInAdjustedTotal?: boolean;
  treatNoScoreAsZero?: boolean;
};

/** Ensure aggregationMode and Adjusted flags are set (returns a shallow copy when needed). */
export function normalizeMetricDefinition(
  metric: MetricMigrationInput,
): MetricDefinition {
  const aggregationMode =
    metric.aggregationMode ?? defaultAggregationMode(metric);
  const includeInAdjustedTotal = metric.includeInAdjustedTotal ?? true;
  const treatNoScoreAsZero = metric.treatNoScoreAsZero ?? true;

  if (
    metric.aggregationMode === aggregationMode &&
    metric.includeInAdjustedTotal === includeInAdjustedTotal &&
    metric.treatNoScoreAsZero === treatNoScoreAsZero
  ) {
    return metric as MetricDefinition;
  }

  return {
    ...metric,
    aggregationMode,
    includeInAdjustedTotal,
    treatNoScoreAsZero,
  };
}

export function migrateMetricsAggregation(
  metrics: unknown,
): { metrics: MetricDefinition[]; changed: boolean } {
  if (!Array.isArray(metrics)) {
    // Repair corrupt writes (e.g. `{ metrics, changed }` stored as the blob).
    if (
      metrics &&
      typeof metrics === 'object' &&
      Array.isArray((metrics as { metrics?: unknown }).metrics)
    ) {
      const inner = migrateMetricsAggregation(
        (metrics as { metrics: MetricMigrationInput[] }).metrics,
      );
      return { metrics: inner.metrics, changed: true };
    }
    return { metrics: [], changed: true };
  }

  let changed = false;
  const next = metrics.map((m) => {
    const normalized = normalizeMetricDefinition(m as MetricMigrationInput);
    const original = m as MetricMigrationInput;
    if (
      normalized.aggregationMode !== original.aggregationMode ||
      normalized.includeInAdjustedTotal !== original.includeInAdjustedTotal ||
      normalized.treatNoScoreAsZero !== original.treatNoScoreAsZero
    ) {
      changed = true;
    }
    return normalized;
  });
  return { metrics: next, changed };
}

/**
 * Roll up a player's entries for one metric per aggregationMode.
 * Returns null when there are no valid (non-excused) entries.
 *
 * Attendance is always the mean of present/late/absent (excused omitted),
 * matching the displayed attendance rate — not latest-only.
 */
export function aggregateMetricValue(
  playerEntries: MetricEntry[],
  metric: MetricDefinition,
): number | null {
  const valid = playerEntries.filter(
    (e) => e.metricId === metric.id && e.value >= 0,
  );
  if (metric.type === 'attendance') {
    return averageMetricValue(valid);
  }
  return aggregateMetricValueForEntries(valid, metric);
}

/** Aggregate pre-filtered entries that already belong to one player + metric. */
export function aggregateMetricValueForEntries(
  validEntries: MetricEntry[],
  metric: MetricAggregationHints & { higherIsBetter?: boolean },
): number | null {
  const valid = validEntries.filter((e) => e.value >= 0);
  if (valid.length === 0) return null;

  const mode = metric.aggregationMode ?? defaultAggregationMode(metric);

  if (mode === 'sum') {
    return valid.reduce((sum, e) => sum + e.value, 0);
  }

  if (mode === 'best') {
    const values = valid.map((e) => e.value);
    const higherIsBetter = metric.higherIsBetter ?? true;
    return higherIsBetter ? Math.max(...values) : Math.min(...values);
  }

  // latest
  const sorted = [...valid].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return sorted[0].value;
}

/** Mean of valid entry values (for calculated average fields). */
export function averageMetricValue(validEntries: MetricEntry[]): number | null {
  const valid = validEntries.filter((e) => e.value >= 0);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, e) => acc + e.value, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

/**
 * Per-session rate: sum / number of sessions that have at least one entry.
 */
export function perSessionRate(
  validEntries: MetricEntry[],
): number | null {
  const valid = validEntries.filter((e) => e.value >= 0);
  if (valid.length === 0) return null;
  const sessionIds = new Set(valid.map((e) => e.sessionId));
  const sum = valid.reduce((acc, e) => acc + e.value, 0);
  return Math.round((sum / sessionIds.size) * 100) / 100;
}

/**
 * Percentile standing vs squad (100 = best, 0 = worst).
 * Uses rank among squad aggregates; ties share the best rank index.
 */
export function percentileAmong(
  value: number,
  squadValues: number[],
  higherIsBetter: boolean,
): number {
  if (squadValues.length === 0) return 0;
  if (squadValues.length === 1) return 100;

  const sorted = [...squadValues].sort((a, b) =>
    higherIsBetter ? b - a : a - b,
  );
  const rank = sorted.indexOf(value);
  if (rank < 0) return 0;
  return Math.round(
    ((sorted.length - 1 - rank) / (sorted.length - 1)) * 100,
  );
}
