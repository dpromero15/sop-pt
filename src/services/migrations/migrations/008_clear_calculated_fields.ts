import { STORAGE_KEYS } from '../../storage/storageKeys';
import type { MigrationContext, MigrationResult } from '../types';

/**
 * v8 — Calculated fields removed from product UI.
 * Average is now a metric aggregation mode; clear stored catalog.
 */
export function migration008ClearCalculatedFields(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const existing = ctx.getJson<unknown[]>(STORAGE_KEYS.CALCULATED_FIELDS);
  if (existing === null) {
    notes.push('No calculated-fields key.');
  } else if (!Array.isArray(existing) || existing.length === 0) {
    notes.push('Calculated fields already empty.');
  } else {
    ctx.setJson(STORAGE_KEYS.CALCULATED_FIELDS, []);
    changed = true;
    notes.push(`Cleared ${existing.length} calculated field(s).`);
  }

  // Drop metric cut overrides that targeted calculated field ids (cf_*).
  const boundaries = ctx.getJson<{
    metricCuts?: Record<string, unknown>;
  }>(STORAGE_KEYS.RANKING_BOUNDARIES);
  if (boundaries?.metricCuts && typeof boundaries.metricCuts === 'object') {
    const nextCuts: Record<string, unknown> = {};
    let removed = 0;
    for (const [id, pair] of Object.entries(boundaries.metricCuts)) {
      if (id.startsWith('cf_')) {
        removed += 1;
        continue;
      }
      nextCuts[id] = pair;
    }
    if (removed > 0) {
      ctx.setJson(STORAGE_KEYS.RANKING_BOUNDARIES, {
        ...boundaries,
        metricCuts: nextCuts,
      });
      changed = true;
      notes.push(`Removed ${removed} calculated-field cut override(s).`);
    }
  }

  if (!changed) notes.push('Already current.');
  ctx.log(`008: ${notes.join(' ')}`);
  return { changed, notes };
}
