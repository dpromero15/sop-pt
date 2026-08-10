import type { MigrationContext, MigrationResult } from '../types';
import { STORAGE_KEYS } from '../../storage/storageKeys';
import type { Team } from '../../../types';
import { DEFAULT_TEAM } from '../../../data/initialData';

/**
 * v2 — SOP-PT 2.8 workspace / product hard-gate era.
 * Ensures Team documents have required fields after auth + multi-team UX
 * so older local/cloud snapshots do not throw in the picker or header.
 */
export function migration002SopPtWorkspaceDefaults(
  ctx: MigrationContext,
): MigrationResult {
  const notes: string[] = [];
  let changed = false;

  const team = ctx.getJson<Partial<Team>>(STORAGE_KEYS.TEAM);
  if (team && typeof team === 'object') {
    const next: Team = {
      ...DEFAULT_TEAM,
      ...team,
      id: team.id || DEFAULT_TEAM.id,
      name: team.name || DEFAULT_TEAM.name,
      shortName: team.shortName || team.name?.slice(0, 4) || DEFAULT_TEAM.shortName,
      season: team.season || DEFAULT_TEAM.season,
      ageGroup: team.ageGroup || DEFAULT_TEAM.ageGroup,
      clubName: team.clubName || DEFAULT_TEAM.clubName,
      homeVenue: team.homeVenue || DEFAULT_TEAM.homeVenue,
      primaryColor: team.primaryColor || DEFAULT_TEAM.primaryColor,
      secondaryColor: team.secondaryColor || DEFAULT_TEAM.secondaryColor,
      timezone: team.timezone || DEFAULT_TEAM.timezone,
      updatedAt: team.updatedAt || new Date().toISOString(),
    };
    if (JSON.stringify(team) !== JSON.stringify(next)) {
      ctx.setJson(STORAGE_KEYS.TEAM, next);
      changed = true;
      notes.push('Filled missing Team fields for SOP-PT workspace UI.');
    }
  }

  // Soft-clear obsolete workspace session flag mismatches are handled at runtime;
  // document the contract for agents.
  if (!changed) {
    notes.push('Team workspace shape already compatible with SOP-PT 2.8.');
  }
  ctx.log(`002: ${notes.join(' ')}`);
  return { changed, notes };
}
