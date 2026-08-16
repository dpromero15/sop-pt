import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import {
  cloneDefaultPlayerPositions,
  ensureCatalogCoversCodes,
  normalizePlayerPositions,
} from '../../../utils/playerPositions';

function playerCodesFrom(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) =>
      row && typeof row === 'object'
        ? String((row as { position?: unknown }).position ?? '')
        : '',
    )
    .filter(Boolean);
}

function migratePositionsKey(
  ctx: MigrationContext,
  positionsKey: string,
  playerCodes: string[],
): { touched: boolean; note: string } {
  const raw = ctx.getJson<unknown>(positionsKey);
  const seeded =
    raw == null
      ? cloneDefaultPlayerPositions()
      : normalizePlayerPositions(raw);
  const next = ensureCatalogCoversCodes(seeded, playerCodes);
  const same =
    raw != null &&
    Array.isArray(raw) &&
    JSON.stringify(raw) === JSON.stringify(next);
  if (same) {
    return { touched: false, note: `${positionsKey}: already current` };
  }
  ctx.setJson(positionsKey, next);
  const added = next
    .filter((p) => !seeded.some((s) => s.code === p.code))
    .map((p) => p.code);
  const extra = added.length ? `; kept ${added.join(', ')}` : '';
  return {
    touched: true,
    note: `${positionsKey}: seeded LCB/RCB catalog${extra}`,
  };
}

/** v18 — Team-configurable positions; split CB 4/5 into LCB (5) and RCB (4). */
export function migration018PlayerPositions(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const unscopedPlayers = ctx.getJson<unknown>(STORAGE_KEYS.PLAYERS);
  const unscopedCodes = playerCodesFrom(unscopedPlayers);

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

  const scopedPlayers = teamId
    ? ctx.getJson<unknown>(scopedStorageKey(teamId, STORAGE_KEYS.PLAYERS))
    : null;
  const scopedCodes = playerCodesFrom(scopedPlayers);

  const walk = (key: string, codes: string[]) => {
    const result = migratePositionsKey(ctx, key, codes);
    changed ||= result.touched;
    notes.push(result.note);
  };

  walk(STORAGE_KEYS.POSITIONS, unscopedCodes);
  if (teamId) {
    walk(scopedStorageKey(teamId, STORAGE_KEYS.POSITIONS), scopedCodes);
  } else {
    notes.push('No team id; skipped scoped blobs.');
  }

  if (!changed) notes.push('Position catalogs already current.');
  ctx.log(`018: ${notes.join(' | ')}`);
  return { changed, notes };
}
