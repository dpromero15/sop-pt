import React, { useEffect, useState } from 'react';
import { 
  Calendar, 
  Plus, 
  MapPin, 
  Clock, 
  FileText, 
  CheckCircle, 
  Trash2, 
  X, 
  Target, 
  Flame, 
  ChevronRight 
} from 'lucide-react';
import { Session, SessionType, Player, MetricDefinition, MetricEntry } from '../types';
import { StorageService } from '../services/storage';
import { SessionMetricPlanner } from './logger/SessionMetricPlanner';
import { defaultMetricIdsForSessionType } from '../utils/sessionMetrics';

interface SessionsViewProps {
  sessions: Session[];
  players: Player[];
  metrics: MetricDefinition[];
  onRefreshData: () => void;
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  onOpenAddModal: () => void;
  onOpenQuickInsertForSession: (sessionId: string) => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  players,
  metrics,
  onRefreshData,
  isAddModalOpen,
  onCloseAddModal,
  onOpenAddModal,
  onOpenQuickInsertForSession
}) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(sessions[0] || null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState('18:00');
  const [formType, setFormType] = useState<SessionType>('practice');
  const [formLocation, setFormLocation] = useState('Central Turf Field');
  const [formOpponent, setFormOpponent] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formMetricIds, setFormMetricIds] = useState<string[]>(() =>
    defaultMetricIdsForSessionType('practice'),
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
    setFormMetricIds(defaultMetricIdsForSessionType('practice'));
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this session and all its logged metrics?')) {
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
  const activeSessionEntries = selectedSession 
    ? allEntries.filter(e => e.sessionId === selectedSession.id)
    : [];

  return (
    <div className="space-y-6 pb-28">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <Calendar className="w-4 h-4" />
              <span>Season Timeline</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Practice & Match Sessions ({sessions.length})
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Schedule practices, competitive matches, and fitness combine testing days.
            </p>
          </div>

          <button
            onClick={() => {
              setFormTitle('');
              setFormMetricIds(defaultMetricIdsForSessionType(formType));
              onOpenAddModal();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-extrabold text-xs sm:text-sm transition-all active:scale-95 shrink-0 shadow-lg shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Session</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: 'All Sessions' },
          { id: 'practice', label: 'Practices' },
          { id: 'match', label: 'Matches' },
          { id: 'fitness_test', label: 'Fitness Testing' }
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Session List */}
        <div className="space-y-3 lg:col-span-1">
          {filteredSessions.map(session => {
            const isSelected = selectedSession?.id === session.id;
            const entriesCount = allEntries.filter(e => e.sessionId === session.id).length;

            return (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={`border rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-md relative ${
                  isSelected 
                    ? 'bg-slate-800 border-purple-500/60 ring-2 ring-purple-500/20' 
                    : 'bg-slate-900/80 hover:bg-slate-800/60 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                        session.type === 'match'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : session.type === 'fitness_test'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                      }`}>
                        {session.type.replace('_', ' ')}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                        session.status === 'open'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-500/15 text-slate-400 border-slate-600/40'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-sm mt-1.5 line-clamp-1">
                      {session.title}
                    </h3>
                  </div>

                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-700 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    {session.date} {session.time}
                  </span>
                  <span>• {entriesCount} metrics logged</span>
                </div>
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
                  <h3 className="text-xl font-extrabold text-white">{selectedSession.title}</h3>
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
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-8 text-center">
                    <p className="text-slate-400 text-xs">
                      No metrics logged yet for this session. Tap <strong>"Insert Data For Session"</strong> to record attendance, sprint times, or match stats!
                    </p>
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
                    <option value="practice">Practice Session</option>
                    <option value="match">Competitive Match</option>
                    <option value="fitness_test">Fitness Combine Day</option>
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
