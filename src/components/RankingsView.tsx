import React, { useMemo, useState } from 'react';
import {
  Trophy,
  Sliders,
  Search,
  ChevronRight,
  Download,
} from 'lucide-react';
import {
  Player,
  MetricDefinition,
  LabelDefinition,
  ScoringFormulaConfig,
  PlayerRanking,
} from '../types';
import { formatMetricValue } from '../utils/scoring';
import {
  categoryScoreTagLabel,
  compareRankings,
  metricsForCategory,
  RankingsMetricSelection,
  RankingsSortMode,
  selectionAfterCategoryChange,
} from '../utils/rankingsFilter';

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
}) => {
  const [selectedLabelId, setSelectedLabelId] = useState<string | 'all'>('all');
  const [selectedMetricId, setSelectedMetricId] =
    useState<RankingsMetricSelection>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<RankingsSortMode>('total');

  const scopedMetrics = useMemo(
    () => metricsForCategory(metrics, selectedLabelId),
    [metrics, selectedLabelId],
  );

  const activeLabel = labels.find((l) => l.id === selectedLabelId);
  const activeMetric = metrics.find((m) => m.id === selectedMetricId);

  const filteredRankings = rankings.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.player.name.toLowerCase().includes(q) ||
      r.player.position.toLowerCase().includes(q) ||
      r.player.jerseyNumber.toString() === searchQuery
    );
  });

  const sortedRankings = [...filteredRankings].sort((a, b) =>
    compareRankings(
      a,
      b,
      sortBy,
      selectedLabelId,
      selectedMetricId,
      metrics,
    ),
  );

  const selectCategory = (labelId: string | 'all') => {
    const next = selectionAfterCategoryChange(
      labelId,
      selectedMetricId,
      metrics,
    );
    setSelectedLabelId(labelId);
    setSelectedMetricId(next.selectedMetricId);
    setSortBy(next.sortBy);
  };

  const selectOverallOrCategoryScore = () => {
    setSelectedMetricId('none');
    setSortBy(selectedLabelId === 'all' ? 'total' : 'label');
  };

  const selectMetricTag = (metricId: string) => {
    setSelectedMetricId(metricId);
    setSortBy('metric');
  };

  const primaryScoreLabel =
    sortBy === 'metric' && activeMetric
      ? activeMetric.name
      : sortBy === 'label' && activeLabel
        ? categoryScoreTagLabel(activeLabel)
        : 'Total Score';

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

  const isOverallMode =
    selectedLabelId === 'all' && selectedMetricId === 'none';

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

        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Active Weights:</span>
          {formula.weights
            .filter((w) => w.enabled && w.weightPercent > 0)
            .map((w) => {
              const labelDef = labels.find((l) => l.id === w.labelId);
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

      {/* Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-4 backdrop-blur-sm">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search player name, position, jersey #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Category Label Tabs */}
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
            Category
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => selectCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedLabelId === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              All Categories
            </button>

            {labels.map((lbl) => {
              const isSelected = selectedLabelId === lbl.id;
              return (
                <button
                  type="button"
                  key={lbl.id}
                  onClick={() => selectCategory(lbl.id)}
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

        {/* Metric tags scoped by category */}
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
            Rank by
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={selectOverallOrCategoryScore}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                selectedMetricId === 'none'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {selectedLabelId === 'all'
                ? 'Overall Total'
                : activeLabel
                  ? categoryScoreTagLabel(activeLabel)
                  : 'Category score'}
            </button>

            {scopedMetrics.map((m) => {
              const isSelected = selectedMetricId === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => selectMetricTag(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}

            {scopedMetrics.length === 0 && selectedLabelId !== 'all' && (
              <span className="text-xs text-slate-500 px-1">
                No metrics in this category yet
              </span>
            )}
          </div>
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
            const isTop1 = idx === 0 && isOverallMode;
            const isTop2 = idx === 1 && isOverallMode;
            const isTop3 = idx === 2 && isOverallMode;

            let rankBadgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';
            if (isTop1)
              rankBadgeStyle =
                'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold';
            if (isTop2)
              rankBadgeStyle =
                'bg-slate-300/20 text-slate-200 border-slate-300/40 font-bold';
            if (isTop3)
              rankBadgeStyle =
                'bg-amber-700/20 text-amber-400 border-amber-700/40 font-bold';

            let specificMetricValue: string | null = null;
            if (activeMetric) {
              const labelScore = item.labelScores[activeMetric.labelId];
              const metricDetail = labelScore?.metrics.find(
                (m) => m.metricId === activeMetric.id,
              );
              if (metricDetail) {
                specificMetricValue = formatMetricValue(
                  metricDetail.latestValue,
                  activeMetric,
                );
              }
            }

            const categoryScore =
              selectedLabelId !== 'all'
                ? (item.labelScores[selectedLabelId]?.score ?? null)
                : null;

            const primaryDisplay =
              sortBy === 'metric' && specificMetricValue
                ? specificMetricValue
                : sortBy === 'label' && categoryScore !== null
                  ? String(categoryScore)
                  : String(item.totalScore);

            const primaryIsNumericScore =
              sortBy !== 'metric' || !specificMetricValue;

            return (
              <div
                key={item.player.id}
                onClick={() => onSelectPlayer(item.player)}
                className={`group bg-slate-900/90 hover:bg-slate-800/90 border transition-all duration-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer active:scale-[0.99] shadow-md ${
                  isTop1
                    ? 'border-amber-500/30 bg-gradient-to-r from-amber-950/20 to-slate-900'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm border shrink-0 ${rankBadgeStyle}`}
                  >
                    {isTop1 ? (
                      <Trophy className="w-5 h-5 text-amber-400" />
                    ) : (
                      <span>#{idx + 1}</span>
                    )}
                  </div>

                  <div className="relative">
                    <img
                      src={
                        item.player.avatarUrl ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128'
                      }
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
                      <span>
                        Att:{' '}
                        <strong className="text-emerald-400 font-semibold">
                          {item.attendanceRate}%
                        </strong>
                      </span>
                      <span>Foot: {item.player.preferredFoot}</span>
                      {item.player.status === 'injured' && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[10px] font-semibold">
                          Injured
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 max-w-xl">
                  {sortBy === 'metric' && activeMetric ? (
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">
                        {activeMetric.name}:
                      </span>
                      <span className="text-base font-extrabold text-emerald-400">
                        {specificMetricValue ?? '—'}
                      </span>
                    </div>
                  ) : sortBy === 'label' && activeLabel ? (
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">
                        {categoryScoreTagLabel(activeLabel)}:
                      </span>
                      <span className="text-base font-extrabold text-emerald-400">
                        {categoryScore ?? '—'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {labels.map((lbl) => {
                        const lScore = item.labelScores[lbl.id]?.score ?? 70;
                        return (
                          <div
                            key={lbl.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
                          >
                            <span className="text-slate-400 text-[11px]">
                              {lbl.name}:
                            </span>
                            <span
                              className={`font-extrabold ${
                                lScore >= 85
                                  ? 'text-emerald-400'
                                  : lScore >= 70
                                    ? 'text-blue-400'
                                    : 'text-amber-400'
                              }`}
                            >
                              {lScore}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <div className="text-left md:text-right">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                      {primaryScoreLabel}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-2xl font-black tracking-tight ${
                          !primaryIsNumericScore
                            ? 'text-emerald-400'
                            : Number(primaryDisplay) >= 88
                              ? 'text-emerald-400'
                              : Number(primaryDisplay) >= 75
                                ? 'text-blue-400'
                                : 'text-amber-400'
                        }`}
                      >
                        {primaryDisplay}
                      </span>
                      {sortBy !== 'metric' && (
                        <span className="text-xs text-slate-500 font-bold">
                          /100
                        </span>
                      )}
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
