import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  CalendarCheck, 
  Timer, 
  Target, 
  Plus, 
  Minus, 
  Check, 
  Clock, 
  Save, 
  Sparkles, 
  Play, 
  Square, 
  RotateCcw,
  UserCheck,
  Award
} from 'lucide-react';
import { 
  Player, 
  Session, 
  MetricDefinition, 
  MetricEntry, 
  AttendanceStatus 
} from '../types';
import { StorageService } from '../services/storage';

interface QuickInsertViewProps {
  players: Player[];
  sessions: Session[];
  metrics: MetricDefinition[];
  onOpenCreateSession: () => void;
  onRefreshData: () => void;
}

export const QuickInsertView: React.FC<QuickInsertViewProps> = ({
  players,
  sessions,
  metrics,
  onOpenCreateSession,
  onRefreshData
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [activeMode, setActiveMode] = useState<'attendance' | 'drill' | 'match'>('attendance');
  const [selectedMetricId, setSelectedMetricId] = useState<string>('');

  // Local state for batch attendance
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});

  // Local state for drill values (playerId -> string/number)
  const [drillValues, setDrillValues] = useState<Record<string, number>>({});

  // Built-in Field Stopwatch Timer State
  const [stopwatchTime, setStopwatchTime] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [timerSelectedPlayerId, setTimerSelectedPlayerId] = useState<string>('');

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions]);

  useEffect(() => {
    if (metrics.length > 0 && !selectedMetricId) {
      // Default to 40m dash or first non-attendance metric
      const nonAtt = metrics.find(m => m.type !== 'attendance') || metrics[0];
      setSelectedMetricId(nonAtt.id);
    }
  }, [metrics]);

  // Load existing entries for selected session to prefill
  useEffect(() => {
    if (selectedSessionId) {
      const allEntries = StorageService.getEntries();
      const sessionEntries = allEntries.filter(e => e.sessionId === selectedSessionId);

      // Attendance map
      const attMap: Record<string, AttendanceStatus> = {};
      const attendanceMetric = metrics.find(m => m.type === 'attendance');

      players.forEach(p => {
        attMap[p.id] = 'present'; // default
      });

      sessionEntries.forEach(entry => {
        if (attendanceMetric && entry.metricId === attendanceMetric.id) {
          if (entry.value === 100) attMap[entry.playerId] = 'present';
          else if (entry.value === 50) attMap[entry.playerId] = 'late';
          else if (entry.value === 0) attMap[entry.playerId] = 'absent';
          else if (entry.value < 0) attMap[entry.playerId] = 'excused';
        }
      });
      setAttendanceMap(attMap);

      // Drill values map for selected metric
      if (selectedMetricId) {
        const valMap: Record<string, number> = {};
        sessionEntries.forEach(entry => {
          if (entry.metricId === selectedMetricId) {
            valMap[entry.playerId] = entry.value;
          }
        });
        setDrillValues(valMap);
      }
    }
  }, [selectedSessionId, selectedMetricId, players, metrics]);

  // Stopwatch interval timer
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setStopwatchTime(prev => prev + 10); // +10ms
      }, 10);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- ATTENDANCE MODE ACTIONS ---
  const handleToggleAttendance = (playerId: string) => {
    setAttendanceMap(prev => {
      const current = prev[playerId] || 'present';
      let next: AttendanceStatus = 'present';
      if (current === 'present') next = 'late';
      else if (current === 'late') next = 'absent';
      else if (current === 'absent') next = 'excused';
      else if (current === 'excused') next = 'present';
      return { ...prev, [playerId]: next };
    });
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = {};
    players.forEach(p => {
      updated[p.id] = 'present';
    });
    setAttendanceMap(updated);
  };

  const handleSaveAttendance = () => {
    if (!selectedSessionId) return;
    const attMetric = metrics.find(m => m.type === 'attendance');
    if (!attMetric) return;

    const entriesToSave: Omit<MetricEntry, 'id' | 'timestamp'>[] = [];

    Object.entries(attendanceMap).forEach(([playerId, status]) => {
      let numericVal = 100;
      let rawVal = 'Present';
      if (status === 'late') { numericVal = 50; rawVal = 'Late'; }
      if (status === 'absent') { numericVal = 0; rawVal = 'Absent'; }
      if (status === 'excused') { numericVal = -1; rawVal = 'Excused'; }

      entriesToSave.push({
        sessionId: selectedSessionId,
        playerId,
        metricId: attMetric.id,
        value: numericVal,
        rawValue: rawVal
      });
    });

    StorageService.batchSaveEntries(entriesToSave);
    onRefreshData();
    showToast('✓ Session attendance batch saved successfully!');
  };

  // --- DRILL VALUE ACTIONS ---
  const handleUpdateDrillValue = (playerId: string, delta: number) => {
    const currentMetric = metrics.find(m => m.id === selectedMetricId);
    if (!currentMetric) return;

    setDrillValues(prev => {
      const val = prev[playerId] ?? (currentMetric.type === 'time_seconds' ? 5.5 : 0);
      const updated = Math.max(0, Math.round((val + delta) * 100) / 100);
      return { ...prev, [playerId]: updated };
    });
  };

  const handleSetExactDrillValue = (playerId: string, value: number) => {
    setDrillValues(prev => ({ ...prev, [playerId]: Math.max(0, value) }));
  };

  const handleSaveDrillValues = () => {
    if (!selectedSessionId || !selectedMetricId) return;
    const currentMetric = metrics.find(m => m.id === selectedMetricId);
    if (!currentMetric) return;

    const entriesToSave: Omit<MetricEntry, 'id' | 'timestamp'>[] = [];

    Object.entries(drillValues).forEach(([playerId, val]: [string, number]) => {
      if (val !== undefined && val !== null) {
        entriesToSave.push({
          sessionId: selectedSessionId,
          playerId,
          metricId: selectedMetricId,
          value: val,
          rawValue: `${val} ${currentMetric.unit}`
        });
      }
    });

    StorageService.batchSaveEntries(entriesToSave);
    onRefreshData();
    showToast(`✓ Batch entries saved for ${currentMetric.name}!`);
  };

  // Timer Split Assignment
  const handleAssignTimerToPlayer = (playerId: string) => {
    const seconds = Math.round((stopwatchTime / 1000) * 100) / 100;
    handleSetExactDrillValue(playerId, seconds);
    showToast(`Assigned ${seconds}s sprint time to player!`);
  };

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const selectedMetric = metrics.find(m => m.id === selectedMetricId);

  return (
    <div className="space-y-6 pb-28">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-emerald-500 text-slate-950 font-extrabold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-emerald-300 animate-bounce">
          <Check className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <Zap className="w-4 h-4" />
              <span>Field Quick Data Entry</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Practice & Match Quick Logger
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Rapidly tap player attendance, log sprint times with built-in field stopwatch, or record match goals.
            </p>
          </div>

          <button
            onClick={onOpenCreateSession}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-semibold text-xs sm:text-sm transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Session</span>
          </button>
        </div>

        {/* Active Session Picker Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-3">
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Target Session:</span>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-semibold focus:outline-none focus:border-emerald-500"
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.date} • {s.title} ({s.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Insert Mode Selector (iOS Segmented Control) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 grid grid-cols-3 gap-1 shadow-inner">
        <button
          onClick={() => setActiveMode('attendance')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 ${
            activeMode === 'attendance'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Attendance</span>
        </button>

        <button
          onClick={() => setActiveMode('drill')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 ${
            activeMode === 'drill'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Timer className="w-4 h-4" />
          <span>Drills & Times</span>
        </button>

        <button
          onClick={() => setActiveMode('match')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 ${
            activeMode === 'match'
              ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Match Stats</span>
        </button>
      </div>

      {/* --- MODE 1: ATTENDANCE BATCH TAP GRID --- */}
      {activeMode === 'attendance' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/50 p-4 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Tap to Cycle Status</h3>
                <p className="text-xs text-slate-400">Green = Present (100%), Yellow = Late (50%), Red = Absent (0%), Gray = Excused</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAllPresent}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
              >
                Mark All Present
              </button>
              <button
                onClick={handleSaveAttendance}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Save Attendance</span>
              </button>
            </div>
          </div>

          {/* Touch Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map(player => {
              const status = attendanceMap[player.id] || 'present';
              let colorBg = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
              let badgeLabel = 'Present (100%)';

              if (status === 'late') {
                colorBg = 'bg-amber-500/15 border-amber-500/40 text-amber-300';
                badgeLabel = 'Late (50%)';
              } else if (status === 'absent') {
                colorBg = 'bg-rose-500/15 border-rose-500/40 text-rose-300';
                badgeLabel = 'Absent (0%)';
              } else if (status === 'excused') {
                colorBg = 'bg-slate-700/30 border-slate-600 text-slate-400';
                badgeLabel = 'Excused (N/A)';
              }

              return (
                <div
                  key={player.id}
                  onClick={() => handleToggleAttendance(player.id)}
                  className={`border rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer select-none transition-all duration-150 active:scale-95 hover:border-slate-600 ${colorBg}`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={player.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128'}
                      alt={player.name}
                      className="w-11 h-11 rounded-xl object-cover ring-2 ring-slate-800"
                    />
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{player.name}</span>
                        <span className="text-xs font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          #{player.jerseyNumber}
                        </span>
                      </div>
                      <span className="text-xs font-bold mt-0.5 inline-block">
                        {badgeLabel}
                      </span>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-slate-950/60 flex items-center justify-center font-bold text-xs border border-slate-700/60">
                    Tap
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- MODE 2: DRILLS, TIMED SPRINTS & MEASURABLES --- */}
      {activeMode === 'drill' && (
        <div className="space-y-6">
          {/* Field Stopwatch Tool */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider mb-1">
                  <Timer className="w-4 h-4" />
                  <span>Field Stopwatch Sprint Timer</span>
                </div>
                <div className="text-4xl font-black font-mono tracking-wider text-white">
                  {(stopwatchTime / 1000).toFixed(2)}
                  <span className="text-base font-normal text-slate-400 ml-1">sec</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isTimerRunning ? (
                  <button
                    onClick={() => setIsTimerRunning(true)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg transition-all active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>Start Timer</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsTimerRunning(false)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-sm shadow-lg transition-all active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    <span>Stop Timer</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsTimerRunning(false);
                    setStopwatchTime(0);
                  }}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95"
                  title="Reset Stopwatch"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Metric Selector & Batch Save */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Target Drill:</span>
              <select
                value={selectedMetricId}
                onChange={(e) => setSelectedMetricId(e.target.value)}
                className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-blue-500"
              >
                {metrics.filter(m => m.type !== 'attendance').map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSaveDrillValues}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-extrabold shadow-lg shadow-blue-500/20 transition-all active:scale-95 shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>Save Drill Entries</span>
            </button>
          </div>

          {/* Player Rapid Entry List */}
          <div className="space-y-3">
            {players.map(player => {
              const val = drillValues[player.id] ?? (selectedMetric?.type === 'time_seconds' ? 5.2 : 0);
              const isTimeMetric = selectedMetric?.type === 'time_seconds';
              const step = isTimeMetric ? 0.05 : 1;

              return (
                <div
                  key={player.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={player.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128'}
                      alt={player.name}
                      className="w-11 h-11 rounded-xl object-cover ring-2 ring-slate-800"
                    />
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{player.name}</span>
                        <span className="text-xs font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          #{player.jerseyNumber} • {player.position}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedMetric?.name}: <strong className="text-blue-400 font-bold">{val} {selectedMetric?.unit}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Right Input Controls */}
                  <div className="flex items-center gap-3">
                    {/* Timer assign button if stopwatch has value */}
                    {isTimeMetric && stopwatchTime > 0 && (
                      <button
                        onClick={() => handleAssignTimerToPlayer(player.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-xs font-semibold transition-all active:scale-95"
                      >
                        Assign Split
                      </button>
                    )}

                    {/* Incremental Controls */}
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
                      <button
                        onClick={() => handleUpdateDrillValue(player.id, -step)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all active:scale-95"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        step={step}
                        value={val}
                        onChange={(e) => handleSetExactDrillValue(player.id, parseFloat(e.target.value) || 0)}
                        className="w-20 text-center font-black text-sm text-white bg-transparent focus:outline-none"
                      />

                      <button
                        onClick={() => handleUpdateDrillValue(player.id, step)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- MODE 3: MATCH STATS QUICK COUNTER --- */}
      {activeMode === 'match' && (
        <div className="space-y-4">
          <div className="bg-slate-900/50 p-4 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Live Match Quick Counters</h3>
              <p className="text-xs text-slate-400">Tap +1 to rapidly increment match stats for active players</p>
            </div>
            <button
              onClick={handleSaveDrillValues}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-extrabold shadow-lg shadow-purple-500/20 transition-all active:scale-95 shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>Save Match Stats</span>
            </button>
          </div>

          <div className="space-y-3">
            {players.map(player => {
              const goalVal = drillValues[`${player.id}_m_goals`] ?? 0;
              const assistVal = drillValues[`${player.id}_m_assists`] ?? 0;
              const tackleVal = drillValues[`${player.id}_m_tackles`] ?? 0;

              return (
                <div
                  key={player.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={player.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128'}
                      alt={player.name}
                      className="w-11 h-11 rounded-xl object-cover ring-2 ring-slate-800"
                    />
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{player.name}</span>
                        <span className="text-xs font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          #{player.jerseyNumber} • {player.position}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Counter Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Goals */}
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
                      <span className="text-rose-400 font-bold">Goals:</span>
                      <span className="text-white font-extrabold w-5 text-center">{goalVal}</span>
                      <button
                        onClick={() => {
                          const updated = goalVal + 1;
                          setDrillValues(prev => ({ ...prev, [`${player.id}_m_goals`]: updated }));
                          // also save entry
                          if (selectedSessionId) {
                            StorageService.addOrUpdateEntry({
                              sessionId: selectedSessionId,
                              playerId: player.id,
                              metricId: 'm_goals',
                              value: updated,
                              rawValue: `${updated} goals`
                            });
                          }
                        }}
                        className="p-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-all active:scale-95"
                      >
                        +1
                      </button>
                    </div>

                    {/* Assists */}
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
                      <span className="text-purple-400 font-bold">Assists:</span>
                      <span className="text-white font-extrabold w-5 text-center">{assistVal}</span>
                      <button
                        onClick={() => {
                          const updated = assistVal + 1;
                          setDrillValues(prev => ({ ...prev, [`${player.id}_m_assists`]: updated }));
                          if (selectedSessionId) {
                            StorageService.addOrUpdateEntry({
                              sessionId: selectedSessionId,
                              playerId: player.id,
                              metricId: 'm_assists',
                              value: updated,
                              rawValue: `${updated} assists`
                            });
                          }
                        }}
                        className="p-1 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all active:scale-95"
                      >
                        +1
                      </button>
                    </div>

                    {/* Tackles */}
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
                      <span className="text-indigo-400 font-bold">Tackles:</span>
                      <span className="text-white font-extrabold w-5 text-center">{tackleVal}</span>
                      <button
                        onClick={() => {
                          const updated = tackleVal + 1;
                          setDrillValues(prev => ({ ...prev, [`${player.id}_m_tackles`]: updated }));
                          if (selectedSessionId) {
                            StorageService.addOrUpdateEntry({
                              sessionId: selectedSessionId,
                              playerId: player.id,
                              metricId: 'm_tackles',
                              value: updated,
                              rawValue: `${updated} tackles`
                            });
                          }
                        }}
                        className="p-1 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-all active:scale-95"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
