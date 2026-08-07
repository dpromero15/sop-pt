import { describe, it, expect } from 'vitest';
import type { Session, MetricEntry } from '../types';
import {
  ATTENDANCE_METRIC_ID,
  defaultMetricIdsForSessionType,
  ensureAttendanceFirst,
  migrateSessionMetricIds,
  toggleLateStatus,
  isScoreEligible,
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

  it('migrates missing metricIds from entries', () => {
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
    const migrated = migrateSessionMetricIds(session as Session, entries);
    expect(migrated.metricIds[0]).toBe(ATTENDANCE_METRIC_ID);
    expect(migrated.metricIds).toContain('m_40m_dash');
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
});
