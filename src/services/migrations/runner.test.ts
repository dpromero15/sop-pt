import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  getMigrationStatus,
  repairLocalMigrations,
  runLocalMigrations,
  SCHEMA_VERSION_KEY,
} from './index';
import { STORAGE_KEYS, scopedStorageKey, ACTIVE_TEAM_KEY } from '../storage/storageKeys';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe('runLocalMigrations', () => {
  it('no-ops when already at current version', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(CURRENT_SCHEMA_VERSION));
    const report = runLocalMigrations(store);
    expect(report.skipped).toBe(true);
    expect(report.applied).toHaveLength(0);
  });

  it('runs pending migrations and stamps version', () => {
    const store = memoryStorage();
    store.setItem(
      STORAGE_KEYS.SESSIONS,
      JSON.stringify([
        {
          id: 's1',
          date: '2026-01-01',
          title: 'Legacy',
          type: 'practice',
        },
      ]),
    );
    store.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify([]));
    store.setItem(
      STORAGE_KEYS.TEAM,
      JSON.stringify({ id: 't1', name: 'Test FC' }),
    );

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.fromVersion).toBe(0);
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(report.applied.length).toBeGreaterThan(0);

    const sessions = JSON.parse(store.getItem(STORAGE_KEYS.SESSIONS)!);
    expect(sessions[0].status).toBe('open');
    expect(sessions[0].type).toBe('session');
    expect(sessions[0].metricIds?.[0]).toBe('m_attendance');

    const team = JSON.parse(store.getItem(STORAGE_KEYS.TEAM)!);
    expect(team.clubName).toBeTruthy();
    expect(team.timezone).toBeTruthy();

    expect(getMigrationStatus(store).upToDate).toBe(true);

    expect(store.getItem(scopedStorageKey('t1', STORAGE_KEYS.TEAM))).toBeTruthy();
  });

  it('repair re-runs from zero idempotently', () => {
    const store = memoryStorage();
    store.setItem(
      STORAGE_KEYS.TEAM,
      JSON.stringify({
        id: 't1',
        name: 'Test FC',
        shortName: 'TST',
        season: '2025-26',
        ageGroup: 'U13',
        clubName: 'Club',
        homeVenue: 'Pitch',
        primaryColor: '#000',
        secondaryColor: '#fff',
        timezone: 'UTC',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    );
    runLocalMigrations(store);
    const again = repairLocalMigrations(store);
    expect(again.error).toBeUndefined();
    expect(again.toVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('repairs corrupt metrics `{ metrics, changed }` blob via v3', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(2));
    store.setItem(
      STORAGE_KEYS.METRICS,
      JSON.stringify({
        metrics: [
          {
            id: 'm_dash',
            name: 'Dash',
            type: 'time_seconds',
            unit: 's',
            higherIsBetter: false,
            aggregationMode: 'best',
            includeInAdjustedTotal: true,
            treatNoScoreAsZero: true,
          },
        ],
        changed: true,
      }),
    );

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    const metrics = JSON.parse(store.getItem(STORAGE_KEYS.METRICS)!);
    expect(Array.isArray(metrics)).toBe(true);
    expect(metrics[0].id).toBe('m_dash');
  });

  it('backfills blocksPractice and seeds red-card sit-out via v5', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(4));
    store.setItem(ACTIVE_TEAM_KEY, 't1');
    store.setItem(
      STORAGE_KEYS.TEAM,
      JSON.stringify({ id: 't1', name: 'Test FC' }),
    );
    const legacyReqs = [
      {
        id: 'req_sports_physical',
        name: 'Sports Physical',
        kind: 'paperwork',
        blocksPlay: true,
        sortOrder: 1,
      },
    ];
    store.setItem(
      STORAGE_KEYS.COMPLIANCE_REQUIREMENTS,
      JSON.stringify(legacyReqs),
    );
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.COMPLIANCE_REQUIREMENTS),
      JSON.stringify(legacyReqs),
    );
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.PLAYER_COMPLIANCE),
      JSON.stringify({
        p1: {
          req_sports_physical: {
            complete: true,
            completedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      }),
    );

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    const scoped = JSON.parse(
      store.getItem(
        scopedStorageKey('t1', STORAGE_KEYS.COMPLIANCE_REQUIREMENTS),
      )!,
    );
    expect(scoped.find((r: { id: string }) => r.id === 'req_sports_physical'))
      .toMatchObject({ blocksPractice: false });
    expect(
      scoped.some((r: { id: string }) => r.id === 'req_red_card_sitout'),
    ).toBe(true);
    expect(
      scoped.find((r: { id: string }) => r.id === 'req_red_card_sitout'),
    ).toMatchObject({
      kind: 'disciplinary',
      blocksPlay: true,
      blocksPractice: false,
    });

    const compliance = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.PLAYER_COMPLIANCE))!,
    );
    expect(compliance.p1.req_red_card_sitout.complete).toBe(true);
  });

  it('ensures Attendance formula weight via v6', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(5));
    store.setItem(ACTIVE_TEAM_KEY, 't1');
    store.setItem(
      STORAGE_KEYS.TEAM,
      JSON.stringify({ id: 't1', name: 'Test FC' }),
    );
    const brokenFormula = {
      id: 'default_formula',
      name: 'No attendance',
      weights: [{ labelId: 'speed', weightPercent: 100, enabled: true }],
    };
    store.setItem(STORAGE_KEYS.FORMULA, JSON.stringify(brokenFormula));
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.FORMULA),
      JSON.stringify(brokenFormula),
    );

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    const scoped = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.FORMULA))!,
    );
    expect(scoped.weights[0]).toMatchObject({
      labelId: 'attendance',
      enabled: true,
    });
    expect(scoped.weights[0].weightPercent).toBeGreaterThan(0);
  });

  it('ensures Attendance label via v7', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(6));
    store.setItem(ACTIVE_TEAM_KEY, 't1');
    store.setItem(
      STORAGE_KEYS.TEAM,
      JSON.stringify({ id: 't1', name: 'Test FC' }),
    );
    const labelsWithoutAttendance = [
      {
        id: 'speed',
        name: 'Speed',
        description: '',
        color: 'blue',
        badgeBg: '',
        badgeText: '',
      },
    ];
    store.setItem(STORAGE_KEYS.LABELS, JSON.stringify(labelsWithoutAttendance));
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.LABELS),
      JSON.stringify(labelsWithoutAttendance),
    );

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    const scoped = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.LABELS))!,
    );
    expect(scoped[0]).toMatchObject({
      id: 'attendance',
      system: true,
      name: 'Attendance',
    });
  });
});
