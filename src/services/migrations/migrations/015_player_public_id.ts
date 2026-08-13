import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import { assignPlayerPublicIds } from '../../../utils/playerPublicId';

function migratePlayersKey(
  ctx: MigrationContext,
  key: string,
): { touched: boolean; note: string } {
  const raw = ctx.getJson<unknown[] | null>(key);
  if (raw == null) {
    return { touched: false, note: `${key}: absent` };
  }
  if (!Array.isArray(raw)) {
    return { touched: false, note: `${key}: invalid` };
  }

  const result = assignPlayerPublicIds(raw as Record<string, unknown>[]);
  if (!result.changed) {
    return { touched: false, note: `${key}: already current` };
  }
  ctx.setJson(key, result.rows);
  return { touched: true, note: `${key}: assigned publicId` };
}

/**
 * v15 — Stable short Player ID (`publicId`) for printouts and the team legend.
 */
export function migration015PlayerPublicId(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const walk = (playersKey: string) => {
    const result = migratePlayersKey(ctx, playersKey);
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
    notes.push('No player blobs needed publicId.');
  }
  ctx.log(`015: ${notes.join(' | ')}`);
  return { changed, notes };
}
