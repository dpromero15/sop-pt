import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import { isValidDeletedAt } from '../../../utils/softDelete';

function normalizeDeletedAtList<T extends { deletedAt?: unknown }>(
  ctx: MigrationContext,
  key: string,
): { touched: boolean; note: string } {
  const raw = ctx.getJson<T[] | null>(key);
  if (raw == null) {
    return { touched: false, note: `${key}: absent` };
  }
  if (!Array.isArray(raw)) {
    return { touched: false, note: `${key}: invalid` };
  }
  let changed = false;
  const next = raw.map((row) => {
    if (!row || typeof row !== 'object') return row;
    if (!('deletedAt' in row)) return row;
    if (row.deletedAt == null || row.deletedAt === '') {
      const { deletedAt: _drop, ...rest } = row;
      changed = true;
      return rest as T;
    }
    if (!isValidDeletedAt(row.deletedAt)) {
      const { deletedAt: _drop, ...rest } = row;
      changed = true;
      return rest as T;
    }
    return row;
  });
  if (!changed) {
    return { touched: false, note: `${key}: already current` };
  }
  ctx.setJson(key, next);
  return { touched: true, note: `${key}: normalized deletedAt` };
}

/**
 * v11 — Optional `deletedAt` on players and sessions (soft delete + 90-day purge).
 * Strips empty/invalid timestamps; live records stay unset.
 */
export function migration011SoftDeleteFields(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const walk = (playersKey: string, sessionsKey: string) => {
    const players = normalizeDeletedAtList(ctx, playersKey);
    const sessions = normalizeDeletedAtList(ctx, sessionsKey);
    if (players.touched || sessions.touched) changed = true;
    notes.push(players.note, sessions.note);
  };

  walk(STORAGE_KEYS.PLAYERS, STORAGE_KEYS.SESSIONS);

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
    walk(
      scopedStorageKey(teamId, STORAGE_KEYS.PLAYERS),
      scopedStorageKey(teamId, STORAGE_KEYS.SESSIONS),
    );
  } else {
    notes.push('No team id; skipped scoped blobs.');
  }

  if (!changed) {
    notes.push('No player/session blobs needed updates.');
  }
  ctx.log(`011: ${notes.join(' | ')}`);
  return { changed, notes };
}
