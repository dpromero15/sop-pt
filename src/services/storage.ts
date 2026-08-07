import { getAuthState, refreshIdToken } from './firebase';
import { ApiAdapter } from './storage/apiAdapter';
import { getApiBaseUrl, checkConnectionStatus } from './storage/connectionStatus';
import { LocalJsonAdapter } from './storage/localJsonAdapter';
import type { TeamSnapshot } from './storage/types';

const localAdapter = new LocalJsonAdapter();

export const StorageService = localAdapter;

export function subscribeToStorage(listener: () => void): () => void {
  return localAdapter.subscribe(listener);
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
