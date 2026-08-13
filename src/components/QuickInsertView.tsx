import React, { useEffect, useMemo, useState } from 'react';
import {
  Zap,
  CalendarCheck,
  Target,
  Check,
  ClipboardList,
  ChevronRight,
  Plus,
  Play,
  Trash2,
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
  filterOpenSessions,
  isAttendanceComplete,
  isScoreEligible,
  localDateString,
  newQuickSessionTitle,
  playerIdsWithAttendance,
  unmarkedPlayerIds,
} from '../utils/sessionMetrics';
import { SessionMetricPlanner } from './logger/SessionMetricPlanner';
import { AttendanceSwipeDeck } from './logger/AttendanceSwipeDeck';
import { AttendanceMaintenanceList } from './logger/AttendanceMaintenanceList';
import { PlayerScoreCard } from './logger/PlayerScoreCard';
import { DenseScoreEditor } from './logger/DenseScoreEditor';

type WorkflowStep = 'plan' | 'attendance' | 'score' | 'summary';
type AttendanceViewMode = 'swipe' | 'review';
type Phase = 'gate' | 'logger';
type ScoreUiMode = 'dense' | 'cards';

function sessionHasNonAttendanceScores(sessionId: string): boolean {
  return StorageService.getEntries().some(
    (e) => e.sessionId === sessionId && e.metricId !== ATTENDANCE_METRIC_ID,
  );
}

interface QuickInsertViewProps {
  players: Player[];
  sessions: Session[];
  metrics: MetricDefinition[];
  initialSessionId?: string | null;
  onConsumedInitialSession?: () => void;
  onRefreshData: () => void;
}

export const QuickInsertView: React.FC<QuickInsertViewProps> = ({
  players,
  sessions,
  metrics,
  initialSessionId,
  onConsumedInitialSession,
  onRefreshData,
}) => {
  const [phase, setPhase] = useState<Phase>('gate');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [step, setStep] = useState<WorkflowStep>('plan');
  const [scoringMetricId, setScoringMetricId] = useState<string>('');
  const [scoreQueue, setScoreQueue] = useState<string[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [markedPlayerIds, setMarkedPlayerIds] = useState<Set<string>>(() => new Set());
  const [swipeSeedIds, setSwipeSeedIds] = useState<string[]>([]);
  const [attendanceView, setAttendanceView] = useState<AttendanceViewMode>('swipe');
  const [scoreUiMode, setScoreUiMode] = useState<ScoreUiMode>('cards');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const openSessions = useMemo(() => filterOpenSessions(sessions), [sessions]);
  const selectedSession = openSessions.find((s) => s.id === selectedSessionId) ?? null;
  const activePlayers = useMemo(
    () => players.filter((p) => p.status === 'active'),
    [players],
  );
  const activePlayerIds = useMemo(() => activePlayers.map((p) => p.id), [activePlayers]);
  const rosterFingerprint = useMemo(() => activePlayerIds.join(','), [activePlayerIds]);
  const attendanceComplete = isAttendanceComplete(activePlayerIds, markedPlayerIds);
  const remainingUnmarked = useMemo(
    () => unmarkedPlayerIds(activePlayerIds, markedPlayerIds),
    [activePlayerIds, markedPlayerIds],
  );

  const enterLogger = (sessionId: string, startStep: WorkflowStep = 'plan') => {
    setSelectedSessionId(sessionId);
    setStep(startStep);
    setScoringMetricId('');
    setScoreQueue([]);
    setAttendanceView('swipe');
    setPhase('logger');
  };

  const reloadAttendanceFromStorage = (sessionId: string) => {
    const allEntries = StorageService.getEntries();
    const sessionEntries = allEntries.filter((e) => e.sessionId === sessionId);
    const marked = playerIdsWithAttendance(sessionEntries, sessionId);
    const map: Record<string, AttendanceStatus> = {};
    activePlayerIds.forEach((id) => {
      map[id] = 'present';
    });
    sessionEntries.forEach((entry) => {
      if (entry.metricId === ATTENDANCE_METRIC_ID) {
        map[entry.playerId] = attendanceValueToStatus(entry.value);
      }
    });
    setAttendanceMap(map);
    setMarkedPlayerIds(marked);
  };

  const refreshAfterDenseEdit = () => {
    if (selectedSessionId) reloadAttendanceFromStorage(selectedSessionId);
    onRefreshData();
  };

  const createQuickSession = () => {
    const today = localDateString();
    const newSession = StorageService.addSession({
      title: newQuickSessionTitle(),
      date: today,
      type: 'session',
      status: 'open',
      metricIds: [],
    });
    onRefreshData();
    setScoreUiMode('cards');
    enterLogger(newSession.id, 'plan');
    setToastMessage('Started new session');
  };

  const resumeSession = (sessionId: string) => {
    const hasScores = sessionHasNonAttendanceScores(sessionId);
    if (hasScores) {
      setScoreUiMode('dense');
      enterLogger(sessionId, 'score');
    } else {
      setScoreUiMode('cards');
      enterLogger(sessionId, 'attendance');
    }
  };

  const deleteOpenSession = (sessionId: string, title: string) => {
    if (
      !confirm(
        `Delete "${title}"?\n\nThis open session moves to trash (restore from Sessions for 90 days). Logged attendance/scores stay with it until then.`,
      )
    ) {
      return;
    }
    StorageService.deleteSession(sessionId);
    onRefreshData();
    if (selectedSessionId === sessionId) {
      returnToGate();
    }
    setToastMessage('Session deleted');
  };

  const returnToGate = () => {
    setSelectedSessionId('');
    setPhase('gate');
    setStep('plan');
    setScoringMetricId('');
    setScoreQueue([]);
    setScoreUiMode('cards');
  };

  const completeSession = () => {
    if (!selectedSession) return;
    StorageService.updateSession({ ...selectedSession, status: 'closed' });
    onRefreshData();
    setToastMessage('Session closed');
    returnToGate();
  };

  // Handoff from Sessions → Insert Data (open sessions only; closed are reopened upstream).
  useEffect(() => {
    if (!initialSessionId) return;
    const target = sessions.find((s) => s.id === initialSessionId);
    if (!target || target.status !== 'open') return;
    const hasScores = sessionHasNonAttendanceScores(initialSessionId);
    if (hasScores) {
      setScoreUiMode('dense');
      enterLogger(initialSessionId, 'score');
    } else {
      setScoreUiMode('cards');
      enterLogger(initialSessionId, 'attendance');
    }
    onConsumedInitialSession?.();
    // intentionally only react to handoff id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId]);

  // Reload map whenever session or roster membership changes.
  useEffect(() => {
    if (!selectedSessionId || phase !== 'logger') return;
    const allEntries = StorageService.getEntries();
    const sessionEntries = allEntries.filter((e) => e.sessionId === selectedSessionId);
    const marked = playerIdsWithAttendance(sessionEntries, selectedSessionId);
    const map: Record<string, AttendanceStatus> = {};
    activePlayerIds.forEach((id) => {
      map[id] = 'present';
    });
    sessionEntries.forEach((entry) => {
      if (entry.metricId === ATTENDANCE_METRIC_ID) {
        map[entry.playerId] = attendanceValueToStatus(entry.value);
      }
    });
    setAttendanceMap(map);
    setMarkedPlayerIds(marked);
    setSwipeSeedIds(unmarkedPlayerIds(activePlayerIds, marked));
    setAttendanceView(isAttendanceComplete(activePlayerIds, marked) ? 'review' : 'swipe');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: session + roster membership only
  }, [selectedSessionId, rosterFingerprint, phase]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 2200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    if (step === 'attendance' && attendanceComplete && attendanceView === 'swipe') {
      setAttendanceView('review');
    }
  }, [step, attendanceComplete, attendanceView]);

  // If the active session was closed elsewhere, drop back to the gate.
  useEffect(() => {
    if (phase === 'logger' && selectedSessionId && !selectedSession) {
      returnToGate();
    }
  }, [phase, selectedSessionId, selectedSession]);

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
    setMarkedPlayerIds((prev) => {
      const next = new Set(prev);
      next.add(playerId);
      return next;
    });
    onRefreshData();
  };

  const markRemaining = (remainingPlayerIds: string[], status: AttendanceStatus) => {
    if (remainingPlayerIds.length === 0) return;
    remainingPlayerIds.forEach((playerId) => {
      StorageService.addOrUpdateEntry({
        sessionId: selectedSessionId,
        playerId,
        metricId: ATTENDANCE_METRIC_ID,
        value: attendanceStatusToValue(status),
        rawValue: attendanceStatusLabel(status),
      });
    });
    setAttendanceMap((prev) => {
      const next = { ...prev };
      remainingPlayerIds.forEach((id) => {
        next[id] = status;
      });
      return next;
    });
    setMarkedPlayerIds((prev) => {
      const next = new Set(prev);
      remainingPlayerIds.forEach((id) => next.add(id));
      return next;
    });
    onRefreshData();
  };

  const markRemainingPresent = (remainingPlayerIds: string[]) => {
    markRemaining(remainingPlayerIds, 'present');
    setToastMessage('Marked remaining present');
    setAttendanceView('review');
    const hasScores = sessionHasNonAttendanceScores(selectedSessionId);
    setScoreUiMode(hasScores ? 'dense' : 'cards');
    setStep('score');
  };

  const continueToScoring = () => {
    if (remainingUnmarked.length > 0) {
      markRemaining(remainingUnmarked, 'absent');
      setToastMessage(`Marked ${remainingUnmarked.length} remaining out`);
      setAttendanceView('review');
    }
    const hasScores = sessionHasNonAttendanceScores(selectedSessionId);
    setScoreUiMode(hasScores ? 'dense' : 'cards');
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

  if (phase === 'gate') {
    return (
      <div className="space-y-6 pb-28">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6">
          <div className="relative z-10">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Zap className="h-4 w-4" />
              Session Logger
            </div>
            <h2 className="text-2xl font-bold text-slate-50">Quick Insert</h2>
            <p className="mt-1 text-sm text-slate-400">
              Resume an open session or start a new one for today
            </p>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          {openSessions.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Pick up where you left off
              </h3>
              <ul className="space-y-2">
                {openSessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-stretch gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => resumeSession(s.id)}
                      className="flex min-w-0 flex-1 items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-left hover:border-emerald-500/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-100">{s.title}</p>
                        <p className="text-xs text-slate-500">
                          {s.date}
                          {s.time ? ` · ${s.time}` : ''} ·{' '}
                          {s.type === 'match' ? 'Match' : 'Session'}
                        </p>
                      </div>
                      <span className="ml-2 flex shrink-0 items-center gap-1 text-sm font-medium text-emerald-400">
                        <Play className="h-4 w-4" /> Continue
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteOpenSession(s.id, s.title)}
                      className="flex shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-slate-400 hover:border-rose-500/40 hover:text-rose-400"
                      aria-label={`Delete ${s.title}`}
                      title="Delete open session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="relative py-2 text-center text-xs uppercase tracking-wider text-slate-600">
                or
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              No open sessions. Start a new one to begin logging.
            </p>
          )}

          <button
            type="button"
            onClick={createQuickSession}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 font-semibold text-slate-950 hover:bg-emerald-400"
          >
            <Plus className="h-5 w-5" />
            Start new session
          </button>
          <p className="text-center text-xs text-slate-500">
            Creates <span className="text-slate-400">{newQuickSessionTitle()}</span>
          </p>
        </div>

        {toastMessage && (
          <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg">
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

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
            onClick={returnToGate}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            Switch session
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="text-sm text-slate-400 sm:w-28">Open session</label>
        <select
          value={selectedSessionId}
          onChange={(e) => {
            enterLogger(e.target.value, 'plan');
          }}
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100"
        >
          {openSessions.length === 0 && <option value="">No open sessions</option>}
          {openSessions.map((s) => (
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
          No open session selected. Switch session to continue or start new.
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
            onClick={() => {
              setAttendanceView(attendanceComplete ? 'review' : 'swipe');
              setStep('attendance');
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
          >
            {attendanceComplete ? 'Review attendance' : 'Take attendance'}{' '}
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {selectedSession && step === 'attendance' && (
        <div className="space-y-4">
          {attendanceView === 'review' || attendanceComplete ? (
            <AttendanceMaintenanceList
              players={activePlayers}
              attendanceMap={attendanceMap}
              onSetStatus={persistAttendance}
            />
          ) : (
            <>
              {markedPlayerIds.size > 0 && swipeSeedIds.length > 0 && (
                <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-400">
                  {markedPlayerIds.size} already marked · finishing {swipeSeedIds.length} remaining
                </p>
              )}
              <AttendanceSwipeDeck
                players={activePlayers}
                attendanceMap={attendanceMap}
                onSetStatus={persistAttendance}
                onMarkRemainingPresent={markRemainingPresent}
                resetKey={selectedSessionId}
                initialQueueIds={swipeSeedIds}
              />
            </>
          )}
          <button
            type="button"
            onClick={continueToScoring}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 font-medium text-slate-200 hover:bg-slate-900"
          >
            {attendanceComplete
              ? 'Continue to scoring'
              : `Continue to scoring · rest out (${remainingUnmarked.length})`}{' '}
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {selectedSession && step === 'score' && (
        <div className="space-y-4">
          {(() => {
            const sessionHasScores = sessionHasNonAttendanceScores(selectedSessionId);
            const showDense =
              scoreUiMode === 'dense' && sessionHasScores && !scoringMetricId;

            if (showDense) {
              const sessionEntries = StorageService.getEntries().filter(
                (e) => e.sessionId === selectedSessionId,
              );
              const planMetrics = ensureAttendanceFirst(selectedSession.metricIds)
                .map((id) => metrics.find((m) => m.id === id))
                .filter((m): m is MetricDefinition => Boolean(m));

              return (
                <>
                  <DenseScoreEditor
                    sessionId={selectedSessionId}
                    players={activePlayers}
                    metrics={planMetrics}
                    entries={sessionEntries}
                    attendanceMap={attendanceMap}
                    includeAttendanceColumn
                    onRefreshData={refreshAfterDenseEdit}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        setScoreUiMode('cards');
                        setScoringMetricId('');
                        setScoreQueue([]);
                      }}
                      className="flex-1 rounded-xl border border-slate-700 py-3 text-sm text-slate-300 hover:bg-slate-900"
                    >
                      Card scoring
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('summary')}
                      className="flex-1 rounded-xl border border-slate-700 py-3 text-sm text-slate-300 hover:bg-slate-900"
                    >
                      View summary
                    </button>
                  </div>
                </>
              );
            }

            return (
              <>
                {sessionHasScores && !scoringMetricId && (
                  <button
                    type="button"
                    onClick={() => setScoreUiMode('dense')}
                    className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/15"
                  >
                    Dense editor (adjust scores)
                  </button>
                )}
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
                            if (sessionHasNonAttendanceScores(selectedSessionId)) {
                              setScoreUiMode('dense');
                            }
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
              </>
            );
          })()}
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
          <button
            type="button"
            onClick={completeSession}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
          >
            <Check className="h-5 w-5" />
            Complete & close session
          </button>
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
