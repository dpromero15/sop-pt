import { describe, expect, it } from 'vitest';
import type { Player, PlayerRanking } from '../types';
import {
  UNASSIGNED_GROUP_ID,
  filterRankingsByGroups,
  formatPlayerSquads,
  isUnassignedPlayer,
  missingSuggestedSubTeams,
  newSubTeamId,
  normalizeSubTeams,
  parseSquadNames,
  playerInEnabledGroups,
  playerSquadIds,
  rankingsForGroup,
  separatedRankingSections,
  stripSquadIdFromPlayers,
} from './subTeams';

const varsity = {
  id: 'st_varsity',
  name: 'Varsity',
  shortName: 'V',
  color: 'emerald',
  sortOrder: 0,
};
const jv = {
  id: 'st_jv',
  name: 'JV',
  shortName: 'JV',
  color: 'blue',
  sortOrder: 1,
};
const catalog = [varsity, jv];

function player(
  id: string,
  squadIds?: string[],
): Player {
  return {
    id,
    name: id,
    jerseyNumber: 1,
    position: 'ST',
    preferredFoot: 'Right',
    joinedDate: '2026-01-01',
    status: 'active',
    squadIds,
  };
}

function ranking(id: string, squadIds?: string[], score = 80): PlayerRanking {
  return {
    player: player(id, squadIds),
    totalScore: score,
    adjustedTotalScore: score,
    overallRank: 1,
    adjustedRank: 1,
    coachesTotalSum: null,
    coachesRank: null,
    adjustedBump: 0,
    eligibleToPlay: true,
    labelScores: {},
    rank: 1,
    attendanceRate: null,
    recentTrend: 'stable',
    calculatedValues: {},
  };
}

describe('subTeams', () => {
  it('normalizes catalog rows and drops duplicates', () => {
    const next = normalizeSubTeams([
      { id: 'st_jv', name: 'JV', shortName: 'JV', color: 'blue', sortOrder: 2 },
      { id: 'st_varsity', name: 'Varsity', color: 'nope', sortOrder: 1 },
      { id: 'st_jv', name: 'Dup', shortName: 'D', color: 'rose', sortOrder: 0 },
      { id: '', name: 'Nope' },
    ]);
    expect(next.map((row) => row.id)).toEqual(['st_varsity', 'st_jv']);
    expect(next[0].color).toBe('emerald');
    expect(next[0].shortName).toBe('Var');
  });

  it('assigns unique ids from names', () => {
    expect(newSubTeamId('Varsity', [])).toBe('st_varsity');
    expect(newSubTeamId('Varsity', ['st_varsity'])).toBe('st_varsity_2');
  });

  it('treats empty membership as unassigned and ignores unknown ids', () => {
    expect(playerSquadIds(player('a'), catalog)).toEqual([]);
    expect(isUnassignedPlayer(player('a', ['ghost']), catalog)).toBe(true);
    expect(playerSquadIds(player('b', ['st_varsity', 'st_jv', 'st_varsity']), catalog)).toEqual([
      'st_varsity',
      'st_jv',
    ]);
  });

  it('combined filter keeps dual-rostered players when one group is off', () => {
    const rows = [
      ranking('v', ['st_varsity'], 90),
      ranking('both', ['st_varsity', 'st_jv'], 80),
      ranking('j', ['st_jv'], 70),
      ranking('none', [], 60),
    ];
    const filtered = filterRankingsByGroups(
      rows,
      catalog,
      new Set(['st_jv', UNASSIGNED_GROUP_ID]),
    );
    expect(filtered.map((r) => r.player.id)).toEqual(['v', 'both']);
    expect(playerInEnabledGroups(player('both', ['st_varsity', 'st_jv']), catalog, new Set(['st_jv']))).toBe(true);
  });

  it('separated lists give each group its own members including dual-rostered', () => {
    const rows = [
      ranking('v', ['st_varsity'], 90),
      ranking('both', ['st_varsity', 'st_jv'], 80),
      ranking('j', ['st_jv'], 70),
    ];
    const sections = separatedRankingSections(rows, catalog, new Set(), false);
    expect(sections.map((s) => s.title)).toEqual(['Varsity', 'JV']);
    expect(sections[0].rows.map((r) => r.player.id)).toEqual(['v', 'both']);
    expect(sections[1].rows.map((r) => r.player.id)).toEqual(['both', 'j']);
    expect(rankingsForGroup(rows, catalog, 'st_jv').map((r) => r.player.id)).toEqual([
      'both',
      'j',
    ]);
  });

  it('parses CSV names and formats short names', () => {
    const parsed = parseSquadNames('Varsity; jv ; Ghost', catalog);
    expect(parsed.ids).toEqual(['st_varsity', 'st_jv']);
    expect(parsed.unknown).toEqual(['Ghost']);
    expect(formatPlayerSquads(player('a', ['st_varsity', 'st_jv']), catalog)).toBe(
      'V;JV',
    );
  });

  it('strips a deleted group from player memberships', () => {
    const next = stripSquadIdFromPlayers(
      [player('a', ['st_varsity', 'st_jv']), player('b', ['st_jv'])],
      'st_jv',
    );
    expect(next[0].squadIds).toEqual(['st_varsity']);
    expect(next[1].squadIds).toBeUndefined();
  });

  it('suggests missing Varsity / JV / C-Team defaults', () => {
    expect(missingSuggestedSubTeams([varsity]).map((r) => r.name)).toEqual([
      'JV',
      'C-Team',
    ]);
  });
});
