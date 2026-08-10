import { getAuthState, refreshIdToken } from './firebase';
import { ApiAdapter } from './storage/apiAdapter';
import { getApiBaseUrl, checkConnectionStatus } from './storage/connectionStatus';
import { LocalJsonAdapter } from './storage/localJsonAdapter';
import type { TeamSnapshot } from './storage/types';
import {
  runLocalMigrations,
  writeStoredSchemaVersion,
} from './migrations/runner';

const localAdapter = new LocalJsonAdapter();

export const StorageService = localAdapter;

export function subscribeToStorage(listener: () => void): () => void {
  return localAdapter.subscribe(listener);
}

/** After importing cloud/backup payloads, re-apply migrations to adapted shapes. */
function migrateImportedLocalData(): void {
  if (typeof localStorage === 'undefined') return;
  writeStoredSchemaVersion(localStorage, 0);
  const report = runLocalMigrations(localStorage);
  if (report.error) {
    console.error('[sop-pt] post-import migration failed', report);
  }
}

export async function bootstrapLocalToCloud(): Promise<void> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error('VITE_API_BASE_URL is not set.');

  let token = getAuthState().idToken;
  if (!token) token = await refreshIdToken();
  if (!token) throw new Error('Admin must be signed in.');

  const status = await checkConnectionStatus();
  if (status.mode !== 'cloud' && !status.apiHealthy) {
    throw new Error(status.message);
  }

  const snapshot = localAdapter.getSnapshot();
  const api = new ApiAdapter(baseUrl);
  await api.bootstrap(snapshot.team.id, snapshot, token);
}

export async function hydrateCloudToLocal(): Promise<TeamSnapshot> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error('VITE_API_BASE_URL is not set.');

  let token = getAuthState().idToken;
  if (!token) token = await refreshIdToken();
  if (!token) throw new Error('Admin must be signed in.');

  const teamId = localAdapter.getTeam().id;
  const api = new ApiAdapter(baseUrl);
  const snapshot = await api.hydrate(teamId, token);
  localAdapter.saveTeam(snapshot.team);
  localAdapter.savePlayers(snapshot.players);
  localAdapter.saveSessions(snapshot.sessions);
  localAdapter.saveEntries(snapshot.entries);
  localAdapter.saveMetrics(snapshot.metrics);
  localAdapter.saveLabels(snapshot.labels);
  localAdapter.saveFormula(snapshot.formula);
  if (snapshot.calculatedFields) {
    localAdapter.saveCalculatedFields(snapshot.calculatedFields);
  }
  if (snapshot.coaches) localAdapter.saveCoaches(snapshot.coaches);
  if (snapshot.coachBallots) localAdapter.saveCoachBallots(snapshot.coachBallots);
  if (snapshot.bumpTransactions) {
    localAdapter.saveBumpTransactions(snapshot.bumpTransactions);
  } else if (snapshot.adjustedBumps) {
    localAdapter.saveAdjustedBumps(snapshot.adjustedBumps);
  }
  if (snapshot.bumpBudget) localAdapter.saveBumpBudget(snapshot.bumpBudget);
  if (snapshot.complianceRequirements) {
    localAdapter.saveComplianceRequirements(snapshot.complianceRequirements);
  }
  if (snapshot.playerCompliance) {
    localAdapter.savePlayerCompliance(snapshot.playerCompliance);
  }
  if (snapshot.equipmentGroups) {
    localAdapter.saveEquipmentGroups(snapshot.equipmentGroups);
  }
  if (snapshot.equipmentItems) {
    localAdapter.saveEquipmentItems(snapshot.equipmentItems);
  }
  if (snapshot.rankingBoundaries) {
    localAdapter.saveRankingBoundaries(snapshot.rankingBoundaries);
  }
  migrateImportedLocalData();
  return snapshot;
}

export async function pushTeamToCloud(): Promise<void> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return;

  let token = getAuthState().idToken;
  if (!token) token = await refreshIdToken();
  if (!token) return;

  const team = localAdapter.getTeam();
  const api = new ApiAdapter(baseUrl);
  await api.putTeam(team.id, team, token);
}
