/** Next eligible player below `currentPlayerId` in roster order (same metric column). */
export function nextEligiblePlayerDown(
  playerIds: string[],
  currentPlayerId: string,
  isEligible: (playerId: string) => boolean,
): string | null {
  const start = playerIds.indexOf(currentPlayerId);
  if (start < 0) return null;
  for (let i = start + 1; i < playerIds.length; i++) {
    const id = playerIds[i];
    if (isEligible(id)) return id;
  }
  return null;
}

export function scoreCellKey(playerId: string, metricId: string): string {
  return `${playerId}:${metricId}`;
}
