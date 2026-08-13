import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import { migratePlayerDemographics } from '../../../utils/playerDemographics';

function migratePlayersKey(
  ctx: MigrationContext,
  key: string,
  asOfYear: number,
): { touched: boolean; note: string } {
  const raw = ctx.getJson<unknown[] | null>(key);
  if (raw == null) {
    return { touched: false, note: `${key}: absent` };
  }
  if (!Array.isArray(raw)) {
    return { touched: false, note: `${key}: invalid` };
  }

  let changed = false;
  const next = raw.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const result = migratePlayerDemographics(
      row as Record<string, unknown>,
      asOfYear,
    );
    if (result.changed) changed = true;
    return result.player;
  });

  if (!changed) {
    return { touched: false, note: `${key}: already current` };
  }
  ctx.setJson(key, next);
  return { touched: true, note: `${key}: age → birthYear` };
}

/**
 * v13 — Replace player `age` with `birthYear`; optional `grade` (9–12) stays as-is.
 */
export function migration013PlayerBirthYearGrade(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;
  const asOfYear = new Date().getFullYear();

  const walk = (playersKey: string) => {
    const result = migratePlayersKey(ctx, playersKey, asOfYear);
    if (result.touched) changed = true;
    notes.push(result.note);
  };

  walk(STORAGE_KEYS.PLAYERS);

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
    walk(scopedStorageKey(teamId, STORAGE_KEYS.PLAYERS));
  } else {
    notes.push('No team id; skipped scoped blobs.');
  }

  if (!changed) {
    notes.push('No player blobs needed updates.');
  }
  ctx.log(`013: ${notes.join(' | ')}`);
  return { changed, notes };
}
