import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = {
  signedIn: true,
  idToken: 'test-token',
  email: 'coach@example.com',
  uid: 'u1',
};

vi.mock('../firebase', () => ({
  getAuthState: () => auth,
  refreshIdToken: async () => auth.idToken,
  isLocalDebugMockAuth: () => false,
}));

vi.mock('./connectionStatus', () => ({
  getApiBaseUrl: () => 'http://api.test',
  isForceLocal: () => false,
}));

import { LocalJsonAdapter } from './localJsonAdapter';
import { STORAGE_KEYS } from './storageKeys';

function memoryLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
}

describe('cloudSync', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('hydrates remote players onto the scoped team cache', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          team: { id: 'team_cloud', name: 'Imported FC', updatedAt: 't' },
          players: [
            {
              id: 'p1',
              name: 'Ada',
              jerseyNumber: 10,
              position: 'ST',
              preferredFoot: 'R',
              joinedDate: '2026-01-01',
              status: 'active',
            },
          ],
          sessions: [],
          entries: [],
          metrics: [],
          labels: [],
          formula: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { enterTeamCloudSync, getCloudSyncStatus, __resetCloudSyncForTests } =
      await import('./cloudSync');
    const { StorageService } = await import('../storage');

    await enterTeamCloudSync('team_cloud');
    expect(StorageService.getPlayers().map((p) => p.name)).toContain('Ada');
    expect(getCloudSyncStatus().status).toBe('synced');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/v1/teams/team_cloud/snapshot',
    );
    __resetCloudSyncForTests();
  });

  it('maps storage keys to dirty outbox buckets', () => {
    const adapter = new LocalJsonAdapter();
    adapter.setTeamScope('team_x');
    adapter.savePlayers([]);
    expect(adapter.getTeamScopeId()).toBe('team_x');
    expect(STORAGE_KEYS.PLAYERS).toBe('stm_players_v1');
  });
});
