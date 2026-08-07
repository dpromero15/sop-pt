import React, { useEffect, useMemo, useState } from 'react';
import {
  Zap,
  CalendarCheck,
  Target,
  Check,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';
import type {
  AttendanceStatus,
  MetricDefinition,
  Player,
  Session,
} from '../types';
import { StorageService } from '../services/storage';
import {
  ATTENDANCE_METRIC_ID,
  attendanceStatusLabel,
  attendanceStatusToValue,
  attendanceValueToStatus,
  ensureAttendanceFirst,
  isScoreEligible,
} from '../utils/sessionMetrics';
import { SessionMetricPlanner } from './logger/SessionMetricPlanner';
import { AttendanceSwipeDeck } from './logger/AttendanceSwipeDeck';
import { PlayerScoreCard } from './logger/PlayerScoreCard';

type WorkflowStep = 'plan' | 'attendance' | 'score' | 'summary';

interface QuickInsertViewProps {
  players: Player[];
  sessions: Session[];
  metrics: MetricDefinition[];
  initialSessionId?: string | null;
  onOpenCreateSession: () => void;
  onRefreshData: () => void;
}

export const QuickInsertView: React.FC<QuickInsertViewProps> = ({
  players,
  sessions,
  metrics,
  initialSessionId,
  onOpenCreateSession,
  onRefreshData,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [step, setStep] = useState<WorkflowStep>('plan');
  const [scoringMetricId, setScoringMetricId] = useState<string>('');
  const [scoreQueue, setScoreQueue] = useState<string[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;
  const activePlayers = useMemo(
    () => players.filter((p) => p.status === 'active'),
    [players],
  );

  useEffect(() => {
    if (initialSessionId && sessions.some((s) => s.id === initialSessionId)) {
      setSelectedSessionId(initialSessionId);
      setStep('attendance');
      return;
    }
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [initialSessionId, sessions, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    const allEntries = StorageService.getEntries();
    const sessionEntries = allEntries.filter((e) => e.sessionId === selectedSessionId);
    const map: Record<string, AttendanceStatus> = {};
    activePlayers.forEach((p) => {
      map[p.id] = 'present';
    });
    sessionEntries.forEach((entry) => {
      if (entry.metricId === ATTENDANCE_METRIC_ID) {
        map[entry.playerId] = attendanceValueToStatus(entry.value);
      }
    });
    setAttendanceMap(map);
  }, [selectedSessionId, activePlayers]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 2200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const scoreMetrics = useMemo(() => {
    if (!selectedSession) return [];
    return ensureAttendanceFirst(selectedSession.metricIds)
      .filter((id) => id !== ATTENDANCE_METRIC_ID)
      .map((id) => metrics.find((m) => m.id === id))
      .filter((m): m is MetricDefinition => Boolean(m));
  }, [selectedSession, metrics]);

  const eligiblePlayers = useMemo(
    () => activePlayers.filter((p) => isScoreEligible(attendanceMap[p.id] ?? 'present')),
    [activePlayers, attendanceMap],
  );

  const persistAttendance = (playerId: string, status: AttendanceStatus) => {
    StorageService.addOrUpdateEntry({
      sessionId: selectedSessionId,
      playerId,
      metricId: ATTENDANCE_METRIC_ID,
      value: attendanceStatusToValue(status),
      rawValue: attendanceStatusLabel(status),
    });
    setAttendanceMap((prev) => ({ ...prev, [playerId]: status }));
    onRefreshData();
  };

  const markRemainingPresent = (remainingPlayerIds: string[]) => {
    remainingPlayerIds.forEach((playerId) => {
      StorageService.addOrUpdateEntry({
        sessionId: selectedSessionId,
        playerId,
        metricId: ATTENDANCE_METRIC_ID,
        value: 100,
        rawValue: 'Present',
      });
    });
    setAttendanceMap((prev) => {
      const next = { ...prev };
      remainingPlayerIds.forEach((id) => {
        next[id] = 'present';
      });
      return next;
    });
    onRefreshData();
    setToastMessage('Marked remaining present');
    setStep('score');
  };

  const updateMetricPlan = (metricIds: string[]) => {
    if (!selectedSession) return;
    StorageService.updateSession({
      ...selectedSession,
      metricIds: ensureAttendanceFirst(metricIds),
    });
    onRefreshData();
  };

  const startScoringMetric = (metricId: string) => {
    setScoringMetricId(metricId);
    setScoreQueue(eligiblePlayers.map((p) => p.id));
    setStep('score');
  };

  const currentScorePlayer = players.find((p) => p.id === scoreQueue[0]);
  const currentScoreMetric = metrics.find((m) => m.id === scoringMetricId);

  const existingScoreValue = (playerId: string, metricId: string) => {
    const entry = StorageService.getEntries().find(
      (e) =>
        e.sessionId === selectedSessionId &&
        e.playerId === playerId &&
        e.metricId === metricId,
    );
    return entry?.value;
  };

  const coverageForMetric = (metricId: string) => {
    const entries = StorageService.getEntries().filter(
      (e) => e.sessionId === selectedSessionId && e.metricId === metricId,
    );
    const scored = eligiblePlayers.filter((p) => entries.some((e) => e.playerId === p.id));
    return { scored: scored.length, total: eligiblePlayers.length };
  };

  const steps: { id: WorkflowStep; label: string; icon: typeof Zap }[] = [
    { id: 'plan', label: 'Plan', icon: ClipboardList },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'score', label: 'Score', icon: Target },
    { id: 'summary', label: 'Summary', icon: Check },
  ];

  return (
    <div className="space-y-6 pb-28">
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Zap className="h-4 w-4" />
              Session Logger
            </div>
            <h2 className="text-2xl font-bold text-slate-50">Sideline workflow</h2>
            <p className="mt-1 text-sm text-slate-400">
              Plan metrics → swipe attendance → score players who showed up
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCreateSession}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            New session
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="text-sm text-slate-400 sm:w-28">Session</label>
        <select
          value={selectedSessionId}
          onChange={(e) => {
            setSelectedSessionId(e.target.value);
            setStep('plan');
            setScoringMetricId('');
            setScoreQueue([]);
          }}
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100"
        >
          {sessions.length === 0 && <option value="">No sessions</option>}
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.date} — {s.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        {steps.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            disabled={!selectedSession}
            onClick={() => setStep(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap ${
              step === id
                ? 'bg-slate-800 text-emerald-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {!selectedSession && (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
          Create a session to start logging.
        </p>
      )}

      {selectedSession && step === 'plan' && (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <SessionMetricPlanner
            metrics={metrics}
            metricIds={selectedSession.metricIds}
            sessionType={selectedSession.type}
            onChange={updateMetricPlan}
          />
          <button
            type="button"
            onClick={() => setStep('attendance')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Take attendance <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {selectedSession && step === 'attendance' && (
        <div className="space-y-4">
          <AttendanceSwipeDeck
            players={activePlayers}
            attendanceMap={attendanceMap}
            onSetStatus={persistAttendance}
            onMarkRemainingPresent={markRemainingPresent}
            resetKey={selectedSessionId}
          />
          <button
            type="button"
            onClick={() => setStep('score')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 font-medium text-slate-200 hover:bg-slate-900"
          >
            Continue to scoring <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {selectedSession && step === 'score' && (
        <div className="space-y-4">
          {!scoringMetricId || !currentScoreMetric || !currentScorePlayer ? (
            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">
                {eligiblePlayers.length} eligible players (present + late). Absent and excused are
                hidden.
              </p>
              {scoreMetrics.length === 0 && (
                <p className="text-sm text-amber-300">
                  No scoring metrics on this session. Add some in Plan.
                </p>
              )}
              {scoreMetrics.map((m) => {
                const cov = coverageForMetric(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => startScoringMetric(m.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-left hover:border-emerald-500/40"
                  >
                    <div>
                      <p className="font-medium text-slate-100">{m.name}</p>
                      <p className="text-xs text-slate-500">
                        {cov.scored}/{cov.total} scored · {m.type}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setStep('summary')}
                className="w-full rounded-xl border border-slate-700 py-3 text-sm text-slate-300"
              >
                View summary
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setScoringMetricId('');
                  setScoreQueue([]);
                }}
                className="text-sm text-slate-400 hover:text-slate-200"
              >
                ← All metrics
              </button>
              <PlayerScoreCard
                player={currentScorePlayer}
                metric={currentScoreMetric}
                initialValue={existingScoreValue(currentScorePlayer.id, currentScoreMetric.id)}
                remaining={scoreQueue.length}
                total={eligiblePlayers.length || 1}
                onSave={(value, rawValue) => {
                  StorageService.addOrUpdateEntry({
                    sessionId: selectedSessionId,
                    playerId: currentScorePlayer.id,
                    metricId: currentScoreMetric.id,
                    value,
                    rawValue,
                  });
                  onRefreshData();
                  setScoreQueue((q) => {
                    const next = q.slice(1);
                    if (next.length === 0) {
                      setToastMessage(`${currentScoreMetric.name} complete`);
                      setScoringMetricId('');
                    } else {
                      setToastMessage(`Saved ${currentScorePlayer.name}`);
                    }
                    return next;
                  });
                }}
                onSkip={() =>
                  setScoreQueue((q) => {
                    const next = q.slice(1);
                    if (next.length === 0) setScoringMetricId('');
                    return next;
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      {selectedSession && step === 'summary' && (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <h3 className="text-lg font-semibold text-slate-100">Session summary</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map((status) => (
              <div key={status} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-wider text-slate-500">{status}</p>
                <p className="text-2xl font-bold text-slate-100">
                  {Object.values(attendanceMap).filter((s) => s === status).length}
                </p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {scoreMetrics.map((m) => {
              const cov = coverageForMetric(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => startScoringMetric(m.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-800 px-4 py-3 text-left hover:border-slate-600"
                >
                  <span className="text-slate-200">{m.name}</span>
                  <span className="text-sm text-slate-400">
                    {cov.scored}/{cov.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
