import { describe, expect, it } from 'vitest';
import type { Player } from '../types';
import {
  activePlayers,
  isActivePlayer,
  isInactivePlayer,
  isRosterPlayer,
  rosterPlayers,
} from './playerStatus';

function player(id: string, status: Player['status']): Player {
  return {
    id,
    name: id,
    jerseyNumber: 1,
    position: 'ST',
    preferredFoot: 'Right',
    joinedDate: '2026-01-01',
    status,
  };
}

const squad = [
  player('a', 'active'),
  player('i', 'injured'),
  player('x', 'inactive'),
];

describe('playerStatus', () => {
  it('treats inactive as off the live roster', () => {
    expect(isInactivePlayer(squad[2])).toBe(true);
    expect(isRosterPlayer(squad[0])).toBe(true);
    expect(isRosterPlayer(squad[1])).toBe(true);
    expect(isRosterPlayer(squad[2])).toBe(false);
    expect(rosterPlayers(squad).map((p) => p.id)).toEqual(['a', 'i']);
  });

  it('limits active (logger / ballots) to status active', () => {
    expect(isActivePlayer(squad[0])).toBe(true);
    expect(isActivePlayer(squad[1])).toBe(false);
    expect(activePlayers(squad).map((p) => p.id)).toEqual(['a']);
  });
});
