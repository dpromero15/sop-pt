import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import type { ScoringFormulaConfig } from '../../../types';
import { ensureAttendanceFormulaWeight } from '../../../utils/formulaWeights';

function migrateFormulaKey(
  ctx: MigrationContext,
  key: string,
): { touched: boolean; note: string } {
  const raw = ctx.getJson<ScoringFormulaConfig | null>(key);
  if (raw == null) {
    return { touched: false, note: `${key}: absent` };
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.weights)) {
    return { touched: false, note: `${key}: invalid formula` };
  }
  const { formula, changed } = ensureAttendanceFormulaWeight(raw);
  if (!changed) {
    return { touched: false, note: `${key}: attendance weight already set` };
  }
  ctx.setJson(key, formula);
  return {
    touched: true,
    note: `${key}: ensured Attendance formula weight`,
  };
}

/**
 * v6 — Attendance is a system default in the total-score formula.
 * Ensure every stored formula has Attendance enabled with a positive weight.
 */
export function migration006AttendanceFormulaWeight(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const unscoped = migrateFormulaKey(ctx, STORAGE_KEYS.FORMULA);
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
    const scoped = migrateFormulaKey(
      ctx,
      scopedStorageKey(teamId, STORAGE_KEYS.FORMULA),
    );
    if (scoped.touched) changed = true;
    notes.push(scoped.note);
  } else {
    notes.push('No team id; skipped scoped formula blob.');
  }

  if (!changed) {
    notes.push('No formula blobs needed updates.');
  }
  ctx.log(`006: ${notes.join(' | ')}`);
  return { changed, notes };
}
