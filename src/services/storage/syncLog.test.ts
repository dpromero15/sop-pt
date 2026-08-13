import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSyncLogForTests,
  appendSyncLog,
  clearSyncLog,
  getSyncLog,
} from './syncLog';

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

describe('syncLog', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    __resetSyncLogForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __resetSyncLogForTests();
  });

  it('appends events and keeps a ring buffer', () => {
    appendSyncLog('info', 'hydrate');
    appendSyncLog('error', 'Sync failed', { buckets: ['formula'] });
    const log = getSyncLog();
    expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({
      level: 'error',
      message: 'Sync failed',
      buckets: ['formula'],
    });
    expect(log[1].at).toBeTruthy();
  });

  it('clears the persisted log', () => {
    appendSyncLog('warn', 'offline');
    clearSyncLog();
    expect(getSyncLog()).toEqual([]);
  });
});
