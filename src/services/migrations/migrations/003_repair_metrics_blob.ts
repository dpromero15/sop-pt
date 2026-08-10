import type { MigrationContext, MigrationResult } from '../types';
import { STORAGE_KEYS } from '../../storage/storageKeys';
import { migrateMetricsAggregation } from '../../../utils/metricAggregation';
import { DEFAULT_METRICS } from '../../../data/initialData';

/**
 * v3 — Repair metrics key if an earlier 001 bug stored `{ metrics, changed }`
 * instead of a MetricDefinition[].
 */
export function migration003RepairMetricsBlob(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  const raw = ctx.getJson<unknown>(STORAGE_KEYS.METRICS);

  if (raw == null) {
    notes.push('No metrics blob; nothing to repair.');
    ctx.log(`003: ${notes.join(' ')}`);
    return { changed: false, notes };
  }

  if (Array.isArray(raw)) {
    const { metrics, changed } = migrateMetricsAggregation(raw);
    if (changed) {
      ctx.setJson(STORAGE_KEYS.METRICS, metrics);
      notes.push('Normalized metrics array fields.');
      ctx.log(`003: ${notes.join(' ')}`);
      return { changed: true, notes };
    }
    notes.push('Metrics array already valid.');
    ctx.log(`003: ${notes.join(' ')}`);
    return { changed: false, notes };
  }

  const { metrics, changed } = migrateMetricsAggregation(raw);
  const next = metrics.length > 0 ? metrics : DEFAULT_METRICS;
  ctx.setJson(STORAGE_KEYS.METRICS, next);
  notes.push(
    changed || metrics.length === 0
      ? 'Repaired corrupt metrics storage (restored array).'
      : 'Rewrote metrics blob as array.',
  );
  ctx.log(`003: ${notes.join(' ')}`);
  return { changed: true, notes };
}
