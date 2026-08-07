import React, { useState } from 'react';
import { 
  Trophy, 
  Sliders, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight, 
  Sparkles, 
  Download, 
  CheckCircle2, 
  Zap, 
  Award,
  ArrowUpDown
} from 'lucide-react';
import { 
  Player, 
  MetricDefinition, 
  LabelDefinition, 
  ScoringFormulaConfig, 
  PlayerRanking 
} from '../types';
import { formatMetricValue } from '../utils/scoring';

interface RankingsViewProps {
  rankings: PlayerRanking[];
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
  formula: ScoringFormulaConfig;
  onOpenFormulaConfig: () => void;
  onSelectPlayer: (player: Player) => void;
  onOpenQuickInsert: () => void;
}

export const RankingsView: React.FC<RankingsViewProps> = ({
  rankings,
  labels,
  metrics,
  formula,
  onOpenFormulaConfig,
  onSelectPlayer,
  onOpenQuickInsert
}) => {
  const [selectedLabelId, setSelectedLabelId] = useState<string | 'all'>('all');
  const [selectedMetricId, setSelectedMetricId] = useState<string | 'none'>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'label' | 'metric'>('total');

  // Filtered & Sorted Rankings
  const filteredRankings = rankings.filter(r => {
    const matchesSearch = r.player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.player.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.player.jerseyNumber.toString() === searchQuery;
    return matchesSearch;
  });

  // Sort by specific label score or metric if requested
  const sortedRankings = [...filteredRankings].sort((a, b) => {
    if (sortBy === 'label' && selectedLabelId !== 'all') {
      const scoreA = a.labelScores[selectedLabelId]?.score ?? 0;
      const scoreB = b.labelScores[selectedLabelId]?.score ?? 0;
      return scoreB - scoreA;
    }
    if (sortBy === 'metric' && selectedMetricId !== 'none') {
      const metric = metrics.find(m => m.id === selectedMetricId);
      const valA = a.labelScores[metric?.labelId ?? '']?.metrics.find(m => m.metricId === selectedMetricId)?.latestValue ?? -999;
      const valB = b.labelScores[metric?.labelId ?? '']?.metrics.find(m => m.metricId === selectedMetricId)?.latestValue ?? -999;
      if (metric && !metric.higherIsBetter) {
        return valA - valB; // Lower is better
      }
      return valB - valA;
    }
    return b.totalScore - a.totalScore;
  });

  const activeLabel = labels.find(l => l.id === selectedLabelId);
  const activeMetric = metrics.find(m => m.id === selectedMetricId);

  // CSV Export
  const handleExportCSV = () => {
    let csv = 'Rank,Player Name,Jersey,Position,Total Score,Attendance Rate\n';
    sortedRankings.forEach((r, idx) => {
      csv += `${idx + 1},"${r.player.name}",#${r.player.jerseyNumber},${r.player.position},${r.totalScore},${r.attendanceRate}%\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Thunder_FC_Leaderboard_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Top Banner: Formula Summary & Quick Tweaker */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs tracking-wider uppercase mb-1">
              <Trophy className="w-4 h-4" />
              <span>Configurable Scoring Engine</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Season Player Leaderboard
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
              Rankings automatically compute normalized scores across all logged metrics, weighted by your custom coaching labels formula.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenFormulaConfig}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-medium text-xs sm:text-sm transition-all active:scale-95"
            >
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Configure Formula</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-all active:scale-95"
              title="Export CSV Leaderboard"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Formula Weights Pills */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Active Weights:</span>
          {formula.weights.filter(w => w.enabled && w.weightPercent > 0).map(w => {
            const labelDef = labels.find(l => l.id === w.labelId);
            if (!labelDef) return null;
            return (
              <span 
                key={w.labelId}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-medium ${labelDef.badgeBg}`}
              >
                <span>{labelDef.name}</span>
                <span className="font-bold">{w.weightPercent}%</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Filter Toolbar & Metric Switches */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-4 backdrop-blur-sm">
        {/* Search & Main Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search player name, position, jersey #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Metric Selector Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedMetricId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedMetricId(val);
                if (val !== 'none') {
                  setSortBy('metric');
                } else {
                  setSortBy('total');
                }
              }}
              className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="none">Overall Total Score Ranking</option>
              {metrics.map(m => (
                <option key={m.id} value={m.id}>
                  Specific Metric: {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Label Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => {
              setSelectedLabelId('all');
              setSelectedMetricId('none');
              setSortBy('total');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedLabelId === 'all' && selectedMetricId === 'none'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Categories
          </button>

          {labels.map(lbl => {
            const isSelected = selectedLabelId === lbl.id;
            return (
              <button
                key={lbl.id}
                onClick={() => {
                  setSelectedLabelId(lbl.id);
                  setSelectedMetricId('none');
                  setSortBy('label');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-slate-200 text-slate-900 font-bold shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {lbl.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leaderboard Cards Grid */}
      <div className="space-y-3">
        {sortedRankings.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-300">No players found</h3>
            <p className="text-slate-500 text-xs mt-1">
              Try adjusting search query or register new players in the team roster.
            </p>
          </div>
        ) : (
          sortedRankings.map((item, idx) => {
            const isTop1 = idx === 0 && selectedLabelId === 'all' && selectedMetricId === 'none';
            const isTop2 = idx === 1 && selectedLabelId === 'all' && selectedMetricId === 'none';
            const isTop3 = idx === 2 && selectedLabelId === 'all' && selectedMetricId === 'none';

            let rankBadgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';
            if (isTop1) rankBadgeStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold';
            if (isTop2) rankBadgeStyle = 'bg-slate-300/20 text-slate-200 border-slate-300/40 font-bold';
            if (isTop3) rankBadgeStyle = 'bg-amber-700/20 text-amber-400 border-amber-700/40 font-bold';

            // Active Metric value display if filtered by specific metric
            let specificMetricValue: string | null = null;
            if (activeMetric) {
              const labelScore = item.labelScores[activeMetric.labelId];
              const metricDetail = labelScore?.metrics.find(m => m.metricId === activeMetric.id);
              if (metricDetail) {
                specificMetricValue = formatMetricValue(metricDetail.latestValue, activeMetric);
              }
            }

            return (
              <div
                key={item.player.id}
                onClick={() => onSelectPlayer(item.player)}
                className={`group bg-slate-900/90 hover:bg-slate-800/90 border transition-all duration-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer active:scale-[0.99] shadow-md ${
                  isTop1 ? 'border-amber-500/30 bg-gradient-to-r from-amber-950/20 to-slate-900' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Left Side: Rank, Avatar, Name, Position */}
                <div className="flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm border shrink-0 ${rankBadgeStyle}`}>
                    {isTop1 ? (
                      <Trophy className="w-5 h-5 text-amber-400" />
                    ) : (
                      <span>#{idx + 1}</span>
                    )}
                  </div>

                  <div className="relative">
                    <img
                      src={item.player.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128'}
                      alt={item.player.name}
                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-800 group-hover:ring-emerald-500/50 transition-all"
                    />
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-md bg-slate-950 text-[10px] font-extrabold text-white border border-slate-700 shadow-sm">
                      #{item.player.jerseyNumber}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base tracking-tight group-hover:text-emerald-400 transition-colors">
                        {item.player.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-bold">
                        {item.player.position}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>Att: <strong className="text-emerald-400 font-semibold">{item.attendanceRate}%</strong></span>
                      <span>Foot: {item.player.preferredFoot}</span>
                      {item.player.status === 'injured' && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[10px] font-semibold">
                          Injured
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle: Label Score Badges or Specific Metric Display */}
                <div className="flex-1 max-w-xl">
                  {activeMetric && specificMetricValue ? (
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">{activeMetric.name}:</span>
                      <span className="text-base font-extrabold text-emerald-400">{specificMetricValue}</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {labels.map(lbl => {
                        const lScore = item.labelScores[lbl.id]?.score ?? 70;
                        return (
                          <div 
                            key={lbl.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
                          >
                            <span className="text-slate-400 text-[11px]">{lbl.name}:</span>
                            <span className={`font-extrabold ${
                              lScore >= 85 ? 'text-emerald-400' : lScore >= 70 ? 'text-blue-400' : 'text-amber-400'
                            }`}>
                              {lScore}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right Side: Total Score Ring & Action */}
                <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <div className="text-left md:text-right">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                      Total Score
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-black tracking-tight ${
                        item.totalScore >= 88 ? 'text-emerald-400' : item.totalScore >= 75 ? 'text-blue-400' : 'text-amber-400'
                      }`}>
                        {item.totalScore}
                      </span>
                      <span className="text-xs text-slate-500 font-bold">/100</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-800/60 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 text-slate-400 transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
