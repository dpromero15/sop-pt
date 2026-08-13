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
      .toMatchObject({
        name: 'Physical',
        blocksPlay: false,
        blocksPractice: true,
        blocksEquipment: false,
      });
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

  it('maps legacy metric labelId to labelIds via v9', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(8));
    store.setItem(ACTIVE_TEAM_KEY, 't1');
    store.setItem(
      STORAGE_KEYS.TEAM,
      JSON.stringify({ id: 't1', name: 'Test FC' }),
    );
    const labels = [
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
    ];
    store.setItem(STORAGE_KEYS.LABELS, JSON.stringify(labels));
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.LABELS),
      JSON.stringify(labels),
    );
    const legacyMetrics = [
      {
        id: 'm_40m',
        name: '40m',
        labelId: 'speed',
        type: 'time_seconds',
        unit: 's',
        higherIsBetter: false,
        aggregationMode: 'best',
      },
    ];
    store.setItem(STORAGE_KEYS.METRICS, JSON.stringify(legacyMetrics));
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.METRICS),
      JSON.stringify(legacyMetrics),
    );

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    const scoped = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.METRICS))!,
    );
    expect(scoped[0]).toMatchObject({
      id: 'm_40m',
      labelIds: ['speed'],
      primaryLabelId: 'speed',
    });
    expect(scoped[0].labelId).toBeUndefined();
  });

  it('prunes unused sample categories and orphan weights via v10', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(9));
    store.setItem(ACTIVE_TEAM_KEY, 't1');
    store.setItem(
      STORAGE_KEYS.TEAM,
      JSON.stringify({ id: 't1', name: 'Test FC' }),
    );
    const labels = [
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
      {
        id: 'fitness',
        name: 'Fitness',
        description: '',
        color: 'orange',
        badgeBg: '',
        badgeText: '',
      },
    ];
    const metrics = [
      {
        id: 'm_attendance',
        name: 'Session Attendance',
        labelIds: ['attendance'],
        primaryLabelId: 'attendance',
        type: 'attendance',
        unit: 'status',
        higherIsBetter: true,
        aggregationMode: 'latest',
      },
    ];
    const formula = {
      id: 'default_formula',
      name: 'Balanced',
      weights: [
        { labelId: 'attendance', weightPercent: 20, enabled: true },
        { labelId: 'speed', weightPercent: 15, enabled: true },
        { labelId: 'fitness', weightPercent: 5, enabled: true },
      ],
    };
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.LABELS),
      JSON.stringify(labels),
    );
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.METRICS),
      JSON.stringify(metrics),
    );
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.FORMULA),
      JSON.stringify(formula),
    );

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    const scopedLabels = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.LABELS))!,
    );
    const scopedFormula = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.FORMULA))!,
    );
    expect(scopedLabels.map((l: { id: string }) => l.id)).toEqual([
      'attendance',
    ]);
    expect(scopedFormula.weights.map((w: { labelId: string }) => w.labelId)).toEqual([
      'attendance',
    ]);
  });

  it('strips invalid deletedAt via v11', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(10));
    store.setItem(ACTIVE_TEAM_KEY, 't1');
    store.setItem(
      STORAGE_KEYS.TEAM,
      JSON.stringify({ id: 't1', name: 'Test FC' }),
    );
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.PLAYERS),
      JSON.stringify([
        { id: 'p1', name: 'Ada', jerseyNumber: 10, deletedAt: 'not-a-date' },
        {
          id: 'p2',
          name: 'Bea',
          jerseyNumber: 7,
          deletedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.SESSIONS),
      JSON.stringify([
        { id: 's1', title: 'Live', date: '2026-01-01', deletedAt: '' },
      ]),
    );

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    const players = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.PLAYERS))!,
    );
    expect(players.find((p: { id: string }) => p.id === 'p1').deletedAt).toBeUndefined();
    expect(players.find((p: { id: string }) => p.id === 'p2').deletedAt).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    const sessions = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.SESSIONS))!,
    );
    expect(sessions[0].deletedAt).toBeUndefined();
  });

  it('applies CRHS consequences and Grade Check eligibility via v12', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(11));
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
        blocksPractice: true,
        sortOrder: 1,
      },
      {
        id: 'req_grade_check',
        name: 'Grade Check',
        kind: 'paperwork',
        blocksPlay: true,
        blocksPractice: false,
        sortOrder: 2,
      },
      {
        id: 'req_season_fee',
        name: 'Season Fee',
        kind: 'fee',
        blocksPlay: true,
        blocksPractice: false,
        sortOrder: 3,
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

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    const scoped = JSON.parse(
      store.getItem(
        scopedStorageKey('t1', STORAGE_KEYS.COMPLIANCE_REQUIREMENTS),
      )!,
    );
    expect(scoped.find((r: { id: string }) => r.id === 'req_sports_physical'))
      .toMatchObject({
        name: 'Physical',
        blocksPlay: false,
        blocksPractice: true,
        blocksEquipment: false,
      });
    expect(scoped.find((r: { id: string }) => r.id === 'req_grade_check'))
      .toMatchObject({
        kind: 'eligibility',
        blocksPlay: true,
      });
    expect(scoped.find((r: { id: string }) => r.id === 'req_season_fee'))
      .toMatchObject({
        name: 'Team fee',
        blocksPlay: true,
        blocksEquipment: true,
      });
    expect(scoped.some((r: { id: string }) => r.id === 'req_crhs_policy')).toBe(
      true,
    );
    expect(
      scoped.some((r: { id: string }) => r.id === 'req_chssaa_policy'),
    ).toBe(true);
  });

  it('maps player age to birthYear via v13', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(12));
    store.setItem(ACTIVE_TEAM_KEY, 't1');
    store.setItem(
      STORAGE_KEYS.TEAM,
      JSON.stringify({ id: 't1', name: 'Test FC' }),
    );
    const asOf = new Date().getFullYear();
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.PLAYERS),
      JSON.stringify([
        { id: 'p1', name: 'Ada', age: 16, grade: 11 },
        { id: 'p2', name: 'Bea', birthYear: 2009, age: 15 },
      ]),
    );

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    const players = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.PLAYERS))!,
    );
    expect(players.find((p: { id: string }) => p.id === 'p1')).toMatchObject({
      birthYear: asOf - 16,
      grade: 11,
    });
    expect(players.find((p: { id: string }) => p.id === 'p1').age).toBeUndefined();
    expect(players.find((p: { id: string }) => p.id === 'p2')).toMatchObject({
      birthYear: 2009,
    });
    expect(players.find((p: { id: string }) => p.id === 'p2').age).toBeUndefined();
  });

  it('normalizes label parents and tree-duplicate metrics via v14', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(13));
    store.setItem(ACTIVE_TEAM_KEY, 't1');
    store.setItem(
      STORAGE_KEYS.TEAM,
      JSON.stringify({ id: 't1', name: 'Test FC' }),
    );
    const labels = [
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
      {
        id: 'acceleration',
        name: 'Acceleration',
        description: '',
        color: 'blue',
        badgeBg: '',
        badgeText: '',
        parentLabelId: 'speed',
      },
      {
        id: 'too_deep',
        name: 'Deep',
        description: '',
        color: 'blue',
        badgeBg: '',
        badgeText: '',
        parentLabelId: 'acceleration',
      },
    ];
    const metrics = [
      {
        id: 'm_40m',
        name: '40m',
        labelIds: ['speed', 'acceleration'],
        primaryLabelId: 'speed',
        type: 'time_seconds',
        unit: 's',
        higherIsBetter: false,
        aggregationMode: 'best',
      },
    ];
    const formula = {
      id: 'default_formula',
      name: 'Balanced',
      weights: [
        { labelId: 'attendance', weightPercent: 20, enabled: true },
        { labelId: 'speed', weightPercent: 70, enabled: true },
        { labelId: 'acceleration', weightPercent: 10, enabled: true },
      ],
    };
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.LABELS),
      JSON.stringify(labels),
    );
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.METRICS),
      JSON.stringify(metrics),
    );
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.FORMULA),
      JSON.stringify(formula),
    );

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    const nextLabels = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.LABELS))!,
    );
    expect(
      nextLabels.find((l: { id: string }) => l.id === 'too_deep')
        ?.parentLabelId,
    ).toBeUndefined();

    const nextMetrics = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.METRICS))!,
    );
    expect(nextMetrics[0]).toMatchObject({
      labelIds: ['acceleration'],
      primaryLabelId: 'acceleration',
    });

    const nextFormula = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.FORMULA))!,
    );
    expect(nextFormula.weights.map((w: { labelId: string }) => w.labelId)).toEqual(
      ['attendance', 'speed'],
    );
  });

  it('assigns player publicId via v15', () => {
    const store = memoryStorage();
    store.setItem(SCHEMA_VERSION_KEY, JSON.stringify(14));
    store.setItem(ACTIVE_TEAM_KEY, 't1');
    store.setItem(
      STORAGE_KEYS.TEAM,
      JSON.stringify({ id: 't1', name: 'Test FC' }),
    );
    store.setItem(
      scopedStorageKey('t1', STORAGE_KEYS.PLAYERS),
      JSON.stringify([
        { id: 'p1', name: 'Ada', jerseyNumber: 10 },
        { id: 'p2', name: 'Bea', jerseyNumber: 7, publicId: 'ab2def' },
      ]),
    );

    const report = runLocalMigrations(store);
    expect(report.error).toBeUndefined();
    expect(report.toVersion).toBe(CURRENT_SCHEMA_VERSION);

    const players = JSON.parse(
      store.getItem(scopedStorageKey('t1', STORAGE_KEYS.PLAYERS))!,
    );
    expect(players[0].publicId).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(players[1].publicId).toBe('AB2DEF');
    expect(players[0].publicId).not.toBe(players[1].publicId);
  });
});
