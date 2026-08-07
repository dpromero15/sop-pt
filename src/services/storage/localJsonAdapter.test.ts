import { describe, it, expect, beforeEach } from 'vitest';
import { LocalJsonAdapter, STORAGE_KEYS } from './localJsonAdapter';
import { DEFAULT_TEAM } from '../../data/initialData';

function memoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    map,
  };
}

describe('LocalJsonAdapter', () => {
  let adapter: LocalJsonAdapter;
  let store: ReturnType<typeof memoryStore>;

  beforeEach(() => {
    store = memoryStore();
    adapter = new LocalJsonAdapter(store);
  });

  it('seeds and persists separated team blob', () => {
    const team = adapter.getTeam();
    expect(team.name).toBe(DEFAULT_TEAM.name);
    expect(store.map.has(STORAGE_KEYS.TEAM)).toBe(true);

    adapter.saveTeam({ ...team, name: 'Storm United' });
    expect(adapter.getTeam().name).toBe('Storm United');
  });

  it('keeps collections on separate keys', () => {
    adapter.getPlayers();
    adapter.getSessions();
    adapter.getEntries();
    adapter.getMetrics();
    adapter.getLabels();
    adapter.getFormula();
    adapter.getTeam();

    expect(store.map.has(STORAGE_KEYS.PLAYERS)).toBe(true);
    expect(store.map.has(STORAGE_KEYS.SESSIONS)).toBe(true);
    expect(store.map.has(STORAGE_KEYS.ENTRIES)).toBe(true);
    expect(store.map.has(STORAGE_KEYS.METRICS)).toBe(true);
    expect(store.map.has(STORAGE_KEYS.LABELS)).toBe(true);
    expect(store.map.has(STORAGE_KEYS.FORMULA)).toBe(true);
    expect(store.map.has(STORAGE_KEYS.TEAM)).toBe(true);
  });

  it('updateTeam merges fields and bumps updatedAt', () => {
    const before = adapter.getTeam();
    const next = adapter.updateTeam({ id: before.id, shortName: 'STM' });
    expect(next.shortName).toBe('STM');
    expect(next.name).toBe(before.name);
    expect(next.updatedAt >= before.updatedAt).toBe(true);
  });

  it('export/import includes team', () => {
    adapter.saveTeam({ ...adapter.getTeam(), name: 'Export FC' });
    const json = adapter.exportFullBackupJSON();
    const other = new LocalJsonAdapter(memoryStore());
    expect(other.importFullBackupJSON(json)).toBe(true);
    expect(other.getTeam().name).toBe('Export FC');
  });
});
