import type { MigrationContext, MigrationResult } from '../types';
import { STORAGE_KEYS } from '../../storage/storageKeys';
import {
  migrateSessionsMetricIds,
  normalizeSessionStatus,
  type LegacySession,
} from '../../../utils/sessionMetrics';
import { migrateMetricsAggregation } from '../../../utils/metricAggregation';
import { parseStoredBumpTransactions } from '../../../utils/adjustedBumps';
import type {
  LabelDefinition,
  MetricDefinition,
  MetricEntry,
  Session,
} from '../../../types';

/**
 * v1 — Fold historical lazy/on-read migrations into an explicit, durable pass
 * so production browsers and imports land on a known shape before UI hydrate.
 */
export function migration001ConsolidateLegacyShapes(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const sessionsRaw = ctx.getJson<LegacySession[]>(STORAGE_KEYS.SESSIONS);
  const entriesRaw = ctx.getJson<MetricEntry[]>(STORAGE_KEYS.ENTRIES);
  if (sessionsRaw && Array.isArray(sessionsRaw)) {
    const withMetrics = migrateSessionsMetricIds(
      sessionsRaw,
      entriesRaw ?? [],
    );
    const normalized = withMetrics.map((s) => ({
      ...s,
      status: normalizeSessionStatus(
        (s as Session & { status?: string }).status,
      ),
      type: s.type === 'match' ? 'match' : 'session',
    })) as Session[];
    const before = JSON.stringify(sessionsRaw);
    const after = JSON.stringify(normalized);
    if (before !== after) {
      ctx.setJson(STORAGE_KEYS.SESSIONS, normalized);
      changed = true;
      notes.push('Normalized sessions (metricIds, status, type).');
    }
  }

  const metricsRaw = ctx.getJson<MetricDefinition[]>(STORAGE_KEYS.METRICS);
  if (metricsRaw && Array.isArray(metricsRaw)) {
    const migrated = migrateMetricsAggregation(metricsRaw);
    if (JSON.stringify(metricsRaw) !== JSON.stringify(migrated)) {
      ctx.setJson(STORAGE_KEYS.METRICS, migrated);
      changed = true;
      notes.push('Filled metric aggregation / Adjusted Rank fields.');
    }
  }

  const labelsRaw = ctx.getJson<LabelDefinition[]>(STORAGE_KEYS.LABELS);
  if (labelsRaw && Array.isArray(labelsRaw)) {
    let labelChanged = false;
    const next = labelsRaw.map((l) => {
      if (l.id === 'attendance' && !l.system) {
        labelChanged = true;
        return { ...l, system: true };
      }
      return l;
    });
    if (labelChanged) {
      ctx.setJson(STORAGE_KEYS.LABELS, next);
      changed = true;
      notes.push('Marked attendance label as system.');
    }
  }

  const bumpsRaw = ctx.storage.getItem(STORAGE_KEYS.ADJUSTED_BUMPS);
  if (bumpsRaw) {
    try {
      const parsed = JSON.parse(bumpsRaw) as unknown;
      const txs = parseStoredBumpTransactions(parsed);
      const asLegacyMap =
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed);
      if (asLegacyMap) {
        ctx.setJson(STORAGE_KEYS.ADJUSTED_BUMPS, txs);
        changed = true;
        notes.push('Converted legacy bump map to transaction ledger.');
      }
    } catch {
      notes.push('Skipped bump ledger (unreadable JSON).');
    }
  }

  if (!changed) notes.push('Legacy shapes already current.');
  ctx.log(`001: ${notes.join(' ')}`);
  return { changed, notes };
}
