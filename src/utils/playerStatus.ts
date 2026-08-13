import type { Player } from '../types';

/** Cut / not on squad. Record and history stay; excluded from live lists and averages. */
export function isInactivePlayer(player: Player): boolean {
  return player.status === 'inactive';
}

/** Live squad for rankings, lists, and averages (includes injured; excludes inactive). */
export function isRosterPlayer(player: Player): boolean {
  return player.status !== 'inactive';
}

export function rosterPlayers(players: Player[]): Player[] {
  return players.filter(isRosterPlayer);
}

/** Session logger + complete coach ballots (excludes injured and inactive). */
export function isActivePlayer(player: Player): boolean {
  return player.status === 'active';
}

export function activePlayers(players: Player[]): Player[] {
  return players.filter(isActivePlayer);
}
