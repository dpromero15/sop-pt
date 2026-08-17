/** Remembered workspace team (unscoped). */
export const ACTIVE_TEAM_KEY = 'stm_active_team_id_v1';

/** Per-team cache prefix: `stm_t/{teamId}/{blobKey}`. */
export const TEAM_SCOPE_PREFIX = 'stm_t';

/** Canonical localStorage keys for SOP-PT domain blobs (legacy / unscoped). */
export const STORAGE_KEYS = {
  TEAM: 'stm_team_v1',
  PLAYERS: 'stm_players_v1',
  SESSIONS: 'stm_sessions_v1',
  ENTRIES: 'stm_entries_v1',
  METRICS: 'stm_metrics_v1',
  LABELS: 'stm_labels_v1',
  FORMULA: 'stm_formula_v1',
  CALCULATED_FIELDS: 'stm_calculated_fields_v1',
  COACHES: 'stm_coaches_v1',
  COACH_BALLOTS: 'stm_coach_ballots_v1',
  ADJUSTED_BUMPS: 'stm_adjusted_bumps_v1',
  BUMP_BUDGET: 'stm_bump_budget_v1',
  COMPLIANCE_REQUIREMENTS: 'stm_compliance_requirements_v1',
  PLAYER_COMPLIANCE: 'stm_player_compliance_v1',
  EQUIPMENT_GROUPS: 'stm_equipment_groups_v1',
  EQUIPMENT_ITEMS: 'stm_equipment_items_v1',
  RANKING_BOUNDARIES: 'stm_ranking_boundaries_v1',
  POSITIONS: 'stm_positions_v1',
  SUB_TEAMS: 'stm_sub_teams_v1',
  COACH_POSITION_BALLOTS: 'stm_coach_position_ballots_v1',
} as const;

export type StorageBlobKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function sanitizeTeamId(teamId: string): string {
  return teamId.trim().replace(/[^\w.-]+/g, '_') || 'default';
}

export function scopedStorageKey(teamId: string, key: string): string {
  return `${TEAM_SCOPE_PREFIX}/${sanitizeTeamId(teamId)}/${key}`;
}

export const ALL_STORAGE_BLOB_KEYS: StorageBlobKey[] = Object.values(STORAGE_KEYS);
