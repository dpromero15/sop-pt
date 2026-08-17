import { describe, it, expect } from 'vitest';
import type { Session, MetricEntry } from '../types';
import {
  ATTENDANCE_METRIC_ID,
  defaultMetricIdsForSessionType,
  ensureAttendanceFirst,
  migrateSessionMetricIds,
  toggleLateStatus,
  isScoreEligible,
  playerIdsWithAttendance,
  isAttendanceComplete,
  unmarkedPlayerIds,
  countAttendanceByStatus,
  indexEntriesBySessionId,
  sessionPreviewStats,
  formatSessionListDate,
  normalizeSessionStatus,
  normalizeSessionType,
  filterOpenSessions,
  newQuickSessionTitle,
  localDateString,
} from './sessionMetrics';

describe('sessionMetrics', () => {
  it('ensures attendance is first and unique', () => {
    expect(ensureAttendanceFirst(['m_goals', ATTENDANCE_METRIC_ID, 'm_assists'])).toEqual([
      ATTENDANCE_METRIC_ID,
      'm_goals',
      'm_assists',
    ]);
  });

  it('defaults match sessions with game pack', () => {
    expect(defaultMetricIdsForSessionType('match')).toEqual([
      ATTENDANCE_METRIC_ID,
      'm_goals',
      'm_assists',
      'm_tackles',
    ]);
    expect(defaultMetricIdsForSessionType('session')).toEqual([ATTENDANCE_METRIC_ID]);
  });

  it('normalizes legacy practice and fitness_test to session', () => {
    expect(normalizeSessionType('practice')).toBe('session');
    expect(normalizeSessionType('fitness_test')).toBe('session');
    expect(normalizeSessionType('session')).toBe('session');
    expect(normalizeSessionType('match')).toBe('match');
  });

  it('migrates missing metricIds from entries and defaults status to open', () => {
    const session = {
      id: 'sess_x',
      date: '2026-08-01',
      title: 'Test',
      type: 'session' as const,
    };
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 'sess_x',
        playerId: 'p1',
        metricId: 'm_40m_dash',
        value: 5,
        timestamp: '2026-08-01',
      },
      {
        id: 'e2',
        sessionId: 'sess_x',
        playerId: 'p1',
        metricId: ATTENDANCE_METRIC_ID,
        value: 100,
        timestamp: '2026-08-01',
      },
    ];
    const migrated = migrateSessionMetricIds(session, entries);
    expect(migrated.metricIds[0]).toBe(ATTENDANCE_METRIC_ID);
    expect(migrated.metricIds).toContain('m_40m_dash');
    expect(migrated.status).toBe('open');
  });

  it('normalizes session status (legacy missing → open)', () => {
    expect(normalizeSessionStatus(undefined)).toBe('open');
    expect(normalizeSessionStatus('open')).toBe('open');
    expect(normalizeSessionStatus('closed')).toBe('closed');
    expect(normalizeSessionStatus('nope')).toBe('open');
  });

  it('filters open sessions for Quick Insert', () => {
    const sessions: Session[] = [
      {
        id: 'a',
        date: '2026-08-06',
        title: 'Open',
        type: 'session',
        status: 'open',
        metricIds: [ATTENDANCE_METRIC_ID],
      },
      {
        id: 'b',
        date: '2026-08-05',
        title: 'Done',
        type: 'session',
        status: 'closed',
        metricIds: [ATTENDANCE_METRIC_ID],
      },
    ];
    expect(filterOpenSessions(sessions).map((s) => s.id)).toEqual(['a']);
  });

  it('builds quick-insert new session title with local date', () => {
    const d = new Date(2026, 7, 6); // Aug 6 local
    expect(localDateString(d)).toBe('2026-08-06');
    expect(newQuickSessionTitle(d)).toBe('New session - 2026-08-06');
  });

  it('toggles late stamp per SOP', () => {
    expect(toggleLateStatus('present')).toBe('late');
    expect(toggleLateStatus('absent')).toBe('late');
    expect(toggleLateStatus('late')).toBe('present');
    expect(toggleLateStatus('excused')).toBe('excused');
  });

  it('marks present and late as score eligible', () => {
    expect(isScoreEligible('present')).toBe(true);
    expect(isScoreEligible('late')).toBe(true);
    expect(isScoreEligible('absent')).toBe(false);
    expect(isScoreEligible('excused')).toBe(false);
  });

  it('detects attendance completeness from entry presence', () => {
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 'sess_1',
        playerId: 'p1',
        metricId: ATTENDANCE_METRIC_ID,
        value: 100,
        timestamp: '2026-08-01',
      },
      {
        id: 'e2',
        sessionId: 'sess_1',
        playerId: 'p2',
        metricId: ATTENDANCE_METRIC_ID,
        value: 0,
        timestamp: '2026-08-01',
      },
      {
        id: 'e3',
        sessionId: 'sess_other',
        playerId: 'p3',
        metricId: ATTENDANCE_METRIC_ID,
        value: 100,
        timestamp: '2026-08-01',
      },
    ];
    const marked = playerIdsWithAttendance(entries, 'sess_1');
    expect([...marked].sort()).toEqual(['p1', 'p2']);
    expect(isAttendanceComplete(['p1', 'p2'], marked)).toBe(true);
    expect(isAttendanceComplete(['p1', 'p2', 'p3'], marked)).toBe(false);
    expect(unmarkedPlayerIds(['p1', 'p2', 'p3'], marked)).toEqual(['p3']);
    expect(isAttendanceComplete([], marked)).toBe(false);
  });

  it('counts attendance statuses', () => {
    expect(countAttendanceByStatus(['present', 'present', 'late', 'absent', 'excused'])).toEqual({
      present: 2,
      late: 1,
      absent: 1,
      excused: 1,
    });
  });

  it('indexes entries by session id', () => {
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 'a',
        playerId: 'p1',
        metricId: ATTENDANCE_METRIC_ID,
        value: 100,
        timestamp: '2026-08-01',
      },
      {
        id: 'e2',
        sessionId: 'b',
        playerId: 'p1',
        metricId: 'm_goals',
        value: 1,
        timestamp: '2026-08-02',
      },
      {
        id: 'e3',
        sessionId: 'a',
        playerId: 'p2',
        metricId: ATTENDANCE_METRIC_ID,
        value: 0,
        timestamp: '2026-08-01',
      },
    ];
    const indexed = indexEntriesBySessionId(entries);
    expect(indexed.get('a')?.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(indexed.get('b')?.map((e) => e.id)).toEqual(['e2']);
  });

  it('summarizes list-row preview stats from session entries', () => {
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 'sess_1',
        playerId: 'p1',
        metricId: ATTENDANCE_METRIC_ID,
        value: 100,
        timestamp: '2026-08-01',
      },
      {
        id: 'e2',
        sessionId: 'sess_1',
        playerId: 'p2',
        metricId: ATTENDANCE_METRIC_ID,
        value: 50,
        timestamp: '2026-08-01',
      },
      {
        id: 'e3',
        sessionId: 'sess_1',
        playerId: 'p3',
        metricId: ATTENDANCE_METRIC_ID,
        value: 0,
        timestamp: '2026-08-01',
      },
      {
        id: 'e4',
        sessionId: 'sess_1',
        playerId: 'p1',
        metricId: 'm_goals',
        value: 2,
        timestamp: '2026-08-01',
      },
    ];
    expect(sessionPreviewStats(entries)).toEqual({
      attendance: { present: 1, late: 1, absent: 1, excused: 0 },
      markedCount: 3,
      hasScoredMetrics: true,
    });
    expect(sessionPreviewStats(entries.slice(0, 3))).toEqual({
      attendance: { present: 1, late: 1, absent: 1, excused: 0 },
      markedCount: 3,
      hasScoredMetrics: false,
    });
    expect(sessionPreviewStats([])).toEqual({
      attendance: { present: 0, late: 0, absent: 0, excused: 0 },
      markedCount: 0,
      hasScoredMetrics: false,
    });
  });

  it('formats session list dates as short month + day', () => {
    expect(formatSessionListDate('2026-08-05')).toBe('Aug 5');
    expect(formatSessionListDate('2026-01-01')).toBe('Jan 1');
    expect(formatSessionListDate('not-a-date')).toBe('not-a-date');
  });
});
