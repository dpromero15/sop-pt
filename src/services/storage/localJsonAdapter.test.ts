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
          labelIds: ['speed'],
    primaryLabelId: 'speed',
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

  it('returns empty calculated fields catalog', () => {
    expect(adapter.getCalculatedFields()).toEqual([]);
    adapter.saveCalculatedFields([
      {
        id: 'cf_legacy',
        name: 'Legacy',
        kind: 'average',
        baseMetricId: 'm_40m_dash',
        enabled: true,
        higherIsBetter: false,
        unit: 's',
      },
    ]);
    expect(adapter.getCalculatedFields()).toEqual([]);
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
    adapter.saveLabels([
      {
        id: 'attendance',
        name: 'Attendance',
        description: '',
        color: 'emerald',
        badgeBg: '',
        badgeText: '',
        system: true,
      },
      {
        id: 'speed',
        name: 'Speed',
        description: '',
        color: 'blue',
        badgeBg: '',
        badgeText: '',
      },
    ]);
    adapter.saveMetrics([
      {
        id: 'm_40m',
        name: '40m',
        labelIds: ['speed'],
        primaryLabelId: 'speed',
        type: 'time_seconds',
        unit: 's',
        higherIsBetter: false,
        aggregationMode: 'best',
      },
    ]);
    expect(() => adapter.deleteLabel('speed')).toThrow(/reassign/i);
  });

  it('does not seed Thunder FC sample categories on first read', () => {
    const labels = adapter.getLabels();
    expect(labels.map((l) => l.id)).toEqual(['attendance']);
    const formula = adapter.getFormula();
    expect(formula.weights.map((w) => w.labelId)).toEqual(['attendance']);
    expect(adapter.getMetrics().every((m) => m.id === 'm_attendance')).toBe(
      true,
    );
  });

  it('getFormula drops orphan weight ids not in labels', () => {
    adapter.saveLabels([
      {
        id: 'attendance',
        name: 'Attendance',
        description: '',
        color: 'emerald',
        badgeBg: '',
        badgeText: '',
        system: true,
      },
    ]);
    store.map.set(
      scoped(STORAGE_KEYS.FORMULA),
      JSON.stringify({
        id: 'f1',
        name: 'Ghost',
        weights: [
          { labelId: 'attendance', weightPercent: 20, enabled: true },
          { labelId: 'speed', weightPercent: 80, enabled: true },
        ],
      }),
    );
    const formula = adapter.getFormula();
    expect(formula.weights.map((w) => w.labelId)).toEqual(['attendance']);
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

  it('restores Attendance label when missing from storage', () => {
    store.map.set(
      scoped(STORAGE_KEYS.LABELS),
      JSON.stringify([
        {
          id: 'speed',
          name: 'Speed',
          description: '',
          color: 'blue',
          badgeBg: '',
          badgeText: '',
        },
      ]),
    );
    const labels = adapter.getLabels();
    expect(labels[0]).toMatchObject({ id: 'attendance', system: true });
    expect(labels.some((l) => l.id === 'speed')).toBe(true);
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

  it('applySnapshot persists empty players so holdSeeds release does not seed samples', () => {
    adapter.setTeamScope('team_empty_cloud', { holdSeeds: true });
    expect(adapter.getPlayers()).toEqual([]);

    adapter.applySnapshot(
      {
        team: {
          id: 'team_empty_cloud',
          name: 'Empty FC',
          shortName: 'EFC',
          season: '2026',
          ageGroup: 'U16',
          clubName: '',
          homeVenue: '',
          primaryColor: '#000',
          secondaryColor: '#fff',
          timezone: 'UTC',
          updatedAt: 't',
        },
        players: [],
        sessions: [],
        entries: [],
        metrics: [],
        labels: [],
        formula: adapter.getFormula(),
        calculatedFields: [],
        coaches: [],
        coachBallots: [],
        adjustedBumps: {},
        bumpBudget: adapter.getBumpBudget(),
      },
      { migrate: false },
    );
    adapter.setHoldSeeds(false);

    expect(adapter.getPlayers()).toEqual([]);
    expect(
      store.map.get(scopedStorageKey('team_empty_cloud', STORAGE_KEYS.PLAYERS)),
    ).toBe('[]');
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
    expect(adapter.getAdjustedBumps()).toEqual({ p2: -1 });
    adapter.purgeExpiredDeletes(Date.now() + 91 * 24 * 60 * 60 * 1000);
    expect(adapter.getAdjustedBumps()).toEqual({});
  });

  it('soft-deletes players and sessions with restore and 90-day purge', () => {
    const session = adapter.addSession({
      date: '2026-08-01',
      title: 'Keep me',
      type: 'session',
      metricIds: ['m_attendance'],
    });
    adapter.addOrUpdateEntry({
      sessionId: session.id,
      playerId: 'p1',
      metricId: 'm_attendance',
      value: 100,
    });
    const coach = adapter.addCoach({ name: 'Bump Coach' });
    expect(adapter.applyBump('p1', 1, coach.id)).toBe(true);

    adapter.deletePlayer('p1');
    adapter.deleteSession(session.id);

    expect(adapter.getPlayers().some((p) => p.id === 'p1')).toBe(false);
    expect(adapter.getSessions().some((s) => s.id === session.id)).toBe(false);
    expect(adapter.getDeletedPlayers().some((p) => p.id === 'p1')).toBe(true);
    expect(adapter.getDeletedSessions().some((s) => s.id === session.id)).toBe(
      true,
    );
    expect(adapter.getAdjustedBumps().p1).toBe(1);
    expect(
      adapter.getEntries().some((e) => e.sessionId === session.id),
    ).toBe(true);
    expect(
      adapter.getSnapshot().players.some((p) => p.id === 'p1' && p.deletedAt),
    ).toBe(true);

    adapter.addPlayer({
      name: 'New Kid',
      jerseyNumber: 99,
      position: 'ST',
      preferredFoot: 'Right',
      status: 'active',
    });
    expect(adapter.getDeletedPlayers().some((p) => p.id === 'p1')).toBe(true);

    adapter.restorePlayer('p1');
    adapter.restoreSession(session.id);
    expect(adapter.getPlayers().some((p) => p.id === 'p1')).toBe(true);
    expect(adapter.getSessions().some((s) => s.id === session.id)).toBe(true);
    expect(adapter.getPlayers().find((p) => p.id === 'p1')?.deletedAt).toBeUndefined();

    adapter.deletePlayer('p1');
    adapter.deleteSession(session.id);
    expect(adapter.purgeExpiredDeletes(Date.now()).players).toBe(0);
    const purged = adapter.purgeExpiredDeletes(
      Date.now() + 91 * 24 * 60 * 60 * 1000,
    );
    expect(purged.players).toBe(1);
    expect(purged.sessions).toBe(1);
    expect(adapter.getPlayers({ includeDeleted: true }).some((p) => p.id === 'p1')).toBe(
      false,
    );
    expect(adapter.getEntries().some((e) => e.sessionId === session.id)).toBe(
      false,
    );
    expect(adapter.getAdjustedBumps().p1).toBeUndefined();
  });
});
