import type { Player, PlayerRanking, SubTeam } from '../types';

/** Filter chip id for players with no sub-team membership. */
export const UNASSIGNED_GROUP_ID = 'unassigned';

export const SUB_TEAM_COLOR_IDS = [
  'emerald',
  'blue',
  'amber',
  'purple',
  'rose',
  'indigo',
  'cyan',
] as const;

export type SubTeamColorId = (typeof SUB_TEAM_COLOR_IDS)[number];

export const SUGGESTED_SUB_TEAMS: Array<
  Pick<SubTeam, 'name' | 'shortName' | 'color'>
> = [
  { name: 'Varsity', shortName: 'V', color: 'emerald' },
  { name: 'JV', shortName: 'JV', color: 'blue' },
  { name: 'C-Team', shortName: 'C', color: 'amber' },
];

const COLOR_CHIP: Record<string, string> = {
  emerald: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  blue: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
  amber: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  purple: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
  rose: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
  indigo: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40',
  cyan: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40',
};

export function isSubTeamColor(value: string): value is SubTeamColorId {
  return (SUB_TEAM_COLOR_IDS as readonly string[]).includes(value);
}

export function subTeamChipClass(color: string): string {
  return COLOR_CHIP[color] ?? COLOR_CHIP.emerald;
}

function slugPart(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return slug || 'group';
}

export function newSubTeamId(name: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  const base = `st_${slugPart(name)}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

export function normalizeSubTeams(raw: unknown): SubTeam[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const rows: SubTeam[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? '').trim();
    const name = String(row.name ?? '').trim();
    if (!id || !name || seen.has(id)) return;
    seen.add(id);
    const shortName = String(row.shortName ?? '').trim() || name.slice(0, 3);
    const color = isSubTeamColor(String(row.color ?? ''))
      ? String(row.color)
      : 'emerald';
    const sortOrder = Number.isFinite(Number(row.sortOrder))
      ? Number(row.sortOrder)
      : index;
    rows.push({ id, name, shortName, color, sortOrder });
  });
  return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function sortedSubTeams(subTeams: SubTeam[]): SubTeam[] {
  return [...subTeams].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

export function playerSquadIds(
  player: Pick<Player, 'squadIds'>,
  catalog: SubTeam[],
): string[] {
  const known = new Set(catalog.map((row) => row.id));
  const ids = Array.isArray(player.squadIds) ? player.squadIds : [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of ids) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

export function isUnassignedPlayer(
  player: Pick<Player, 'squadIds'>,
  catalog: SubTeam[],
): boolean {
  return playerSquadIds(player, catalog).length === 0;
}

export function subTeamById(
  catalog: SubTeam[],
  id: string,
): SubTeam | undefined {
  return catalog.find((row) => row.id === id);
}

/** True when this player belongs to at least one enabled group. */
export function playerInEnabledGroups(
  player: Pick<Player, 'squadIds'>,
  catalog: SubTeam[],
  disabledGroupIds: ReadonlySet<string>,
): boolean {
  const ids = playerSquadIds(player, catalog);
  if (ids.length === 0) return !disabledGroupIds.has(UNASSIGNED_GROUP_ID);
  return ids.some((id) => !disabledGroupIds.has(id));
}

export function filterRankingsByGroups<T extends { player: Player }>(
  rankings: T[],
  catalog: SubTeam[],
  disabledGroupIds: ReadonlySet<string>,
): T[] {
  if (catalog.length === 0) return rankings;
  return rankings.filter((row) =>
    playerInEnabledGroups(row.player, catalog, disabledGroupIds),
  );
}

export function rankingsForGroup<T extends { player: Player }>(
  rankings: T[],
  catalog: SubTeam[],
  groupId: string,
): T[] {
  if (groupId === UNASSIGNED_GROUP_ID) {
    return rankings.filter((row) => isUnassignedPlayer(row.player, catalog));
  }
  return rankings.filter((row) =>
    playerSquadIds(row.player, catalog).includes(groupId),
  );
}

export function hasUnassignedPlayers(
  players: Array<Pick<Player, 'squadIds'>>,
  catalog: SubTeam[],
): boolean {
  return players.some((player) => isUnassignedPlayer(player, catalog));
}

export function matchSubTeamByName(
  catalog: SubTeam[],
  raw: string,
): SubTeam | undefined {
  const needle = raw.trim().toLowerCase();
  if (!needle) return undefined;
  return catalog.find(
    (row) =>
      row.name.toLowerCase() === needle ||
      row.shortName.toLowerCase() === needle ||
      row.id.toLowerCase() === needle,
  );
}

export function parseSquadNames(
  cell: string,
  catalog: SubTeam[],
): { ids: string[]; unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  for (const part of cell.split(/[;|,]/)) {
    const token = part.trim();
    if (!token) continue;
    const match = matchSubTeamByName(catalog, token);
    if (!match) {
      unknown.push(token);
      continue;
    }
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    ids.push(match.id);
  }
  return { ids, unknown };
}

export function formatPlayerSquads(
  player: Pick<Player, 'squadIds'>,
  catalog: SubTeam[],
): string {
  return playerSquadIds(player, catalog)
    .map((id) => subTeamById(catalog, id)?.shortName ?? id)
    .join(';');
}

export function stripSquadIdFromPlayers(
  players: Player[],
  squadId: string,
): Player[] {
  return players.map((player) => {
    const ids = Array.isArray(player.squadIds) ? player.squadIds : [];
    if (!ids.includes(squadId)) return player;
    const next = ids.filter((id) => id !== squadId);
    return { ...player, squadIds: next.length ? next : undefined };
  });
}

/** Suggested Varsity / JV / C-Team rows that are not already in the catalog. */
export function missingSuggestedSubTeams(catalog: SubTeam[]): typeof SUGGESTED_SUB_TEAMS {
  const names = new Set(catalog.map((row) => row.name.toLowerCase()));
  return SUGGESTED_SUB_TEAMS.filter((row) => !names.has(row.name.toLowerCase()));
}

export type RankingGroupSection<T extends { player: Player } = PlayerRanking> = {
  id: string;
  title: string;
  rows: T[];
};

export function separatedRankingSections<T extends { player: Player }>(
  rankings: T[],
  catalog: SubTeam[],
  disabledGroupIds: ReadonlySet<string>,
  includeUnassigned: boolean,
): RankingGroupSection<T>[] {
  const sections: RankingGroupSection<T>[] = [];
  for (const team of sortedSubTeams(catalog)) {
    if (disabledGroupIds.has(team.id)) continue;
    sections.push({
      id: team.id,
      title: team.name,
      rows: rankingsForGroup(rankings, catalog, team.id),
    });
  }
  if (includeUnassigned && !disabledGroupIds.has(UNASSIGNED_GROUP_ID)) {
    sections.push({
      id: UNASSIGNED_GROUP_ID,
      title: 'Unassigned',
      rows: rankingsForGroup(rankings, catalog, UNASSIGNED_GROUP_ID),
    });
  }
  return sections;
}
