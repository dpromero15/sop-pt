import type { MigrationContext, MigrationResult } from '../types';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from '../../storage/storageKeys';
import { normalizeSubTeams } from '../../../utils/subTeams';

function migrateSubTeamsKey(
  ctx: MigrationContext,
  key: string,
): { touched: boolean; note: string } {
  const raw = ctx.getJson<unknown>(key);
  const next = normalizeSubTeams(raw ?? []);
  const same =
    raw != null &&
    Array.isArray(raw) &&
    JSON.stringify(raw) === JSON.stringify(next);
  if (same) {
    return { touched: false, note: `${key}: already current` };
  }
  ctx.setJson(key, next);
  if (raw == null) {
    return { touched: true, note: `${key}: seeded empty catalog` };
  }
  return { touched: true, note: `${key}: normalized catalog` };
}

/** v20 — Team-configurable sub-teams (Varsity / JV / C-team). Empty until coaches add groups. */
export function migration020SubTeams(ctx: MigrationContext): MigrationResult {
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

  const walk = (key: string) => {
    const result = migrateSubTeamsKey(ctx, key);
    changed ||= result.touched;
    notes.push(result.note);
  };

  walk(STORAGE_KEYS.SUB_TEAMS);
  if (teamId) {
    walk(scopedStorageKey(teamId, STORAGE_KEYS.SUB_TEAMS));
  }

  if (!changed) notes.push('Sub-team catalog already current.');
  ctx.log(`020: ${notes.join(' | ')}`);
  return { changed, notes };
}
