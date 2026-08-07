import React, { useMemo, useState } from 'react';
import {
  Trophy,
  Sliders,
  Search,
  ChevronRight,
  Download,
  Minus,
  Plus,
} from 'lucide-react';
import {
  Player,
  MetricDefinition,
  LabelDefinition,
  ScoringFormulaConfig,
  PlayerRanking,
  CalculatedFieldDefinition,
  AdjustedBumpConfig,
} from '../types';
import { formatMetricValue } from '../utils/scoring';
import {
  calculatedFieldsForCategory,
  formatCalculatedFieldValue,
} from '../utils/calculatedFields';
import {
  bumpBudgetRemaining,
  canApplyBump,
} from '../utils/adjustedBumps';
import {
  categoryScoreTagLabel,
  compareRankings,
  isUnscoredForRankMode,
  labelScoreForMode,
  metricsForCategory,
  RankingsMetricSelection,
  RankingsSortMode,
  RankingsTotalMode,
  rankForMode,
  selectionAfterCategoryChange,
  totalForMode,
} from '../utils/rankingsFilter';

interface RankingsViewProps {
  rankings: PlayerRanking[];
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
  calculatedFields: CalculatedFieldDefinition[];
  formula: ScoringFormulaConfig;
  /** False when no metric entries exist (e.g. all sessions deleted). */
  hasLoggedData: boolean;
  bumpBudget: AdjustedBumpConfig;
  adjustedBumps: Record<string, number>;
  onApplyBump: (playerId: string, delta: 1 | -1) => void;
  onOpenFormulaConfig: () => void;
  onSelectPlayer: (player: Player) => void;
  onOpenQuickInsert: () => void;
}

const EMPTY_RANKINGS_LINES = [
  'Wow. Such empty. Much no sessions.',
  'No data? Even Cucurella looks unimpressed.',
  'Leaderboard cleared the pitch. Log a session to kick off.',
] as const;

export const RankingsView: React.FC<RankingsViewProps> = ({
  rankings,
  labels,
  metrics,
  calculatedFields,
  formula,
  hasLoggedData,
  bumpBudget,
  adjustedBumps,
  onApplyBump,
  onOpenFormulaConfig,
  onSelectPlayer,
  onOpenQuickInsert,
}) => {
  const [selectedLabelId, setSelectedLabelId] = useState<string | 'all'>('all');
  const [selectedMetricId, setSelectedMetricId] =
    useState<RankingsMetricSelection>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<RankingsSortMode>('total');
  const [totalMode, setTotalMode] = useState<RankingsTotalMode>('overall');
  const [emptyLine] = useState(
    () =>
      EMPTY_RANKINGS_LINES[
        Math.floor(Math.random() * EMPTY_RANKINGS_LINES.length)
      ],
  );

  const scopedMetrics = useMemo(
    () => metricsForCategory(metrics, selectedLabelId),
    [metrics, selectedLabelId],
  );

  const scopedCalculated = useMemo(
    () =>
      calculatedFieldsForCategory(calculatedFields, metrics, selectedLabelId),
    [calculatedFields, metrics, selectedLabelId],
  );

  const activeLabel = labels.find((l) => l.id === selectedLabelId);
  const activeMetric = metrics.find((m) => m.id === selectedMetricId);
  const activeCalculated = calculatedFields.find(
    (f) => f.id === selectedMetricId && f.enabled,
  );

  /** True when the current category / metric filter has any real logged values. */
  const scopeHasData = useMemo(() => {
    if (totalMode === 'coaches') {
      return rankings.some((r) => r.coachesTotalSum !== null);
    }

    if (!hasLoggedData) return false;

    if (sortBy === 'metric' && activeMetric) {
      return rankings.some((r) =>
        r.labelScores[activeMetric.labelId]?.metrics.some(
          (m) => m.metricId === activeMetric.id,
        ),
      );
    }

    if (sortBy === 'calculated' && activeCalculated) {
      return rankings.some(
        (r) => r.calculatedValues[activeCalculated.id] !== undefined,
      );
    }

    if (selectedLabelId !== 'all') {
      if (totalMode === 'adjusted') {
        return rankings.some(
          (r) => r.labelScores[selectedLabelId]?.adjustedScore !== null,
        );
      }
      return rankings.some(
        (r) => (r.labelScores[selectedLabelId]?.entryCount ?? 0) > 0,
      );
    }

    if (totalMode === 'adjusted') {
      return rankings.some((r) => r.adjustedTotalScore !== null);
    }

    return rankings.some((r) => r.totalScore !== null);
  }, [
    hasLoggedData,
    rankings,
    selectedLabelId,
    sortBy,
    totalMode,
    activeMetric,
    activeCalculated,
  ]);

  const budgetRemaining = useMemo(
    () => bumpBudgetRemaining(adjustedBumps, bumpBudget),
    [adjustedBumps, bumpBudget],
  );
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
      calculatedFields,
      totalMode,
    ),
  );

  const selectCategory = (labelId: string | 'all') => {
    const next = selectionAfterCategoryChange(
      labelId,
      selectedMetricId,
      metrics,
      calculatedFields,
    );
    setSelectedLabelId(labelId);
    setSelectedMetricId(next.selectedMetricId);
    setSortBy(next.sortBy);
  };

  const selectMetricTag = (metricId: string) => {
    // Second click clears metric rank-by → back to formula / category score
    // (Rankings toggle still controls Overall vs Adjusted).
    if (selectedMetricId === metricId) {
      setSelectedMetricId('none');
      setSortBy(selectedLabelId === 'all' ? 'total' : 'label');
      return;
    }
    setSelectedMetricId(metricId);
    setSortBy('metric');
  };

  const selectCalculatedTag = (fieldId: string) => {
    if (selectedMetricId === fieldId) {
      setSelectedMetricId('none');
      setSortBy(selectedLabelId === 'all' ? 'total' : 'label');
      return;
    }
    setSelectedMetricId(fieldId);
    setSortBy('calculated');
  };

  const primaryScoreLabel =
    sortBy === 'metric' && activeMetric
      ? activeMetric.name
      : sortBy === 'calculated' && activeCalculated
        ? activeCalculated.name
        : sortBy === 'label' && activeLabel
          ? categoryScoreTagLabel(activeLabel)
          : totalMode === 'adjusted'
            ? 'Adjusted Rank'
            : totalMode === 'coaches'
              ? 'Coaches Totals'
              : 'Overall Rank';

  const handleExportCSV = () => {
    let csv =
      'Rank,Player Name,Jersey,Position,Overall Rank,Adjusted Rank,Coaches Rank,Overall Score,Adjusted Score,Coaches Sum,Bump,Attendance Rate\n';
    sortedRankings.forEach((r, idx) => {
      const overallRank = r.overallRank ?? 'Unscored';
      const adjustedRank = r.adjustedRank ?? 'Unscored';
      const coachesRank = r.coachesRank ?? 'Unscored';
      const overall = r.totalScore ?? 'Unscored';
      const adjusted = r.adjustedTotalScore ?? 'Unscored';
      const coachesSum = r.coachesTotalSum ?? 'Unscored';
      const bump = r.adjustedBump ?? 0;
      const att = r.attendanceRate !== null ? `${r.attendanceRate}%` : '';
      csv += `${idx + 1},"${r.player.name}",#${r.player.jerseyNumber},${r.player.position},${overallRank},${adjustedRank},${coachesRank},${overall},${adjusted},${coachesSum},${bump},${att}\n`;
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

  const scoreToneClass = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'text-slate-500';
    if (score >= 85) return 'text-emerald-400';
    if (score >= 70) return 'text-blue-400';
    return 'text-amber-400';
  };

  const emptyCopy =
    totalMode === 'coaches' && !scopeHasData
      ? {
          title: 'No Coaches Totals yet',
          detail:
            'Save a complete coach ballot (unique ranks for every active player) in Config → Coaches Rating.',
        }
      : !hasLoggedData
      ? {
          title: 'No rankings yet',
          detail:
            'Delete sessions and the board goes quiet — log metrics in Quick Insert to bring the leaderboard back.',
        }
      : selectedLabelId !== 'all' && sortBy === 'label'
        ? {
            title: `No ${activeLabel?.name ?? 'category'} data yet`,
            detail:
              'Nothing logged for this category. Keep the labels — just add session metrics here to unlock scores.',
          }
        : sortBy === 'metric' && activeMetric
          ? {
              title: `No ${activeMetric.name} logs yet`,
              detail:
                'This metric is on the board, but nobody has a value. Log it in Quick Insert.',
            }
          : {
              title: 'No rankings for this view',
              detail:
                'Nothing logged for the current filters. Switch categories or log a session.',
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
              Pool ranks from squad standing scores (Overall omits gaps; Adjusted counts them), mixed by your coaching formula.
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

        {/* Rank mode: Overall / Adjusted / Coaches */}
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
            Rankings
          </p>
          <div
            className="inline-flex rounded-xl border border-slate-800 bg-slate-950/80 p-1"
            role="group"
            aria-label="Ranking mode"
          >
            <button
              type="button"
              onClick={() => setTotalMode('overall')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                totalMode === 'overall'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Unscored values are omitted — not counted against the player"
            >
              Overall Rank
            </button>
            <button
              type="button"
              onClick={() => setTotalMode('adjusted')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                totalMode === 'adjusted'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Unscored values count as 0 — gaps lower standing; ±1 bumps apply"
            >
              Adjusted Rank
            </button>
            <button
              type="button"
              onClick={() => {
                setTotalMode('coaches');
                setSelectedLabelId('all');
                setSelectedMetricId('none');
                setSortBy('total');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                totalMode === 'coaches'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Sum of ordinals from complete coach ballots (lower sum = better)"
            >
              Coaches Totals
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {totalMode === 'overall'
              ? 'Pool place from scored metrics only (gaps omitted).'
              : totalMode === 'adjusted'
                ? 'Pool place from adjusted score (gaps count as 0), plus optional ±1 bumps.'
                : 'Competition rank from sum of complete coach ballots (lower sum = better).'}{' '}
            {totalMode !== 'coaches' &&
              'Applies to every category and formula standing.'}
          </p>
          {totalMode === 'adjusted' && (
            <p className="text-[11px] text-cyan-400/90 mt-1 font-medium">
              Bump budget remaining: +{budgetRemaining.plusRemaining} / −
              {budgetRemaining.minusRemaining}
              <span className="text-slate-500 font-normal">
                {' '}
                (of +{bumpBudget.plusBudget} / −{bumpBudget.minusBudget})
              </span>
            </p>
          )}
        </div>

        {/* Category Label Tabs — hidden for Coaches Totals (ballot-only mode) */}
        {totalMode !== 'coaches' && (
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
        )}

        {/* Rank by: metrics / calculated only — totals come from the Totals toggle */}
        {totalMode !== 'coaches' && (
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
            Rank by
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            {scopedMetrics.map((m) => {
              const isSelected = selectedMetricId === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => selectMetricTag(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}

            {scopedCalculated.map((f) => {
              const isSelected = selectedMetricId === f.id;
              return (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => selectCalculatedTag(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                  title="Calculated field"
                >
                  {f.name}
                </button>
              );
            })}

            {scopedMetrics.length === 0 && scopedCalculated.length === 0 ? (
              <span className="text-xs text-slate-500 px-1">
                {selectedLabelId === 'all'
                  ? 'No metric selected — ranking by Overall / Adjusted (see Rankings toggle).'
                  : 'No metrics in this category — ranking by category standing (see Rankings toggle).'}
              </span>
            ) : selectedMetricId === 'none' ? (
              <span className="text-xs text-slate-500 px-1">
                {selectedLabelId === 'all'
                  ? 'Formula standing'
                  : `${activeLabel?.name ?? 'Category'} standing`}{' '}
                · tap a metric to rank by it
              </span>
            ) : null}
          </div>
        </div>
        )}
      </div>

      {/* Leaderboard Cards Grid */}
      <div className="space-y-3">
        {!scopeHasData ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center overflow-hidden">
            <img
              src="/cucurella-cat.jpg"
              alt="Cat wearing a Cucurella curly wig"
              className="mx-auto mb-5 w-full max-w-xs rounded-2xl object-cover border border-slate-700 shadow-lg"
            />
            <h3 className="text-lg font-bold text-slate-200 tracking-tight">
              {emptyCopy.title}
            </h3>
            <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
              {emptyLine}
            </p>
            <p className="text-slate-500 text-xs mt-3 max-w-md mx-auto">
              {emptyCopy.detail}
            </p>
            <button
              type="button"
              onClick={onOpenQuickInsert}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-medium text-sm transition-all active:scale-95"
            >
              Open Quick Insert
            </button>
          </div>
        ) : sortedRankings.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-300">No players found</h3>
            <p className="text-slate-500 text-xs mt-1">
              Try adjusting search query or register new players in the team roster.
            </p>
          </div>
        ) : (
          sortedRankings.map((item, idx) => {
            const unscored = isUnscoredForRankMode(
              item,
              sortBy,
              selectedLabelId,
              selectedMetricId,
              metrics,
              totalMode,
            );
            const prevUnscored =
              idx > 0 &&
              isUnscoredForRankMode(
                sortedRankings[idx - 1],
                sortBy,
                selectedLabelId,
                selectedMetricId,
                metrics,
                totalMode,
              );
            const showUnscoredDivider = unscored && !prevUnscored && idx > 0;

            const isTop1 = idx === 0 && isOverallMode && !unscored;
            const isTop2 = idx === 1 && isOverallMode && !unscored;
            const isTop3 = idx === 2 && isOverallMode && !unscored;

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
            if (unscored)
              rankBadgeStyle =
                'bg-slate-900 text-slate-500 border-slate-800';

            let specificMetricValue: string | null = null;
            if (activeMetric) {
              const labelScore = item.labelScores[activeMetric.labelId];
              const metricDetail = labelScore?.metrics.find(
                (m) => m.metricId === activeMetric.id,
              );
              if (metricDetail) {
                specificMetricValue = formatMetricValue(
                  metricDetail.aggregatedValue,
                  activeMetric,
                );
              }
            } else if (activeCalculated) {
              const calcVal = item.calculatedValues[activeCalculated.id];
              if (calcVal !== undefined) {
                specificMetricValue = formatCalculatedFieldValue(
                  calcVal,
                  activeCalculated,
                );
              }
            }

            const categoryScore =
              selectedLabelId !== 'all'
                ? labelScoreForMode(item, selectedLabelId, totalMode)
                : null;

            const showingMeasuredValue =
              (sortBy === 'metric' || sortBy === 'calculated') &&
              specificMetricValue;

            // Rank badge among scored players only; unscored share the bottom tier.
            const scoredAhead = sortedRankings
              .slice(0, idx)
              .filter(
                (r) =>
                  !isUnscoredForRankMode(
                    r,
                    sortBy,
                    selectedLabelId,
                    selectedMetricId,
                    metrics,
                    totalMode,
                  ),
              ).length;
            const listRank = unscored ? null : scoredAhead + 1;
            // Formula totals use competition ranks from scoring (ties share place).
            const displayRank =
              sortBy === 'total' && !unscored
                ? rankForMode(item, totalMode)
                : listRank;

            const standingScore =
              sortBy === 'label'
                ? categoryScore
                : sortBy === 'total' ||
                    (sortBy !== 'metric' && sortBy !== 'calculated')
                  ? totalForMode(item, totalMode)
                  : null;

            const poolRankPrimary =
              !showingMeasuredValue &&
              (sortBy === 'total' ||
                sortBy === 'label' ||
                (sortBy !== 'metric' && sortBy !== 'calculated'));

            const primaryDisplay = unscored
              ? 'Unscored'
              : showingMeasuredValue
                ? specificMetricValue!
                : poolRankPrimary && displayRank !== null
                  ? `#${displayRank}`
                  : standingScore !== null
                    ? String(standingScore)
                    : 'Unscored';

            const primaryIsPoolRank =
              !unscored && poolRankPrimary && displayRank !== null;

            const primaryIsNumericScore =
              !unscored &&
              !showingMeasuredValue &&
              !primaryIsPoolRank &&
              primaryDisplay !== 'Unscored';

            return (
              <React.Fragment key={item.player.id}>
              {showUnscoredDivider && (
                <div
                  className="flex items-center gap-3 pt-2 pb-1"
                  role="separator"
                  aria-label="Unscored players"
                >
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 shrink-0">
                    Unscored
                  </span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>
              )}
              <div
                onClick={() => onSelectPlayer(item.player)}
                className={`group bg-slate-900/90 hover:bg-slate-800/90 border transition-all duration-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer active:scale-[0.99] shadow-md ${
                  isTop1
                    ? 'border-amber-500/30 bg-gradient-to-r from-amber-950/20 to-slate-900'
                    : unscored
                      ? 'border-slate-800/60 opacity-90'
                      : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm border shrink-0 ${rankBadgeStyle}`}
                  >
                    {isTop1 ? (
                      <Trophy className="w-5 h-5 text-amber-400" />
                    ) : unscored ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      <span>#{displayRank}</span>
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
                      {item.adjustedBump !== 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border ${
                            item.adjustedBump > 0
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {item.adjustedBump > 0
                            ? `+${item.adjustedBump}`
                            : `${item.adjustedBump}`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>
                        Att:{' '}
                        <strong className="text-emerald-400 font-semibold">
                          {item.attendanceRate !== null
                            ? `${item.attendanceRate}%`
                            : '—'}
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
                      <span
                        className={`text-base font-extrabold ${
                          specificMetricValue
                            ? 'text-emerald-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {specificMetricValue ?? 'Unscored'}
                      </span>
                    </div>
                  ) : sortBy === 'label' && activeLabel ? (
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">
                        {categoryScoreTagLabel(activeLabel)}:
                      </span>
                      <span
                        className={`text-base font-extrabold ${
                          categoryScore !== null
                            ? 'text-emerald-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {categoryScore ?? 'Unscored'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {labels.map((lbl) => {
                        const lScore = labelScoreForMode(
                          item,
                          lbl.id,
                          totalMode,
                        );
                        return (
                          <div
                            key={lbl.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
                          >
                            <span className="text-slate-400 text-[11px]">
                              {lbl.name}:
                            </span>
                            <span
                              className={`font-extrabold ${scoreToneClass(lScore)}`}
                            >
                              {lScore ?? '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                  {totalMode === 'adjusted' && sortBy === 'total' && (
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={
                          !canApplyBump(
                            adjustedBumps,
                            bumpBudget,
                            item.player.id,
                            -1,
                          )
                        }
                        onClick={() => onApplyBump(item.player.id, -1)}
                        className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-rose-300 hover:border-rose-500/40 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="−1 Adjusted bump"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={
                          !canApplyBump(
                            adjustedBumps,
                            bumpBudget,
                            item.player.id,
                            1,
                          )
                        }
                        onClick={() => onApplyBump(item.player.id, 1)}
                        className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-emerald-300 hover:border-emerald-500/40 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="+1 Adjusted bump"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="text-left md:text-right">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                      {primaryScoreLabel}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-2xl font-black tracking-tight ${
                          !primaryIsNumericScore && !primaryIsPoolRank
                            ? primaryDisplay === 'Unscored'
                              ? 'text-slate-500'
                              : 'text-emerald-400'
                            : primaryIsPoolRank
                              ? 'text-emerald-400'
                              : scoreToneClass(Number(primaryDisplay))
                        }`}
                      >
                        {primaryDisplay}
                      </span>
                      {primaryIsNumericScore && totalMode !== 'coaches' && (
                        <span className="text-xs text-slate-500 font-bold">
                          /100
                        </span>
                      )}
                    </div>
                    {primaryIsPoolRank &&
                      standingScore !== null &&
                      !unscored && (
                      <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        {totalMode === 'coaches'
                          ? `Sum ${standingScore}`
                          : `Standing ${standingScore}`}
                        {totalMode === 'adjusted' &&
                          item.adjustedBump !== 0 &&
                          item.adjustedTotalScore !== null && (
                            <span className="text-cyan-400/80">
                              {' '}
                              · effective{' '}
                              {Math.round(
                                (item.adjustedTotalScore + item.adjustedBump) *
                                  10,
                              ) / 10}
                            </span>
                          )}
                      </div>
                    )}
                  </div>

                  <div className="p-2 rounded-xl bg-slate-800/60 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 text-slate-400 transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
};
