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
  normalizeSessionStatus,
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
    expect(defaultMetricIdsForSessionType('practice')).toEqual([ATTENDANCE_METRIC_ID]);
  });

  it('migrates missing metricIds from entries and defaults status to open', () => {
    const session = {
      id: 'sess_x',
      date: '2026-08-01',
      title: 'Test',
      type: 'practice' as const,
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
        type: 'practice',
        status: 'open',
        metricIds: [ATTENDANCE_METRIC_ID],
      },
      {
        id: 'b',
        date: '2026-08-05',
        title: 'Done',
        type: 'practice',
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
});
