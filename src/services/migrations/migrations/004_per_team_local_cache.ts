import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  ALL_STORAGE_BLOB_KEYS,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';

/**
 * Copy legacy unscoped blobs onto `stm_t/{teamId}/…` so each squad has its
 * own cache. Leaves unscoped keys in place (idempotent / rollback-friendly).
 */
export function migration004PerTeamLocalCache(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

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

  if (!teamId) {
    notes.push('No team id yet; nothing to namespace.');
    ctx.log(`004: ${notes.join(' ')}`);
    return { changed: false, notes };
  }

  ctx.storage.setItem(ACTIVE_TEAM_KEY, teamId);

  for (const key of ALL_STORAGE_BLOB_KEYS) {
    const raw = ctx.storage.getItem(key);
    if (raw == null) continue;
    const scoped = scopedStorageKey(teamId, key);
    if (ctx.storage.getItem(scoped) != null) continue;
    ctx.storage.setItem(scoped, raw);
    changed = true;
  }

  notes.push(
    changed
      ? `Copied unscoped blobs onto team cache ${teamId}.`
      : 'Team cache already present.',
  );
  ctx.log(`004: ${notes.join(' ')}`);
  return { changed, notes };
}
