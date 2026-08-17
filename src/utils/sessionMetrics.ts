import type {
  AttendanceStatus,
  MetricEntry,
  Session,
  SessionStatus,
  SessionType,
} from '../types';

export const ATTENDANCE_METRIC_ID = 'm_attendance';

export const MATCH_DEFAULT_METRIC_IDS = ['m_goals', 'm_assists', 'm_tackles'] as const;

export type LegacySession = Omit<Session, 'metricIds' | 'status'> & {
  metricIds?: string[];
  status?: SessionStatus;
};

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

/** Map legacy `practice` / `fitness_test` to `session`. */
export function normalizeSessionType(type?: SessionType | string): SessionType {
  if (type === 'match') return 'match';
  return 'session';
}

/** Legacy sessions without status are treated as open so coaches can finish them. */
export function normalizeSessionStatus(status?: SessionStatus | string): SessionStatus {
  return status === 'closed' ? 'closed' : 'open';
}

export function isSessionOpen(session: Pick<Session, 'status'>): boolean {
  return session.status === 'open';
}

export function filterOpenSessions(sessions: Session[]): Session[] {
  return sessions.filter(isSessionOpen);
}

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Default Quick Insert title for a brand-new open session. */
export function newQuickSessionTitle(date: Date = new Date()): string {
  return `New session - ${localDateString(date)}`;
}

/** Migrate legacy sessions missing metricIds / status using entries for that session. */
export function migrateSessionMetricIds(session: LegacySession, entries: MetricEntry[]): Session {
  const status = normalizeSessionStatus(session.status);
  const type = normalizeSessionType(session.type);
  if (session.metricIds && session.metricIds.length > 0) {
    return {
      ...session,
      type,
      status,
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
    type,
    status,
    metricIds: ensureAttendanceFirst(fromEntries),
  };
}

export function migrateSessionsMetricIds(
  sessions: LegacySession[],
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

/** Player ids that already have an attendance entry for the session (entry presence, not map defaults). */
export function playerIdsWithAttendance(
  entries: MetricEntry[],
  sessionId: string,
): Set<string> {
  return new Set(
    entries
      .filter((e) => e.sessionId === sessionId && e.metricId === ATTENDANCE_METRIC_ID)
      .map((e) => e.playerId),
  );
}

/** True when every active player has a stored attendance entry. */
export function isAttendanceComplete(
  activePlayerIds: readonly string[],
  markedPlayerIds: ReadonlySet<string>,
): boolean {
  return (
    activePlayerIds.length > 0 && activePlayerIds.every((id) => markedPlayerIds.has(id))
  );
}

/** Active players still missing an attendance entry. */
export function unmarkedPlayerIds(
  activePlayerIds: readonly string[],
  markedPlayerIds: ReadonlySet<string>,
): string[] {
  return activePlayerIds.filter((id) => !markedPlayerIds.has(id));
}

/** Shared status when every listed player is marked the same; otherwise undefined. */
export function unanimousAttendanceStatus(
  playerIds: readonly string[],
  attendanceMap: Readonly<Record<string, AttendanceStatus>>,
): AttendanceStatus | undefined {
  if (playerIds.length === 0) return undefined;
  const first = attendanceMap[playerIds[0]];
  if (first === undefined) return undefined;
  return playerIds.every((id) => attendanceMap[id] === first) ? first : undefined;
}

export function countAttendanceByStatus(
  statuses: Iterable<AttendanceStatus>,
): Record<AttendanceStatus, number> {
  const counts: Record<AttendanceStatus, number> = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
  };
  for (const status of statuses) {
    counts[status] += 1;
  }
  return counts;
}

export function indexEntriesBySessionId(
  entries: readonly MetricEntry[],
): Map<string, MetricEntry[]> {
  const map = new Map<string, MetricEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.sessionId);
    if (list) list.push(entry);
    else map.set(entry.sessionId, [entry]);
  }
  return map;
}

export type SessionPreviewStats = {
  attendance: Record<AttendanceStatus, number>;
  markedCount: number;
  hasScoredMetrics: boolean;
};

/** Compact list-row stats: attendance counts + whether any non-attendance metric was logged. */
export function sessionPreviewStats(
  entries: readonly MetricEntry[],
): SessionPreviewStats {
  const attendanceStatuses: AttendanceStatus[] = [];
  let hasScoredMetrics = false;
  for (const entry of entries) {
    if (entry.metricId === ATTENDANCE_METRIC_ID) {
      attendanceStatuses.push(attendanceValueToStatus(entry.value));
    } else {
      hasScoredMetrics = true;
    }
  }
  return {
    attendance: countAttendanceByStatus(attendanceStatuses),
    markedCount: attendanceStatuses.length,
    hasScoredMetrics,
  };
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Local calendar date for session list rows (`Aug 5`). Invalid input is returned as-is. */
export function formatSessionListDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return isoDate;
  return `${SHORT_MONTHS[month - 1]} ${day}`;
}

/** Newest calendar date first; same day uses time then id so the order is stable. */
export function compareSessionsNewestFirst(
  a: Pick<Session, 'date' | 'time' | 'id'>,
  b: Pick<Session, 'date' | 'time' | 'id'>,
): number {
  const byDate = b.date.localeCompare(a.date);
  if (byDate !== 0) return byDate;
  const byTime = (b.time ?? '').localeCompare(a.time ?? '');
  if (byTime !== 0) return byTime;
  return b.id.localeCompare(a.id);
}

export function sortSessionsNewestFirst(sessions: readonly Session[]): Session[] {
  return [...sessions].sort(compareSessionsNewestFirst);
}
