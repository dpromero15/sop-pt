import type {
  CalculatedFieldDefinition,
  MetricDefinition,
  MetricEntry,
  Player,
} from '../types';
import {
  aggregateMetricValue,
  averageMetricValue,
  percentileAmong,
  perSessionRate,
} from './metricAggregation';

/**
 * Compute a single calculated field for one player.
 * Percentile requires squad-wide base aggregates (pass via squadBaseValues).
 * Returns null when insufficient data or field is disabled.
 */
export function computeCalculatedFieldValue(
  field: CalculatedFieldDefinition,
  playerEntries: MetricEntry[],
  baseMetric: MetricDefinition | undefined,
  squadBaseValues?: number[],
): number | null {
  if (!field.enabled || !baseMetric) return null;

  const baseEntries = playerEntries.filter(
    (e) => e.metricId === field.baseMetricId && e.value >= 0,
  );

  if (field.kind === 'average') {
    return averageMetricValue(baseEntries);
  }

  if (field.kind === 'per_session') {
    return perSessionRate(baseEntries);
  }

  if (field.kind === 'percentile') {
    const playerAgg = aggregateMetricValue(playerEntries, baseMetric);
    if (playerAgg === null || !squadBaseValues || squadBaseValues.length === 0) {
      return null;
    }
    return percentileAmong(
      playerAgg,
      squadBaseValues,
      baseMetric.higherIsBetter,
    );
  }

  return null;
}

/**
 * Build calculatedValues maps for every player. Only enabled fields are computed.
 */
export function computeAllCalculatedValues(
  players: Player[],
  entries: MetricEntry[],
  metrics: MetricDefinition[],
  calculatedFields: CalculatedFieldDefinition[],
): Map<string, Record<string, number>> {
  const enabled = calculatedFields.filter((f) => f.enabled);
  const result = new Map<string, Record<string, number>>();

  if (enabled.length === 0) {
    players.forEach((p) => result.set(p.id, {}));
    return result;
  }

  const metricMap = new Map(metrics.map((m) => [m.id, m]));

  // Precompute squad aggregates for percentile fields
  const squadAggByBase = new Map<string, number[]>();
  for (const field of enabled) {
    if (field.kind !== 'percentile') continue;
    if (squadAggByBase.has(field.baseMetricId)) continue;
    const base = metricMap.get(field.baseMetricId);
    if (!base) continue;
    const values: number[] = [];
    for (const player of players) {
      const pe = entries.filter((e) => e.playerId === player.id);
      const agg = aggregateMetricValue(pe, base);
      if (agg !== null) values.push(agg);
    }
    squadAggByBase.set(field.baseMetricId, values);
  }

  for (const player of players) {
    const pe = entries.filter((e) => e.playerId === player.id);
    const values: Record<string, number> = {};
    for (const field of enabled) {
      const base = metricMap.get(field.baseMetricId);
      const v = computeCalculatedFieldValue(
        field,
        pe,
        base,
        squadAggByBase.get(field.baseMetricId),
      );
      if (v !== null) values[field.id] = v;
    }
    result.set(player.id, values);
  }

  return result;
}

export function formatCalculatedFieldValue(
  value: number,
  field: CalculatedFieldDefinition,
): string {
  if (field.kind === 'percentile') {
    return `${Math.round(value)}th`;
  }
  if (field.unit === 's') {
    return `${value.toFixed(2)}s`;
  }
  if (field.kind === 'per_session' || field.kind === 'average') {
    const rounded =
      Number.isInteger(value) ? String(value) : value.toFixed(2);
    return `${rounded} ${field.unit}`;
  }
  return `${value} ${field.unit}`;
}

/** Enabled calculated fields whose base metric is in the given category scope. */
export function calculatedFieldsForCategory(
  fields: CalculatedFieldDefinition[],
  metrics: MetricDefinition[],
  selectedLabelId: string | 'all',
): CalculatedFieldDefinition[] {
  const enabled = fields.filter((f) => f.enabled);
  if (selectedLabelId === 'all') return enabled;
  const baseIds = new Set(
    metrics.filter((m) => m.labelId === selectedLabelId).map((m) => m.id),
  );
  return enabled.filter((f) => baseIds.has(f.baseMetricId));
}
