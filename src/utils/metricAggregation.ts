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

/** Ensure aggregationMode is set (mutates a shallow copy). */
export function normalizeMetricDefinition(
  metric: MetricDefinition & { aggregationMode?: MetricAggregationMode },
): MetricDefinition {
  if (metric.aggregationMode) return metric as MetricDefinition;
  return {
    ...metric,
    aggregationMode: defaultAggregationMode(metric),
  };
}

export function migrateMetricsAggregation(
  metrics: Array<MetricDefinition & { aggregationMode?: MetricAggregationMode }>,
): { metrics: MetricDefinition[]; changed: boolean } {
  let changed = false;
  const next = metrics.map((m) => {
    if (m.aggregationMode) return m as MetricDefinition;
    changed = true;
    return normalizeMetricDefinition(m);
  });
  return { metrics: next, changed };
}

/**
 * Roll up a player's entries for one metric per aggregationMode.
 * Returns null when there are no valid (non-excused) entries.
 */
export function aggregateMetricValue(
  playerEntries: MetricEntry[],
  metric: MetricDefinition,
): number | null {
  const valid = playerEntries.filter(
    (e) => e.metricId === metric.id && e.value >= 0,
  );
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
