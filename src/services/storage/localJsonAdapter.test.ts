import { describe, it, expect, beforeEach } from 'vitest';
import { LocalJsonAdapter, STORAGE_KEYS } from './localJsonAdapter';
import { scopedStorageKey } from './storageKeys';
import { DEFAULT_TEAM } from '../../data/initialData';

function scoped(key: string) {
  return scopedStorageKey(DEFAULT_TEAM.id, key);
}

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
    expect(store.map.has(scoped(STORAGE_KEYS.TEAM))).toBe(true);

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

    expect(store.map.has(scoped(STORAGE_KEYS.PLAYERS))).toBe(true);
    expect(store.map.has(scoped(STORAGE_KEYS.SESSIONS))).toBe(true);
    expect(store.map.has(scoped(STORAGE_KEYS.ENTRIES))).toBe(true);
    expect(store.map.has(scoped(STORAGE_KEYS.METRICS))).toBe(true);
    expect(store.map.has(scoped(STORAGE_KEYS.LABELS))).toBe(true);
    expect(store.map.has(scoped(STORAGE_KEYS.FORMULA))).toBe(true);
    expect(store.map.has(scoped(STORAGE_KEYS.TEAM))).toBe(true);
  });

  it('updateTeam merges fields and bumps updatedAt', () => {
    const before = adapter.getTeam();
    const next = adapter.updateTeam({ id: before.id, shortName: 'STM' });
    expect(next.shortName).toBe('STM');
    expect(next.name).toBe(before.name);
    expect(next.updatedAt >= before.updatedAt).toBe(true);
  });

  it('seeds attendance metricIds on new sessions', () => {
    const session = adapter.addSession({
      title: 'Evening Practice',
      date: '2026-08-10',
      type: 'session',
      metricIds: [],
    });
    expect(session.metricIds[0]).toBe('m_attendance');
    expect(session.metricIds).toEqual(['m_attendance']);
    expect(session.status).toBe('open');
  });

  it('seeds match default game pack when metricIds omitted', () => {
    const session = adapter.addSession({
      title: 'League Match',
      date: '2026-08-11',
      type: 'match',
      opponent: 'Rivals FC',
      metricIds: [],
    });
    expect(session.metricIds).toEqual([
      'm_attendance',
      'm_goals',
      'm_assists',
      'm_tackles',
    ]);
  });

  it('migrates legacy sessions missing metricIds and status', () => {
    store.setItem(
      STORAGE_KEYS.SESSIONS,
      JSON.stringify([
        {
          id: 'sess_legacy',
          date: '2026-08-01',
          title: 'Legacy',
          type: 'session',
        },
      ]),
    );
    store.setItem(
      STORAGE_KEYS.ENTRIES,
      JSON.stringify([
        {
          id: 'e1',
          sessionId: 'sess_legacy',
          playerId: 'p1',
          metricId: 'm_juggling',
          value: 10,
          timestamp: '2026-08-01',
        },
      ]),
    );
    const sessions = adapter.getSessions();
    expect(sessions[0].metricIds[0]).toBe('m_attendance');
    expect(sessions[0].metricIds).toContain('m_juggling');
    expect(sessions[0].status).toBe('open');
  });

  it('persists closed session status', () => {
    const session = adapter.addSession({
      title: 'To Close',
      date: '2026-08-12',
      type: 'session',
      metricIds: [],
    });
    adapter.updateSession({ ...session, status: 'closed' });
    expect(adapter.getSessions().find((s) => s.id === session.id)?.status).toBe('closed');
  });

  it('export/import includes team', () => {
    adapter.saveTeam({ ...adapter.getTeam(), name: 'Export FC' });
    const json = adapter.exportFullBackupJSON();
    const other = new LocalJsonAdapter(memoryStore());
    expect(other.importFullBackupJSON(json)).toBe(true);
    expect(other.getTeam().name).toBe('Export FC');
  });

  it('migrates metrics missing aggregationMode', () => {
    store.setItem(
      STORAGE_KEYS.METRICS,
      JSON.stringify([
        {
          id: 'm_40m_dash',
          name: '40 Meter Dash',
          labelId: 'speed',
          type: 'time_seconds',
          unit: 's',
          higherIsBetter: false,
        },
      ]),
    );
    const metrics = adapter.getMetrics();
    expect(metrics[0].aggregationMode).toBe('best');
    expect(metrics[0].includeInAdjustedTotal).toBe(true);
    expect(metrics[0].treatNoScoreAsZero).toBe(true);
  });

  it('loads calculated fields catalog', () => {
    const fields = adapter.getCalculatedFields();
    expect(fields.some((f) => f.id === 'cf_40m_avg')).toBe(true);
    expect(fields.every((f) => f.enabled === false)).toBe(true);
    adapter.updateCalculatedField({ ...fields[0], enabled: true });
    expect(
      adapter.getCalculatedFields().find((f) => f.id === fields[0].id)?.enabled,
    ).toBe(true);
  });

  it('migrates attendance label to system: true', () => {
    store.setItem(
      STORAGE_KEYS.LABELS,
      JSON.stringify([
        {
          id: 'attendance',
          name: 'Attendance',
          description: 'd',
          color: 'emerald',
          badgeBg: '',
          badgeText: '',
        },
        {
          id: 'speed',
          name: 'Speed',
          description: 'd',
          color: 'blue',
          badgeBg: '',
          badgeText: '',
        },
      ]),
    );
    const labels = adapter.getLabels();
    expect(labels.find((l) => l.id === 'attendance')?.system).toBe(true);
    const persisted = JSON.parse(store.map.get(scoped(STORAGE_KEYS.LABELS))!);
    expect(persisted.find((l: { id: string }) => l.id === 'attendance').system).toBe(
      true,
    );
  });

  it('refuses to delete labels still used by metrics', () => {
    adapter.getLabels();
    adapter.getMetrics();
    expect(() => adapter.deleteLabel('speed')).toThrow(/reassign/i);
  });

  it('clearNonSystemLabels keeps system labels only', () => {
    adapter.getLabels();
    adapter.clearNonSystemLabels();
    const labels = adapter.getLabels();
    expect(labels.every((l) => l.system)).toBe(true);
    expect(labels.some((l) => l.id === 'attendance')).toBe(true);
    expect(adapter.getFormula().weights.every((w) => w.labelId === 'attendance')).toBe(
      true,
    );
  });

  it('clearNonSystemMetrics keeps attendance and scrubs sessions', () => {
    adapter.getMetrics();
    adapter.getSessions();
    adapter.getCalculatedFields();
    adapter.clearNonSystemMetrics();
    const metrics = adapter.getMetrics();
    expect(metrics.every((m) => m.id === 'm_attendance' || m.type === 'attendance')).toBe(
      true,
    );
    expect(adapter.getCalculatedFields()).toEqual([]);
    for (const session of adapter.getSessions()) {
      expect(session.metricIds[0]).toBe('m_attendance');
      expect(session.metricIds.every((id) => id === 'm_attendance')).toBe(true);
    }
  });

  it('clearAllPlayers empties the roster', () => {
    expect(adapter.getPlayers().length).toBeGreaterThan(0);
    adapter.clearAllPlayers();
    expect(adapter.getPlayers()).toEqual([]);
  });

  it('persists coaches, ballots, bumps, and bump budget', () => {
    const coach = adapter.addCoach({ name: 'Test Coach' });
    expect(adapter.getCoaches().some((c) => c.id === coach.id)).toBe(true);
    expect(store.map.has(scoped(STORAGE_KEYS.COACHES))).toBe(true);

    adapter.saveCoachBallot({
      coachId: coach.id,
      ranks: { p1: 1, p2: 2 },
    });
    expect(adapter.getCoachBallots()).toEqual([
      { coachId: coach.id, ranks: { p1: 1, p2: 2 } },
    ]);

    adapter.saveBumpBudget({ plusBudget: 5, minusBudget: 2 });
    expect(adapter.getBumpBudget()).toEqual({ plusBudget: 5, minusBudget: 2 });

    expect(adapter.applyBump('p1', 1, coach.id)).toBe(true);
    expect(adapter.getAdjustedBumps().p1).toBe(1);
    expect(adapter.applyBump('p1', 1, coach.id)).toBe(true);
    expect(adapter.applyBump('p1', 1, coach.id)).toBe(true);
    expect(adapter.applyBump('p1', 1, coach.id)).toBe(true);
    expect(adapter.applyBump('p1', 1, coach.id)).toBe(true);
    expect(adapter.applyBump('p1', 1, coach.id)).toBe(false); // over plus budget of 5
    expect(adapter.getBumpTransactions().every((tx) => tx.coachId === coach.id)).toBe(
      true,
    );

    adapter.clearAllPlayers();
    expect(adapter.getAdjustedBumps()).toEqual({});
    expect(adapter.getBumpTransactions()).toEqual([]);
  });

  it('includes coaches and bumps in snapshot and backup round-trip', () => {
    const coach = adapter.addCoach({ name: 'Backup Coach' });
    expect(adapter.applyBump('p1', 1, coach.id)).toBe(true);
    adapter.saveBumpBudget({ plusBudget: 4, minusBudget: 1 });
    const snap = adapter.getSnapshot();
    expect(snap.coaches.length).toBeGreaterThan(0);
    expect(snap.adjustedBumps.p1).toBe(1);
    expect(snap.bumpTransactions?.length).toBe(1);
    expect(snap.bumpBudget.plusBudget).toBe(4);

    const json = adapter.exportFullBackupJSON();
    const other = new LocalJsonAdapter(memoryStore());
    expect(other.importFullBackupJSON(json)).toBe(true);
    expect(other.getCoaches().map((c) => c.name)).toContain('Backup Coach');
    expect(other.getAdjustedBumps().p1).toBe(1);
    expect(other.getBumpTransactions()).toHaveLength(1);
    expect(other.getBumpBudget()).toEqual({ plusBudget: 4, minusBudget: 1 });
  });

  it('migrates legacy net bump maps to transactions', () => {
    store.map.set(STORAGE_KEYS.ADJUSTED_BUMPS, JSON.stringify({ p1: 2, p2: -1 }));
    const nets = adapter.getAdjustedBumps();
    expect(nets).toEqual({ p1: 2, p2: -1 });
    const txs = adapter.getBumpTransactions();
    expect(txs).toHaveLength(3);
    expect(txs.every((tx) => tx.coachId === 'coach_legacy')).toBe(true);
  });

  it('deleteCoach removes ballot and that coach bumps; deletePlayer clears bump', () => {
    const coach = adapter.addCoach({ name: 'Temp' });
    const other = adapter.addCoach({ name: 'Other' });
    adapter.saveCoachBallot({ coachId: coach.id, ranks: { p1: 1 } });
    expect(adapter.applyBump('p1', 1, coach.id)).toBe(true);
    expect(adapter.applyBump('p1', 1, coach.id)).toBe(true);
    expect(adapter.applyBump('p2', -1, other.id)).toBe(true);
    adapter.deleteCoach(coach.id);
    expect(adapter.getCoachBallots().some((b) => b.coachId === coach.id)).toBe(
      false,
    );
    expect(adapter.getAdjustedBumps()).toEqual({ p2: -1 });
    adapter.deletePlayer('p2');
    expect(adapter.getAdjustedBumps()).toEqual({});
  });
});
