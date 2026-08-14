import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import { assignDefaultPlayerRankingPools } from '../../../utils/playerRankingPools';

function migratePlayersKey(
  ctx: MigrationContext,
  key: string,
): { touched: boolean; note: string } {
  const raw = ctx.getJson<unknown[] | null>(key);
  if (raw == null) return { touched: false, note: `${key}: absent` };
  if (!Array.isArray(raw)) return { touched: false, note: `${key}: invalid` };

  const result = assignDefaultPlayerRankingPools(
    raw as Record<string, unknown>[],
  );
  if (!result.changed) {
    return { touched: false, note: `${key}: already current` };
  }
  ctx.setJson(key, result.rows);
  return { touched: true, note: `${key}: assigned ranking pools` };
}

/** v17 — Backfill the editable Coaches Rank pool from each player's position. */
export function migration017PlayerRankingPool(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;
  const walk = (key: string) => {
    const result = migratePlayersKey(ctx, key);
    changed ||= result.touched;
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

  if (!changed) notes.push('No player blobs needed ranking pools.');
  ctx.log(`017: ${notes.join(' | ')}`);
  return { changed, notes };
}
