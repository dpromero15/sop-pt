import React from 'react';
import { 
  X, 
  Trophy, 
  CalendarCheck, 
  Footprints, 
  Activity, 
  Zap, 
  Shield, 
  Target, 
  TrendingUp, 
  Sparkles, 
  FileText, 
  Clock 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import { Player, LabelDefinition, MetricEntry, MetricDefinition } from '../types';
import { calculatePlayerRankings } from '../utils/scoring';
import { StorageService } from '../services/storage';

interface PlayerProfileModalProps {
  player: Player | null;
  onClose: () => void;
  onEditPlayer: (player: Player) => void;
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  onClose,
  onEditPlayer,
  labels,
  metrics
}) => {
  if (!player) return null;

  const allPlayers = StorageService.getPlayers();
  const allEntries = StorageService.getEntries();
  const formula = StorageService.getFormula();

  // Compute this player's exact label breakdown
  const rankings = calculatePlayerRankings(allPlayers, allEntries, metrics, labels, formula);
  const playerRanking = rankings.find(r => r.player.id === player.id);

  // Radar: unscored categories plot at a low hidden placeholder (shape only — not a real score).
  const radarData = labels.map((lbl) => {
    const lScore = playerRanking?.labelScores[lbl.id]?.score ?? null;
    return {
      category: lbl.name,
      score: lScore ?? 20,
      fullMark: 100,
    };
  });

  // Recent Metric Entries for history list
  const playerEntries = allEntries
    .filter(e => e.playerId === player.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Trend line chart data
  const trendData = playerEntries.slice(0, 10).reverse().map((entry, idx) => ({
    session: `S${idx + 1}`,
    value: entry.value
  }));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative text-white">
        
        {/* Top Sticky Bar */}
        <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Player Performance Sheet
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-xs font-bold border border-emerald-500/20">
              Rank #{playerRanking?.rank ?? '-'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditPlayer(player)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
            >
              Edit Profile
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 space-y-6">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800/60 to-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <img
                src={player.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256'}
                alt={player.name}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-slate-800 shadow-xl"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-white">{player.name}</h2>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 font-black text-sm border border-emerald-500/30">
                    #{player.jerseyNumber}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-2">
                  <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 font-bold">
                    Position: {player.position}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 font-bold">
                    Foot: {player.preferredFoot}
                  </span>
                  {player.age && (
                    <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 font-bold">
                      Age: {player.age}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Rank Metric Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center sm:text-right shrink-0 min-w-[9rem]">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Overall Rank
              </span>
              <div className="text-3xl font-black text-emerald-400 tracking-tight mt-0.5">
                {playerRanking?.overallRank != null
                  ? `#${playerRanking.overallRank}`
                  : 'Unscored'}
              </div>
              {playerRanking?.totalScore != null && (
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  Standing {playerRanking.totalScore}
                </div>
              )}
              <div className="text-xs text-slate-400 font-semibold mt-2">
                Adjusted:{' '}
                <span className="text-slate-200">
                  {playerRanking?.adjustedRank != null
                    ? `#${playerRanking.adjustedRank}`
                    : '—'}
                </span>
                {playerRanking?.adjustedTotalScore != null && (
                  <span className="text-slate-500">
                    {' '}
                    ({playerRanking.adjustedTotalScore})
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 font-semibold mt-1">
                Attendance:{' '}
                <span className="text-emerald-400">
                  {playerRanking?.attendanceRate !== null &&
                  playerRanking?.attendanceRate !== undefined
                    ? `${playerRanking.attendanceRate}%`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Radar Chart & Category Scores Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Spider Radar Chart */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Skill Polygon Radar</span>
              </h3>
              <div className="h-64 w-full">
                {radarData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-4">
                    No category labels configured.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="category" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" />
                      <Radar
                        name={player.name}
                        dataKey="score"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.4}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Category Breakdown Cards */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Category Breakdown</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {labels.map(lbl => {
                  const lScore = playerRanking?.labelScores[lbl.id]?.score ?? null;
                  return (
                    <div 
                      key={lbl.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                    >
                      <span className="text-xs text-slate-400 font-medium">{lbl.name}:</span>
                      <span className={`text-sm font-extrabold ${
                        lScore === null
                          ? 'text-slate-500'
                          : lScore >= 85
                            ? 'text-emerald-400'
                            : lScore >= 70
                              ? 'text-blue-400'
                              : 'text-amber-400'
                      }`}>
                        {lScore ?? '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Player Notes */}
              {player.notes && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 mt-4">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                    Coach Notes:
                  </span>
                  <p className="text-xs text-slate-300 italic">{player.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Metric Log Entries Table */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Logged Session Activity</span>
            </h3>

            {playerEntries.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No metric entries logged for this player yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {playerEntries.map(entry => {
                  const metric = metrics.find(m => m.id === entry.metricId);
                  return (
                    <div
                      key={entry.id}
                      className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{metric?.name || entry.metricId}:</span>
                        <span className="text-slate-400 text-[11px] ml-2">{new Date(entry.timestamp).toLocaleDateString()}</span>
                      </div>
                      <span className="font-extrabold text-emerald-400">{entry.rawValue || entry.value}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
