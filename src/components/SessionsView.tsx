import React, { useEffect, useState } from 'react';
import { 
  Calendar, 
  Plus, 
  MapPin, 
  Clock, 
  Trash2, 
  RotateCcw,
  X, 
  Target, 
} from 'lucide-react';
import { AttendanceStatus, Session, SessionType, Player, MetricDefinition } from '../types';
import { StorageService } from '../services/storage';
import { SessionMetricPlanner } from './logger/SessionMetricPlanner';
import {
  defaultMetricIdsForSessionType,
  formatSessionListDate,
  indexEntriesBySessionId,
  sessionPreviewStats,
} from '../utils/sessionMetrics';
import { SaveAndSyncButton } from './SaveAndSyncButton';
import { SessionTitleEditor } from './logger/SessionTitleEditor';

const ATTENDANCE_BREAKDOWN: {
  status: AttendanceStatus;
  letter: string;
  label: string;
  className: string;
}[] = [
  { status: 'present', letter: 'H', label: 'Here', className: 'text-emerald-400' },
  { status: 'late', letter: 'L', label: 'Late', className: 'text-amber-300' },
  { status: 'absent', letter: 'O', label: 'Out', className: 'text-rose-400' },
  { status: 'excused', letter: 'E', label: 'Excused', className: 'text-amber-600' },
];

interface SessionsViewProps {
  sessions: Session[];
  players: Player[];
  metrics: MetricDefinition[];
  onRefreshData: () => void;
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  onOpenAddModal: () => void;
  onOpenQuickInsertForSession: (sessionId: string) => void;
  readOnly?: boolean;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  players,
  metrics,
  onRefreshData,
  isAddModalOpen,
  onCloseAddModal,
  onOpenAddModal,
  onOpenQuickInsertForSession,
  readOnly = false,
}) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(sessions[0] || null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState('18:00');
  const [formType, setFormType] = useState<SessionType>('session');
  const [formLocation, setFormLocation] = useState('Central Turf Field');
  const [formOpponent, setFormOpponent] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formMetricIds, setFormMetricIds] = useState<string[]>(() =>
    defaultMetricIdsForSessionType('session'),
  );

  useEffect(() => {
    if (!selectedSession) return;
    const fresh = sessions.find((s) => s.id === selectedSession.id);
    if (fresh && fresh !== selectedSession) {
      setSelectedSession(fresh);
    }
  }, [sessions, selectedSession]);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const newSess = StorageService.addSession({
      title: formTitle,
      date: formDate,
      time: formTime,
      type: formType,
      status: 'open',
      location: formLocation,
      opponent: formType === 'match' ? formOpponent : undefined,
      notes: formNotes,
      metricIds: formMetricIds,
    });

    onCloseAddModal();
    onRefreshData();
    setSelectedSession(newSess);

    // Reset Form
    setFormTitle('');
    setFormNotes('');
    setFormMetricIds(defaultMetricIdsForSessionType('session'));
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      confirm(
        'Move this session to trash? Logged metrics stay with it so you can restore. Sessions still in trash after 90 days are permanently removed.',
      )
    ) {
      StorageService.deleteSession(id);
      onRefreshData();
      if (selectedSession?.id === id) {
        setSelectedSession(null);
      }
    }
  };

  const filteredSessions = sessions.filter(s => {
    if (typeFilter === 'all') return true;
    return s.type === typeFilter;
  });

  const allEntries = StorageService.getEntries();
  const entriesBySession = indexEntriesBySessionId(allEntries);
  const activeSessionEntries = selectedSession
    ? entriesBySession.get(selectedSession.id) ?? []
    : [];

  return (
    <div className="space-y-4 pb-28">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs uppercase tracking-wider mb-0.5">
              <Calendar className="w-4 h-4" />
              <span>Season Timeline</span>
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Sessions & Matches ({sessions.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!readOnly && (
              <SaveAndSyncButton compact />
            )}
            {!readOnly && (
            <button
              onClick={() => {
                setFormTitle('');
                setFormMetricIds(defaultMetricIdsForSessionType(formType));
                onOpenAddModal();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-extrabold text-xs sm:text-sm transition-all active:scale-95 shadow-lg shadow-purple-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create Session</span>
            </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: 'All Sessions' },
          { id: 'session', label: 'Sessions' },
          { id: 'match', label: 'Matches' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setTypeFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              typeFilter === tab.id
                ? 'bg-purple-500 text-white font-bold shadow-md shadow-purple-500/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sessions Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: compact session previews */}
        <div className="space-y-1 lg:col-span-1">
          <p className="px-0.5 text-[10px] uppercase tracking-wider text-slate-600">
            <span className="text-emerald-400/80">H</span> here ·{' '}
            <span className="text-amber-300/80">L</span> late ·{' '}
            <span className="text-rose-400/80">O</span> out ·{' '}
            <span className="text-amber-600/80">E</span> excused
          </p>
          {filteredSessions.map(session => {
            const isSelected = selectedSession?.id === session.id;
            const preview = sessionPreviewStats(entriesBySession.get(session.id) ?? []);

            return (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={`flex items-center gap-2 border rounded-xl px-2.5 py-1.5 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 border-purple-500/60 ring-1 ring-purple-500/20'
                    : 'bg-slate-900/80 hover:bg-slate-800/60 border-slate-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    session.status === 'open' ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                  title={session.status === 'open' ? 'Open' : 'Closed'}
                />
                <span
                  className={`text-[10px] font-extrabold w-3 shrink-0 ${
                    session.type === 'match' ? 'text-rose-300' : 'text-purple-300'
                  }`}
                  title={session.type === 'match' ? 'Match' : 'Session'}
                >
                  {session.type === 'match' ? 'M' : 'S'}
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs font-bold tabular-nums text-white">
                  {formatSessionListDate(session.date)}
                </span>

                <div
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] font-extrabold tabular-nums"
                  title="Attendance: here / late / out / excused"
                >
                  {preview.markedCount === 0 ? (
                    <span className="text-slate-600">—</span>
                  ) : (
                    ATTENDANCE_BREAKDOWN.map(({ status, letter, label, className }) => (
                      <span
                        key={status}
                        className={preview.attendance[status] > 0 ? className : 'text-slate-700'}
                        title={`${label}: ${preview.attendance[status]}`}
                      >
                        {preview.attendance[status]}
                        {letter}
                      </span>
                    ))
                  )}
                </div>

                <span className="w-3.5 shrink-0 flex items-center justify-center">
                  {preview.hasScoredMetrics && (
                    <Target
                      className="w-3.5 h-3.5 text-sky-400"
                      aria-label="Metrics scored"
                      title="Metrics scored"
                    />
                  )}
                </span>

                {!readOnly && (
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="p-1 rounded-md text-slate-600 hover:text-rose-400 hover:bg-slate-700 transition-all"
                    aria-label={`Delete ${session.title}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Session Inspector */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          {selectedSession ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <span className="text-xs text-purple-400 font-bold uppercase tracking-wider">
                    Session Inspector
                  </span>
                  <SessionTitleEditor
                    title={selectedSession.title}
                    readOnly={readOnly}
                    onSave={(title) => {
                      StorageService.updateSession({ ...selectedSession, title });
                      onRefreshData();
                      setSelectedSession({ ...selectedSession, title });
                    }}
                  />
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className={`font-bold uppercase tracking-wider ${
                      selectedSession.status === 'open' ? 'text-emerald-400' : 'text-slate-500'
                    }`}>
                      {selectedSession.status}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {selectedSession.date} {selectedSession.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {selectedSession.location || 'Home Field'}
                    </span>
                  </div>
                  <div className="mt-3">
                    <SessionMetricPlanner
                      metrics={metrics}
                      metricIds={selectedSession.metricIds}
                      sessionType={selectedSession.type}
                      onChange={(metricIds) => {
                        StorageService.updateSession({ ...selectedSession, metricIds });
                        onRefreshData();
                        setSelectedSession({ ...selectedSession, metricIds });
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => onOpenQuickInsertForSession(selectedSession.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {selectedSession.status === 'closed'
                      ? 'Reopen & Insert Data'
                      : 'Insert Data For Session'}
                  </span>
                </button>
              </div>

              {/* Logged Data per Player */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Session Metric Log Entries ({activeSessionEntries.length})
                </h4>

                {activeSessionEntries.length === 0 ? (
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-8 text-center space-y-2">
                    <p className="text-slate-400 text-xs">
                      No entries stored for this session. Tap{' '}
                      <strong>"Insert Data For Session"</strong> to record
                      attendance (and any scores).
                    </p>
                    {allEntries.length === 0 && sessions.length > 0 && (
                      <p className="text-amber-200/90 text-[11px]">
                        Sessions exist but this browser has zero metric entries.
                        If you already took attendance, cloud sync may have
                        overwritten local logs — tap the nav sync chip → Sync
                        now, or log attendance again.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {players.map(player => {
                      const pEntries = activeSessionEntries.filter(e => e.playerId === player.id);
                      if (pEntries.length === 0) return null;

                      return (
                        <div
                          key={player.id}
                          className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-md bg-slate-800 font-extrabold text-[11px] text-slate-300 flex items-center justify-center">
                              #{player.jerseyNumber}
                            </span>
                            <span className="font-bold text-white text-xs">{player.name}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {pEntries.map(entry => {
                              const metric = metrics.find(m => m.id === entry.metricId);
                              return (
                                <span
                                  key={entry.id}
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
                                >
                                  {metric?.name}: <strong className="text-emerald-400 font-bold">{entry.rawValue || entry.value}</strong>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-center py-12 text-xs">Select a session to view details.</p>
          )}
        </div>
      </div>

      {(() => {
        const deleted = StorageService.getDeletedSessions();
        if (deleted.length === 0) return null;
        return (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Recently deleted
              </h3>
              <p className="text-xs text-slate-500">
                Restore within 90 days. Logged metrics stay with the session
                until then.
              </p>
            </div>
            <ul className="space-y-2">
              {deleted.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100 truncate">
                      {session.title}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {session.date}
                      {session.deletedAt
                        ? ` · deleted ${new Date(session.deletedAt).toLocaleDateString()}`
                        : ''}
                    </div>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        StorageService.restoreSession(session.id);
                        onRefreshData();
                      }}
                      className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold px-2.5 py-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Modal Form to Create New Session */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-400" />
                <span>Create New Session</span>
              </h3>
              <button
                onClick={onCloseAddModal}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Session Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tuesday Tactical Practice & Sprint Testing"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Session Type</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      const next = e.target.value as SessionType;
                      setFormType(next);
                      setFormMetricIds(defaultMetricIdsForSessionType(next));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="session">Session</option>
                    <option value="match">Match</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Time</label>
                  <input
                    type="text"
                    placeholder="18:00"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="Field A / Stadium"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {formType === 'match' && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Opponent Team Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Red Hawks FC"
                    value={formOpponent}
                    onChange={(e) => setFormOpponent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <SessionMetricPlanner
                metrics={metrics}
                metricIds={formMetricIds}
                sessionType={formType}
                onChange={setFormMetricIds}
              />

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseAddModal}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-500 text-white font-extrabold hover:bg-purple-400 shadow-lg shadow-purple-500/20"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
