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

  it('hydrate with empty remote squad leaves local empty (no sample seed / PUT)', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/snapshot')) {
        return new Response(
          JSON.stringify({
            team: { id: 'team_empty', name: 'Empty FC', updatedAt: 't' },
            players: [],
            sessions: [],
            entries: [],
            metrics: [],
            labels: [],
            formula: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { enterTeamCloudSync, getCloudSyncStatus, __resetCloudSyncForTests } =
      await import('./cloudSync');
    const { StorageService } = await import('../storage');

    await enterTeamCloudSync('team_empty');
    expect(StorageService.getPlayers()).toEqual([]);
    expect(getCloudSyncStatus().status).toBe('synced');
    const writeUrls = fetchMock.mock.calls
      .filter((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')
      .map((c) => String(c[0]));
    expect(writeUrls.some((u) => u.includes('/players'))).toBe(false);
    __resetCloudSyncForTests();
  });

  it('hydrate keeps dirty empty local players over remote roster then flushes', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/snapshot')) {
        return new Response(
          JSON.stringify({
            team: { id: 'team_clear', name: 'Clear FC', updatedAt: 't' },
            players: [
              {
                id: 'p1',
                name: 'ShouldNotKeep',
                jerseyNumber: 9,
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
        );
      }
      return new Response(JSON.stringify({ ok: true, count: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('localStorage', memoryLocalStorage());
    localStorage.setItem(
      'stm_cloud_outbox_v1',
      JSON.stringify({ team_clear: ['players'] }),
    );

    const { enterTeamCloudSync, getCloudSyncStatus, __resetCloudSyncForTests } =
      await import('./cloudSync');
    const { StorageService } = await import('../storage');
    const { scopedStorageKey, STORAGE_KEYS } = await import('./storageKeys');

    StorageService.setTeamScope('team_clear', { holdSeeds: true });
    localStorage.setItem(
      scopedStorageKey('team_clear', STORAGE_KEYS.PLAYERS),
      '[]',
    );

    await enterTeamCloudSync('team_clear');
    expect(StorageService.getPlayers()).toEqual([]);
    await vi.waitFor(() => {
      expect(getCloudSyncStatus().status).toBe('synced');
    });
    const putPlayers = fetchMock.mock.calls.find(
      (c) =>
        String(c[0]).includes('/players') &&
        (c[1] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putPlayers).toBeTruthy();
    const body = JSON.parse(String((putPlayers?.[1] as RequestInit).body));
    expect(body.items).toEqual([]);
    __resetCloudSyncForTests();
  });

  it('queues compliance writes that happen during an in-flight flush', async () => {
    let releasePut: (() => void) | undefined;
    const firstPut = new Promise<void>((resolve) => {
      releasePut = resolve;
    });
    let putCount = 0;
    const putUrls: string[] = [];

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/snapshot')) {
        return new Response(
          JSON.stringify({
            team: { id: 'team_jit', name: 'JIT FC', updatedAt: 't' },
            players: [],
            sessions: [],
            entries: [],
            metrics: [],
            labels: [],
            formula: { id: 'default_formula', name: 'F', weights: [] },
            complianceRequirements: [],
            playerCompliance: {},
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if ((init as RequestInit | undefined)?.method === 'PUT') {
        putUrls.push(url);
        putCount += 1;
        if (putCount === 1) await firstPut;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const {
      enterTeamCloudSync,
      flushNow,
      getPendingSyncBuckets,
      __resetCloudSyncForTests,
    } = await import('./cloudSync');
    const { StorageService } = await import('../storage');
    const { getSyncLog } = await import('./syncLog');

    await enterTeamCloudSync('team_jit');
    StorageService.saveFormula({
      id: 'default_formula',
      name: 'F',
      weights: [{ labelId: 'attendance', weightPercent: 20, enabled: true }],
    });
    const flushing = flushNow('team_jit');
    await vi.waitFor(() => expect(putCount).toBeGreaterThan(0));

    StorageService.setPlayerRequirementComplete(
      'p1',
      'req_grade_check',
      true,
    );
    expect(getPendingSyncBuckets('team_jit')).toContain('playerCompliance');
    expect(
      getSyncLog().some((e) => /queued playercompliance/i.test(e.message)),
    ).toBe(true);

    releasePut?.();
    await flushing;
    await vi.waitFor(() =>
      expect(putUrls.some((u) => u.includes('/config/playerCompliance'))).toBe(
        true,
      ),
    );
    __resetCloudSyncForTests();
  });

  it('keeps transient flush failures as pending retry, not a hard sync error', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/snapshot')) {
        return new Response(
          JSON.stringify({
            team: { id: 'team_blip', name: 'Blip FC', updatedAt: 't' },
            players: [],
            sessions: [],
            entries: [],
            metrics: [],
            labels: [],
            formula: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if ((init as RequestInit | undefined)?.method === 'PUT') {
        throw new TypeError('Failed to fetch');
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const {
      enterTeamCloudSync,
      flushNow,
      getCloudSyncStatus,
      getPendingSyncBuckets,
      __resetCloudSyncForTests,
    } = await import('./cloudSync');
    const { StorageService } = await import('../storage');
    const { getSyncLog } = await import('./syncLog');

    await enterTeamCloudSync('team_blip');
    StorageService.saveFormula({
      id: 'default_formula',
      name: 'F',
      weights: [{ labelId: 'attendance', weightPercent: 20, enabled: true }],
    });
    await flushNow('team_blip');

    const state = getCloudSyncStatus();
    expect(state.status).toBe('pending');
    expect(state.detail).toBe('Retrying…');
    expect(state.detail).not.toMatch(/http/i);
    expect(getPendingSyncBuckets('team_blip')).toContain('formula');
    expect(
      getSyncLog().some((e) => /unreachable|failed to fetch/i.test(e.message)),
    ).toBe(true);

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
