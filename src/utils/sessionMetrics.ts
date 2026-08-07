import type { AttendanceStatus, MetricEntry, Session, SessionType } from '../types';

export const ATTENDANCE_METRIC_ID = 'm_attendance';

export const MATCH_DEFAULT_METRIC_IDS = ['m_goals', 'm_assists', 'm_tackles'] as const;

export function ensureAttendanceFirst(metricIds: string[]): string[] {
  const rest = metricIds.filter((id) => id !== ATTENDANCE_METRIC_ID);
  return [ATTENDANCE_METRIC_ID, ...rest];
}

export function defaultMetricIdsForSessionType(type: SessionType): string[] {
  if (type === 'match') {
    return ensureAttendanceFirst([...MATCH_DEFAULT_METRIC_IDS]);
  }
  return [ATTENDANCE_METRIC_ID];
}

/** Migrate legacy sessions missing metricIds using entries for that session. */
export function migrateSessionMetricIds(
  session: Session | (Omit<Session, 'metricIds'> & { metricIds?: string[] }),
  entries: MetricEntry[],
): Session {
  if (session.metricIds && session.metricIds.length > 0) {
    return {
      ...session,
      metricIds: ensureAttendanceFirst(session.metricIds),
    };
  }

  const fromEntries = [
    ...new Set(
      entries
        .filter((e) => e.sessionId === session.id)
        .map((e) => e.metricId),
    ),
  ];

  return {
    ...session,
    metricIds: ensureAttendanceFirst(fromEntries),
  };
}

export function migrateSessionsMetricIds(
  sessions: Array<Session | (Omit<Session, 'metricIds'> & { metricIds?: string[] })>,
  entries: MetricEntry[],
): Session[] {
  return sessions.map((s) => migrateSessionMetricIds(s, entries));
}

export function attendanceStatusToValue(status: AttendanceStatus): number {
  switch (status) {
    case 'present':
      return 100;
    case 'late':
      return 50;
    case 'absent':
      return 0;
    case 'excused':
      return -1;
  }
}

export function attendanceValueToStatus(value: number): AttendanceStatus {
  if (value === 100) return 'present';
  if (value === 50) return 'late';
  if (value < 0) return 'excused';
  return 'absent';
}

export function attendanceStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'present':
      return 'Present';
    case 'late':
      return 'Late';
    case 'absent':
      return 'Absent';
    case 'excused':
      return 'Excused';
  }
}

/** Long-press LATE stamp toggle rules. */
export function toggleLateStatus(status: AttendanceStatus): AttendanceStatus {
  if (status === 'excused') return 'excused';
  if (status === 'late') return 'present';
  return 'late'; // present or absent → late
}

/** Players who can be scored for session metrics. */
export function isScoreEligible(status: AttendanceStatus): boolean {
  return status === 'present' || status === 'late';
}
