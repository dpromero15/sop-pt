import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import {
  assignDefaultPlayerPositions,
  ensureCatalogCoversCodes,
  normalizePlayerPositions,
  playerPositionCodes,
} from '../../../utils/playerPositions';

function playerCodesFrom(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const codes: string[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    codes.push(...playerPositionCodes(row as Record<string, unknown>));
  }
  return codes;
}

function migratePlayersKey(
  ctx: MigrationContext,
  key: string,
): { touched: boolean; note: string } {
  const raw = ctx.getJson<unknown[] | null>(key);
  if (raw == null) return { touched: false, note: `${key}: absent` };
  if (!Array.isArray(raw)) return { touched: false, note: `${key}: invalid` };
  const result = assignDefaultPlayerPositions(
    raw as Record<string, unknown>[],
  );
  if (!result.changed) {
    return { touched: false, note: `${key}: already current` };
  }
  ctx.setJson(key, result.rows);
  return { touched: true, note: `${key}: assigned positions[]` };
}

function coverCatalog(
  ctx: MigrationContext,
  positionsKey: string,
  codes: string[],
): { touched: boolean; note: string } {
  const raw = ctx.getJson<unknown>(positionsKey);
  if (raw == null) return { touched: false, note: `${positionsKey}: absent` };
  const seeded = normalizePlayerPositions(raw);
  const next = ensureCatalogCoversCodes(seeded, codes);
  if (JSON.stringify(seeded) === JSON.stringify(next)) {
    return { touched: false, note: `${positionsKey}: already covers roster` };
  }
  ctx.setJson(positionsKey, next);
  return { touched: true, note: `${positionsKey}: added extra roster codes` };
}

/** v19 — Players can play multiple positions; backfill positions from primary. */
export function migration019PlayerMultiPositions(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;
  const walkPlayers = (key: string) => {
    const result = migratePlayersKey(ctx, key);
    changed ||= result.touched;
    notes.push(result.note);
  };

  walkPlayers(STORAGE_KEYS.PLAYERS);

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

  const scopedPlayersKey = teamId
    ? scopedStorageKey(teamId, STORAGE_KEYS.PLAYERS)
    : '';
  if (teamId) {
    walkPlayers(scopedPlayersKey);
  } else {
    notes.push('No team id; skipped scoped blobs.');
  }

  const unscopedCodes = playerCodesFrom(ctx.getJson(STORAGE_KEYS.PLAYERS));
  const scopedCodes = scopedPlayersKey
    ? playerCodesFrom(ctx.getJson(scopedPlayersKey))
    : [];

  const cover = (key: string, codes: string[]) => {
    const result = coverCatalog(ctx, key, codes);
    changed ||= result.touched;
    notes.push(result.note);
  };
  cover(STORAGE_KEYS.POSITIONS, unscopedCodes);
  if (teamId) {
    cover(scopedStorageKey(teamId, STORAGE_KEYS.POSITIONS), scopedCodes);
  }

  if (!changed) notes.push('Player positions already current.');
  ctx.log(`019: ${notes.join(' | ')}`);
  return { changed, notes };
}
