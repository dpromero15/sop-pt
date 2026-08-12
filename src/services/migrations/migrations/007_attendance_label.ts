import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import type { LabelDefinition } from '../../../types';
import { ensureAttendanceLabel } from '../../../utils/formulaWeights';

function migrateLabelsKey(
  ctx: MigrationContext,
  key: string,
): { touched: boolean; note: string } {
  const raw = ctx.getJson<LabelDefinition[] | null>(key);
  if (raw == null) {
    return { touched: false, note: `${key}: absent` };
  }
  if (!Array.isArray(raw)) {
    return { touched: false, note: `${key}: invalid labels` };
  }
  const { labels, changed } = ensureAttendanceLabel(raw);
  if (!changed) {
    return { touched: false, note: `${key}: attendance label already present` };
  }
  ctx.setJson(key, labels);
  return {
    touched: true,
    note: `${key}: ensured Attendance system label`,
  };
}

/**
 * v7 — Attendance category label must exist (Active Weights + formula UI).
 * Restores a missing Attendance label and marks it system.
 */
export function migration007AttendanceLabel(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const unscoped = migrateLabelsKey(ctx, STORAGE_KEYS.LABELS);
  if (unscoped.touched) changed = true;
  notes.push(unscoped.note);

  let teamId = '';
  try {
    teamId = (ctx.storage.getItem(ACTIVE_TEAM_KEY) ?? '').trim();
  } catch {
    teamId = '';
  }
  if (!teamId) {
    const team = ctx.getJson<{ id?: string }>(STORAGE_KEYS.TEAM);
    teamId = team?.id?.trim() ?? '';
  }

  if (teamId) {
    const scoped = migrateLabelsKey(
      ctx,
      scopedStorageKey(teamId, STORAGE_KEYS.LABELS),
    );
    if (scoped.touched) changed = true;
    notes.push(scoped.note);
  } else {
    notes.push('No team id; skipped scoped labels blob.');
  }

  if (!changed) {
    notes.push('No labels blobs needed updates.');
  }
  ctx.log(`007: ${notes.join(' | ')}`);
  return { changed, notes };
}
