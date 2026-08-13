import React, { useMemo, useState } from 'react';
import {
  Trophy,
  Sliders,
  Search,
  ChevronRight,
  Download,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import {
  Player,
  MetricDefinition,
  LabelDefinition,
  ScoringFormulaConfig,
  PlayerRanking,
  AdjustedBumpConfig,
  AdjustedBumpTransaction,
  Coach,
  CoachBallot,
  PlayerPosition,
  RankingBoundariesConfig,
} from '../types';
import {
  bumpBudgetRemaining,
  bumpUsage,
  canApplyBump,
  LEGACY_BUMP_COACH_ID,
  playerBumpNetForCoach,
  playerBumpNetFromOthers,
  transactionsForPlayer,
} from '../utils/adjustedBumps';
import {
  activePlayers,
  coachBallotOrdinals,
  isCompleteBallot,
} from '../utils/coachesRating';
import { specialtyAdjustedRankings } from '../utils/eligibility';
import { resolveActiveCutLines } from '../utils/rankingBoundaries';
import { metricPrimaryLabelId } from '../utils/metricLabels';
import {
  visibleActiveWeights,
  visibleRankingLabels,
} from '../utils/formulaWeights';
import {
  categoryScoreTagLabel,
  compareOptionalRankValue,
  compareRankings,
  formatTeamMetricValue,
  isUnscoredForRankMode,
  labelScoreForMode,
  metricsForCategory,
  scopeHasRankingsData,
  RankingsMetricSelection,
  RankingsSortMode,
  RankingsTotalMode,
  rankForMode,
  selectionAfterCategoryChange,
  teamMetricSummary,
  totalForMode,
} from '../utils/rankingsFilter';
import { CUCURELLA_CAT_PHOTO_URL, defaultAvatarFor } from '../constants/avatars';
import { SaveAndSyncButton } from './SaveAndSyncButton';

const SPECIALTY_POSITIONS: PlayerPosition[] = [
  'GK',
  'CB',
  'LB',
  'RB',
  'CDM',
  'CM',
  'CAM',
  'LW',
  'RW',
  'ST',
];

interface RankingsViewProps {
  rankings: PlayerRanking[];
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
  formula: ScoringFormulaConfig;
  /** False when no metric entries exist (e.g. all sessions deleted). */
  hasLoggedData: boolean;
  coaches: Coach[];
  coachBallots: CoachBallot[];
  bumpCoachId: string;
  onBumpCoachChange: (coachId: string) => void;
  bumpBudget: AdjustedBumpConfig;
  adjustedBumps: Record<string, number>;
  bumpTransactions: AdjustedBumpTransaction[];
  onApplyBump: (playerId: string, delta: 1 | -1) => void;
  onClearBumps: () => void;
  onClearPlayerBump: (playerId: string) => void;
  onOpenFormulaConfig: () => void;
  onSelectPlayer: (player: Player) => void;
  onOpenQuickInsert: () => void;
  rankingBoundaries: RankingBoundariesConfig;
  /** When false, hide Adjusted ± bump controls (Viewer). */
  allowBumps?: boolean;
}

function coachDisplayName(coaches: Coach[], coachId: string): string {
  if (coachId === LEGACY_BUMP_COACH_ID) return 'Earlier bumps';
  return coaches.find((c) => c.id === coachId)?.name ?? 'Unknown coach';
}

function formatCoachesAverage(sum: number, ballotCount: number): string {
  if (ballotCount <= 0) return String(sum);
  const avg = sum / ballotCount;
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

function formatBumpTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatBumpNet(net: number): string {
  return net > 0 ? `+${net}` : `${net}`;
}

/** Avatar badges: mine (green/red) + others (blue/amber) with transaction popout. */
const PlayerBumpBadges: React.FC<{
  playerId: string;
  playerName: string;
  totalNet: number;
  myNet: number;
  othersNet: number;
  transactions: AdjustedBumpTransaction[];
  coaches: Coach[];
}> = ({
  playerId,
  playerName,
  totalNet,
  myNet,
  othersNet,
  transactions,
  coaches,
}) => {
  if (myNet === 0 && othersNet === 0) return null;

  const lines = transactionsForPlayer(transactions, playerId);

  return (
    <div
      className="absolute -top-1.5 -left-1.5 z-30 group/bumpbadges"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5">
        {myNet !== 0 && (
          <span
            className={`min-w-[1.35rem] px-1 py-0.5 rounded-md text-[10px] font-black tabular-nums text-center border shadow-md cursor-default ${
              myNet > 0
                ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                : 'bg-rose-500 text-white border-rose-300'
            }`}
            title={`Your bumps ${formatBumpNet(myNet)}`}
            aria-label={`Your bumps ${formatBumpNet(myNet)} for ${playerName}`}
          >
            {formatBumpNet(myNet)}
          </span>
        )}
        {othersNet !== 0 && (
          <span
            className={`min-w-[1.35rem] px-1 py-0.5 rounded-md text-[10px] font-black tabular-nums text-center border shadow-md cursor-default ${
              othersNet > 0
                ? 'bg-slate-500 text-sky-100 border-slate-400'
                : 'bg-amber-400 text-slate-950 border-amber-300'
            }`}
            title={`Other coaches ${formatBumpNet(othersNet)}`}
            aria-label={`Other coaches ${formatBumpNet(othersNet)} for ${playerName}`}
          >
            {formatBumpNet(othersNet)}
          </span>
        )}
      </div>
      <div
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-64 opacity-0 translate-y-1 transition-all group-hover/bumpbadges:opacity-100 group-hover/bumpbadges:translate-y-0 group-focus-within/bumpbadges:opacity-100 group-focus-within/bumpbadges:translate-y-0"
      >
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
              Bump total
            </p>
            <span
              className={`text-sm font-black tabular-nums ${
                totalNet > 0
                  ? 'text-emerald-400'
                  : totalNet < 0
                    ? 'text-rose-400'
                    : 'text-slate-400'
              }`}
            >
              {formatBumpNet(totalNet)}
            </span>
          </div>
          {myNet !== 0 || othersNet !== 0 ? (
            <div className="flex items-center gap-2 text-[10px] font-semibold mb-2 pb-2 border-b border-slate-800">
              {myNet !== 0 && (
                <span
                  className={myNet > 0 ? 'text-emerald-400' : 'text-rose-400'}
                >
                  You {formatBumpNet(myNet)}
                </span>
              )}
              {othersNet !== 0 && (
                <span
                  className={
                    othersNet > 0 ? 'text-sky-300' : 'text-amber-400'
                  }
                >
                  Others {formatBumpNet(othersNet)}
                </span>
              )}
            </div>
          ) : null}
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
            Transactions
          </p>
          {lines.length === 0 ? (
            <p className="text-xs text-slate-500">No bump history.</p>
          ) : (
            <ul className="space-y-1.5 max-h-44 overflow-y-auto">
              {lines.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="text-slate-200 truncate font-medium">
                      {coachDisplayName(coaches, tx.coachId)}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {formatBumpTime(tx.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`font-extrabold tabular-nums shrink-0 ${
                      tx.delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatBumpNet(tx.delta)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const EMPTY_RANKINGS_LINES = [
  'Wow. Such empty. Much no sessions.',
  'No data? Even Cucurella looks unimpressed.',
  'Leaderboard cleared the pitch. Log a session to kick off.',
] as const;

export const RankingsView: React.FC<RankingsViewProps> = ({
  rankings,
  labels,
  metrics,
  formula,
  hasLoggedData,
  coaches,
  coachBallots,
  bumpCoachId,
  onBumpCoachChange,
  bumpBudget,
  adjustedBumps,
  bumpTransactions,
  onApplyBump,
  onClearBumps,
  onClearPlayerBump,
  onOpenFormulaConfig,
  onSelectPlayer,
  onOpenQuickInsert,
  rankingBoundaries,
  allowBumps = true,
}) => {
  const rankingLabels = useMemo(
    () => visibleRankingLabels(labels),
    [labels],
  );

  const activeWeightChips = useMemo(
    () => visibleActiveWeights(formula, labels),
    [formula, labels],
  );

  const [selectedLabelId, setSelectedLabelId] = useState<string | 'all'>('all');
  const [selectedMetricId, setSelectedMetricId] =
    useState<RankingsMetricSelection>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<RankingsSortMode>('total');
  const [totalMode, setTotalMode] = useState<RankingsTotalMode>('overall');
  /** 'average' = all complete ballots; otherwise a coach id. */
  const [coachesScope, setCoachesScope] = useState<string>('average');
  const [specialtyPosition, setSpecialtyPosition] =
    useState<PlayerPosition | null>(null);
  const [emptyLine] = useState(
    () =>
      EMPTY_RANKINGS_LINES[
        Math.floor(Math.random() * EMPTY_RANKINGS_LINES.length)
      ],
  );

  const effectiveTotalMode: RankingsTotalMode = specialtyPosition
    ? 'adjusted'
    : totalMode;

  const rankingSource = useMemo(() => {
    if (specialtyPosition) {
      return specialtyAdjustedRankings(rankings, specialtyPosition);
    }
    return rankings;
  }, [rankings, specialtyPosition]);

  const rosterPlayers = useMemo(
    () => rankings.map((r) => r.player),
    [rankings],
  );

  const activeCutLines = useMemo(
    () =>
      resolveActiveCutLines({
        boundaries: rankingBoundaries,
        specialtyPosition,
        selectedLabelId,
        selectedMetricId,
        totalMode: effectiveTotalMode,
      }),
    [
      rankingBoundaries,
      specialtyPosition,
      selectedLabelId,
      selectedMetricId,
      effectiveTotalMode,
    ],
  );

  const cutLinesUseListPlace = Boolean(
    !specialtyPosition &&
      ((selectedMetricId &&
        rankingBoundaries.metricCuts?.[selectedMetricId]) ||
        (selectedLabelId &&
          selectedLabelId !== 'all' &&
          rankingBoundaries.categoryCuts?.[selectedLabelId])),
  );

  const activePlayerIds = useMemo(
    () => activePlayers(rosterPlayers).map((p) => p.id),
    [rosterPlayers],
  );

  const completeBallotCount = useMemo(
    () =>
      coachBallots.filter((b) => isCompleteBallot(b, activePlayerIds)).length,
    [coachBallots, activePlayerIds],
  );

  const coachesWithCompleteBallots = useMemo(
    () =>
      coaches.filter((c) => {
        const ballot = coachBallots.find((b) => b.coachId === c.id);
        return ballot ? isCompleteBallot(ballot, activePlayerIds) : false;
      }),
    [coaches, coachBallots, activePlayerIds],
  );

  const individualCoachOrdinals = useMemo(() => {
    if (totalMode !== 'coaches' || coachesScope === 'average') return null;
    const ballot = coachBallots.find((b) => b.coachId === coachesScope);
    return coachBallotOrdinals(rosterPlayers, ballot);
  }, [totalMode, coachesScope, coachBallots, rosterPlayers]);

  const scopedMetrics = useMemo(
    () => metricsForCategory(metrics, selectedLabelId),
    [metrics, selectedLabelId],
  );


  const activeLabel = labels.find((l) => l.id === selectedLabelId);
  const activeMetric = metrics.find((m) => m.id === selectedMetricId);

  const teamSummary = useMemo(() => {
    if (!activeMetric) return null;
    return teamMetricSummary(rankingSource, activeMetric);
  }, [activeMetric, rankingSource]);

  /** True when the current category / metric filter has any real logged values. */
  const scopeHasData = useMemo(
    () =>
      scopeHasRankingsData({
        rankings,
        hasLoggedData,
        sortBy,
        selectedLabelId,
        selectedMetricId,
        metrics,
        totalMode: effectiveTotalMode,
        individualCoachOrdinals,
      }),
    [
      hasLoggedData,
      rankings,
      selectedLabelId,
      selectedMetricId,
      sortBy,
      effectiveTotalMode,
      metrics,
      individualCoachOrdinals,
    ],
  );

  const budgetRemaining = useMemo(
    () => bumpBudgetRemaining(adjustedBumps, bumpBudget),
    [adjustedBumps, bumpBudget],
  );

  const bumpUsageTotals = useMemo(
    () => bumpUsage(adjustedBumps),
    [adjustedBumps],
  );

  const bumpedPlayers = useMemo(() => {
    return rankings
      .map((r) => ({
        id: r.player.id,
        name: r.player.name,
        jersey: r.player.jerseyNumber,
        bump: adjustedBumps[r.player.id] ?? r.adjustedBump ?? 0,
      }))
      .filter((p) => p.bump !== 0)
      .sort((a, b) => b.bump - a.bump || a.jersey - b.jersey);
  }, [rankings, adjustedBumps]);

  const hasAnyBumps = bumpedPlayers.length > 0;
  const filteredRankings = rankingSource.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.player.name.toLowerCase().includes(q) ||
      r.player.position.toLowerCase().includes(q) ||
      r.player.jerseyNumber.toString() === searchQuery
    );
  });

  const sortedRankings = [...filteredRankings].sort((a, b) => {
    if (individualCoachOrdinals) {
      return compareOptionalRankValue(
        individualCoachOrdinals.get(a.player.id) ?? null,
        individualCoachOrdinals.get(b.player.id) ?? null,
        false,
      );
    }
    return compareRankings(
      a,
      b,
      sortBy,
      selectedLabelId,
      selectedMetricId,
      metrics,
      effectiveTotalMode,
    );
  });

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

  const selectMetricTag = (metricId: string) => {
    // Second click clears metric rank-by → back to formula / category score
    // (Rankings toggle still controls Statistical vs Adjusted).
    if (selectedMetricId === metricId) {
      setSelectedMetricId('none');
      setSortBy(selectedLabelId === 'all' ? 'total' : 'label');
      return;
    }
    setSelectedMetricId(metricId);
    setSortBy('metric');
  };


  const coachesScopeLabel =
    coachesScope === 'average'
      ? 'All coaches'
      : (coaches.find((c) => c.id === coachesScope)?.name ?? 'Coach');

  const primaryScoreLabel =
    sortBy === 'metric' && activeMetric
      ? activeMetric.name
      : sortBy === 'label' && activeLabel
        ? categoryScoreTagLabel(activeLabel)
        : totalMode === 'adjusted'
          ? 'Adjusted Rank'
          : totalMode === 'coaches'
            ? coachesScope === 'average'
              ? 'Coaches Rank'
              : `${coachesScopeLabel}'s Rank`
            : 'Statistical Rank';

  const handleExportCSV = () => {
    let csv =
      'Rank,Player Name,Jersey,Position,Statistical Rank,Adjusted Rank,Coaches Rank,Statistical Score,Adjusted Score,Coaches Average,Bump,Attendance Rate\n';
    sortedRankings.forEach((r, idx) => {
      const overallRank = r.overallRank ?? 'Unscored';
      const adjustedRank = r.adjustedRank ?? 'Unscored';
      const coachesRank = r.coachesRank ?? 'Unscored';
      const overall = r.totalScore ?? 'Unscored';
      const adjusted = r.adjustedTotalScore ?? 'Unscored';
      const coachesAvg =
        r.coachesTotalSum != null && completeBallotCount > 0
          ? formatCoachesAverage(r.coachesTotalSum, completeBallotCount)
          : 'Unscored';
      const bump = r.adjustedBump ?? 0;
      const att = r.attendanceRate !== null ? `${r.attendanceRate}%` : '';
      csv += `${idx + 1},"${r.player.name}",#${r.player.jerseyNumber},${r.player.position},${overallRank},${adjustedRank},${coachesRank},${overall},${adjusted},${coachesAvg},${bump},${att}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Thunder_FC_Leaderboard_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const isBoardMode =
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
          title: 'No Coaches Rank yet',
          detail:
            coachesScope === 'average'
              ? 'Add coaches and save a complete ballot (unique ranks for every active player) under Players → Coaches Rating.'
              : `${coachesScopeLabel} has no complete ballot yet. Finish ranking every active player under Players → Coaches Rating.`,
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
              Pool ranks from squad standing scores (Statistical omits gaps; Adjusted counts them), mixed by your coaching formula.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <SaveAndSyncButton compact />
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
          {activeWeightChips.map((w) => {
              const labelDef = labels.find((l) => l.id === w.labelId);
              const name = labelDef?.name ?? (w.labelId === 'attendance' ? 'Attendance' : w.labelId);
              const badgeBg =
                labelDef?.badgeBg ??
                (w.labelId === 'attendance'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700');
              return (
                <span
                  key={w.labelId}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-medium ${badgeBg}`}
                >
                  <span>{name}</span>
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

        {/* Rank mode: Statistical / Adjusted / Coaches */}
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
              onClick={() => {
                setSpecialtyPosition(null);
                setTotalMode('overall');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                effectiveTotalMode === 'overall' && !specialtyPosition
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Unscored values are omitted — not counted against the player"
            >
              Statistical Rank
            </button>
            <button
              type="button"
              onClick={() => {
                setSpecialtyPosition(null);
                setTotalMode('adjusted');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                effectiveTotalMode === 'adjusted' && !specialtyPosition
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Unscored values count as 0 — gaps lower standing; ±1 bumps apply; only eligible players ranked"
            >
              Adjusted Rank
            </button>
            <button
              type="button"
              onClick={() => {
                setSpecialtyPosition(null);
                setTotalMode('coaches');
                setSelectedLabelId('all');
                setSelectedMetricId('none');
                setSortBy('total');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                effectiveTotalMode === 'coaches'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Average of complete coach ballots, or one coach’s ordinal ranks"
            >
              Coaches Rank
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mr-0.5">
              Specialty
            </span>
            <button
              type="button"
              onClick={() => setSpecialtyPosition(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                specialtyPosition === null
                  ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              All
            </button>
            {SPECIALTY_POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => {
                  setSpecialtyPosition(pos);
                  setTotalMode('adjusted');
                  setSelectedLabelId('all');
                  setSelectedMetricId('none');
                  setSortBy('total');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  specialtyPosition === pos
                    ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {specialtyPosition
              ? `Specialty ${specialtyPosition}: re-ranked among that position (eligible only).`
              : effectiveTotalMode === 'overall'
                ? 'Pool place from scored metrics only (gaps omitted).'
                : effectiveTotalMode === 'adjusted'
                  ? 'Eligible players only (missing blocks-play paperwork at bottom). Gaps count as 0; ±1 bumps apply. Cut lines mark squad boundaries.'
                  : coachesScope === 'average'
                    ? 'Competition rank from the average of complete coach ballots (lower average = better). Add ballots under Players → Coaches Rating.'
                    : `Ordinal ranks from ${coachesScopeLabel}'s complete ballot (1 = best).`}{' '}
            {effectiveTotalMode !== 'coaches' &&
              !specialtyPosition &&
              'Applies to every category and formula standing.'}
          </p>
          {totalMode === 'coaches' && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mr-0.5">
                View
              </span>
              <button
                type="button"
                onClick={() => setCoachesScope('average')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  coachesScope === 'average'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                All coaches (avg)
              </button>
              {coaches.map((c) => {
                const hasComplete = coachesWithCompleteBallots.some(
                  (x) => x.id === c.id,
                );
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCoachesScope(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      coachesScope === c.id
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    } ${!hasComplete ? 'opacity-60' : ''}`}
                    title={
                      hasComplete
                        ? `${c.name}'s ballot`
                        : `${c.name} — incomplete ballot`
                    }
                  >
                    {c.name}
                  </button>
                );
              })}
              {coaches.length === 0 && (
                <p className="text-xs text-amber-400/90">
                  Add a coach under Players → Coaches Rating.
                </p>
              )}
            </div>
          )}
          {effectiveTotalMode === 'adjusted' && allowBumps && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {coaches.length === 0 ? (
                <p className="text-xs text-amber-400/90">
                  Add a coach under Players → Coaches Rating to apply bumps.
                </p>
              ) : (
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500">
                    Bumping as
                  </span>
                  <select
                    value={bumpCoachId}
                    onChange={(e) => onBumpCoachChange(e.target.value)}
                    className="rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs font-semibold px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  >
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="relative group/bumps">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-extrabold border transition-colors ${
                    hasAnyBumps
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                  aria-describedby="bump-breakdown"
                >
                  Bumps{' '}
                  <span className="text-emerald-400">
                    +{bumpUsageTotals.plusUsed}
                  </span>
                  <span className="text-slate-600">/</span>
                  <span className="text-rose-400">
                    −{bumpUsageTotals.minusUsed}
                  </span>
                  <span className="text-slate-500 font-semibold">
                    · left +{budgetRemaining.plusRemaining}/−
                    {budgetRemaining.minusRemaining}
                  </span>
                </button>
                <div
                  id="bump-breakdown"
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 w-64 opacity-0 translate-y-1 transition-all group-hover/bumps:opacity-100 group-hover/bumps:translate-y-0 group-focus-within/bumps:opacity-100 group-focus-within/bumps:translate-y-0"
                >
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                      Who has bumps
                    </p>
                    {!hasAnyBumps ? (
                      <p className="text-xs text-slate-500">
                        No +1 / −1 applied yet. Use the Bump buttons on a player
                        row.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                        {bumpedPlayers.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="text-slate-300 truncate">
                              #{p.jersey} {p.name}
                            </span>
                            <span
                              className={`font-extrabold tabular-nums shrink-0 ${
                                p.bump > 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {p.bump > 0 ? `+${p.bump}` : p.bump}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
              {hasAnyBumps && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        'Clear all Adjusted +1 / −1 bumps for every player?',
                      )
                    ) {
                      onClearBumps();
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear bumps
                </button>
              )}
            </div>
          )}
        </div>

        {/* Category Label Tabs — hidden for Coaches Rank (ballot-only mode) */}
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

            {rankingLabels.map((lbl) => {
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

        {/* Rank by: metrics only — totals come from the Totals toggle */}
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

            {scopedMetrics.length === 0 ? (
              <span className="text-xs text-slate-500 px-1">
                {selectedLabelId === 'all'
                  ? 'No metric selected — ranking by Statistical / Adjusted (see Rankings toggle).'
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

      {activeMetric && teamSummary ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-semibold text-slate-300">
            Team · {activeMetric.name}
          </span>
          {teamSummary.avg != null ? (
            <>
              <span className="text-slate-400">
                Avg{' '}
                <strong className="text-emerald-300 tabular-nums">
                  {formatTeamMetricValue(teamSummary.avg, activeMetric)}
                </strong>
              </span>
              <span className="text-slate-400">
                Best{' '}
                <strong className="text-white tabular-nums">
                  {formatTeamMetricValue(teamSummary.best!, activeMetric)}
                </strong>
              </span>
            </>
          ) : (
            <span className="text-slate-500">No scored players yet</span>
          )}
          <span className="text-slate-500 ml-auto tabular-nums">
            {teamSummary.scored} of {teamSummary.roster} scored
          </span>
        </div>
      ) : null}

      {/* Leaderboard Cards Grid */}
      <div className="space-y-3">
        {!scopeHasData ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center overflow-hidden">
            <img
              src={CUCURELLA_CAT_PHOTO_URL}
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
            const bumpNet =
              item.adjustedBump || adjustedBumps[item.player.id] || 0;
            const myBumpNet = bumpCoachId
              ? playerBumpNetForCoach(
                  bumpTransactions,
                  item.player.id,
                  bumpCoachId,
                )
              : 0;
            const othersBumpNet = bumpCoachId
              ? playerBumpNetFromOthers(
                  bumpTransactions,
                  item.player.id,
                  bumpCoachId,
                )
              : bumpNet;
            const ineligible =
              effectiveTotalMode === 'adjusted' && item.eligibleToPlay === false;
            const prevIneligible =
              idx > 0 &&
              effectiveTotalMode === 'adjusted' &&
              sortedRankings[idx - 1].eligibleToPlay === false;
            const showIneligibleDivider =
              ineligible && !prevIneligible && idx > 0;

            const unscored =
              !ineligible &&
              (individualCoachOrdinals
                ? !individualCoachOrdinals.has(item.player.id)
                : isUnscoredForRankMode(
                    item,
                    sortBy,
                    selectedLabelId,
                    selectedMetricId,
                    metrics,
                    effectiveTotalMode,
                  ));
            const prevUnscored =
              idx > 0 &&
              !prevIneligible &&
              (individualCoachOrdinals
                ? !individualCoachOrdinals.has(sortedRankings[idx - 1].player.id)
                : isUnscoredForRankMode(
                    sortedRankings[idx - 1],
                    sortBy,
                    selectedLabelId,
                    selectedMetricId,
                    metrics,
                    effectiveTotalMode,
                  ));
            const showUnscoredDivider =
              unscored && !prevUnscored && !ineligible && idx > 0;

            const prevDisplayRank =
              idx > 0 ? rankForMode(sortedRankings[idx - 1], effectiveTotalMode) : null;
            const curDisplayRank = rankForMode(item, effectiveTotalMode);
            const crossedCuts = activeCutLines.filter((cut) => {
              if (cutLinesUseListPlace) {
                if (unscored || ineligible) return false;
                let place = 0;
                for (let i = 0; i <= idx; i++) {
                  const row = sortedRankings[i];
                  const rowIneligible =
                    effectiveTotalMode === 'adjusted' &&
                    row.eligibleToPlay === false;
                  if (rowIneligible) continue;
                  const rowUnscored = individualCoachOrdinals
                    ? !individualCoachOrdinals.has(row.player.id)
                    : isUnscoredForRankMode(
                        row,
                        sortBy,
                        selectedLabelId,
                        selectedMetricId,
                        metrics,
                        effectiveTotalMode,
                      );
                  if (rowUnscored) continue;
                  place += 1;
                }
                const prevPlace = place - 1;
                return prevPlace > 0 && prevPlace <= cut && place > cut;
              }
              if (effectiveTotalMode !== 'adjusted' || sortBy !== 'total') {
                return false;
              }
              if (prevDisplayRank == null) return false;
              const nextRank = curDisplayRank;
              return (
                prevDisplayRank <= cut &&
                (nextRank == null || nextRank > cut || ineligible)
              );
            });

            const isTop1 = idx === 0 && isBoardMode && !unscored;
            const isTop2 = idx === 1 && isBoardMode && !unscored;
            const isTop3 = idx === 2 && isBoardMode && !unscored;

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
              const labelScore =
                item.labelScores[metricPrimaryLabelId(activeMetric)];
              const metricDetail = labelScore?.metrics.find(
                (m) => m.metricId === activeMetric.id,
              );
              if (metricDetail) {
                specificMetricValue = formatTeamMetricValue(
                  metricDetail.aggregatedValue,
                  activeMetric,
                );
              }
            }

            const categoryScore =
              selectedLabelId !== 'all'
                ? labelScoreForMode(item, selectedLabelId, effectiveTotalMode)
                : null;

            const showingMeasuredValue =
              sortBy === 'metric' &&
              specificMetricValue;

            // Rank badge among scored players only; unscored share the bottom tier.
            const scoredAhead = sortedRankings
              .slice(0, idx)
              .filter((r) =>
                individualCoachOrdinals
                  ? individualCoachOrdinals.has(r.player.id)
                  : !isUnscoredForRankMode(
                      r,
                      sortBy,
                      selectedLabelId,
                      selectedMetricId,
                      metrics,
                      effectiveTotalMode,
                    ) &&
                    !(
                      effectiveTotalMode === 'adjusted' &&
                      r.eligibleToPlay === false
                    ),
              ).length;
            const listRank = unscored || ineligible ? null : scoredAhead + 1;
            const individualOrdinal = individualCoachOrdinals?.get(
              item.player.id,
            );
            // Formula totals use competition ranks from scoring (ties share place).
            const displayRank =
              individualOrdinal != null
                ? individualOrdinal
                : sortBy === 'total' && !unscored && !ineligible
                  ? rankForMode(item, effectiveTotalMode)
                  : listRank;

            const standingScore =
              individualOrdinal != null
                ? individualOrdinal
                : sortBy === 'label'
                  ? categoryScore
                  : sortBy === 'total' ||
                      sortBy !== 'metric'
                    ? totalForMode(item, effectiveTotalMode)
                    : null;

            const coachesAverageDetail =
              effectiveTotalMode === 'coaches' &&
              coachesScope === 'average' &&
              item.coachesTotalSum != null &&
              completeBallotCount > 0
                ? formatCoachesAverage(item.coachesTotalSum, completeBallotCount)
                : null;

            const poolRankPrimary =
              !showingMeasuredValue &&
              (sortBy === 'total' ||
                sortBy === 'label' ||
                sortBy !== 'metric');

            const primaryDisplay = ineligible
              ? 'Ineligible'
              : unscored
                ? 'Unscored'
                : showingMeasuredValue
                  ? specificMetricValue!
                  : poolRankPrimary && displayRank !== null
                    ? `#${displayRank}`
                    : standingScore !== null
                      ? String(standingScore)
                      : 'Unscored';

            const primaryIsPoolRank =
              !unscored &&
              !ineligible &&
              poolRankPrimary &&
              displayRank !== null;

            const primaryIsNumericScore =
              !unscored &&
              !ineligible &&
              !showingMeasuredValue &&
              !primaryIsPoolRank &&
              primaryDisplay !== 'Unscored';

            return (
              <React.Fragment key={item.player.id}>
              {crossedCuts.map((cut) => (
                <div
                  key={`cut-${cut}-${item.player.id}`}
                  className="flex items-center gap-3 pt-2 pb-1"
                  role="separator"
                  aria-label={`Cut line at ${cut}`}
                >
                  <div className="h-px flex-1 bg-violet-500/40" />
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-violet-300 shrink-0">
                    Cut @ {cut}
                  </span>
                  <div className="h-px flex-1 bg-violet-500/40" />
                </div>
              ))}
              {showIneligibleDivider && (
                <div
                  className="flex items-center gap-3 pt-2 pb-1"
                  role="separator"
                  aria-label="Ineligible players"
                >
                  <div className="h-px flex-1 bg-rose-500/30" />
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-rose-300 shrink-0">
                    Ineligible
                  </span>
                  <div className="h-px flex-1 bg-rose-500/30" />
                </div>
              )}
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
                className={`group relative z-0 hover:z-30 focus-within:z-30 bg-slate-900/90 hover:bg-slate-800/90 border transition-all duration-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer active:scale-[0.99] shadow-md ${
                  isTop1
                    ? 'border-amber-500/30 bg-gradient-to-r from-amber-950/20 to-slate-900'
                    : ineligible
                      ? 'border-rose-500/20 opacity-85'
                      : unscored
                        ? 'border-slate-800/60 opacity-90'
                        : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm border shrink-0 ${
                      ineligible
                        ? 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                        : rankBadgeStyle
                    }`}
                  >
                    {isTop1 ? (
                      <Trophy className="w-5 h-5 text-amber-400" />
                    ) : unscored || ineligible ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      <span>#{displayRank}</span>
                    )}
                  </div>

                  <div className="relative">
                    <img
                      src={
                        item.player.avatarUrl ||
                        defaultAvatarFor(item.player.id || item.player.jerseyNumber)
                      }
                      alt={item.player.name}
                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-800 group-hover:ring-emerald-500/50 transition-all"
                    />
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-md bg-slate-950 text-[10px] font-extrabold text-white border border-slate-700 shadow-sm">
                      #{item.player.jerseyNumber}
                    </span>
                    <PlayerBumpBadges
                      playerId={item.player.id}
                      playerName={item.player.name}
                      totalNet={bumpNet}
                      myNet={myBumpNet}
                      othersNet={othersBumpNet}
                      transactions={bumpTransactions}
                      coaches={coaches}
                    />
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
                      {rankingLabels.map((lbl) => {
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
                  {effectiveTotalMode === 'adjusted' && allowBumps && (
                    <div
                      className="flex flex-col items-stretch gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[9px] uppercase tracking-wider font-bold text-cyan-400/80 text-center">
                        Bump
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={
                            ineligible ||
                            !bumpCoachId ||
                            !canApplyBump(
                              adjustedBumps,
                              bumpBudget,
                              item.player.id,
                              -1,
                            )
                          }
                          onClick={() => onApplyBump(item.player.id, -1)}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-extrabold text-slate-200 hover:text-rose-300 hover:border-rose-500/40 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-0.5"
                          title="−1 Adjusted bump"
                          aria-label="Minus one adjusted bump"
                        >
                          <Minus className="w-3 h-3" />
                          1
                        </button>
                        <button
                          type="button"
                          disabled={
                            ineligible ||
                            !bumpCoachId ||
                            !canApplyBump(
                              adjustedBumps,
                              bumpBudget,
                              item.player.id,
                              1,
                            )
                          }
                          onClick={() => onApplyBump(item.player.id, 1)}
                          className="px-2 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-xs font-extrabold text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400/60 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-0.5"
                          title="+1 Adjusted bump"
                          aria-label="Plus one adjusted bump"
                        >
                          <Plus className="w-3 h-3" />
                          1
                        </button>
                      </div>
                      {bumpNet !== 0 && (
                        <button
                          type="button"
                          onClick={() => onClearPlayerBump(item.player.id)}
                          className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wide text-slate-400 hover:text-rose-300 bg-slate-900/80 hover:bg-rose-500/15 border border-slate-800 hover:border-rose-500/40 transition-colors"
                          title="Clear this player's Adjusted bumps"
                          aria-label={`Clear bumps for ${item.player.name}`}
                        >
                          <X className="w-2.5 h-2.5" />
                          Clear
                        </button>
                      )}
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
                      !unscored &&
                      !(
                        totalMode === 'coaches' && coachesScope !== 'average'
                      ) && (
                      <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        {totalMode === 'coaches'
                          ? coachesAverageDetail != null
                            ? `Avg ${coachesAverageDetail}`
                            : `Avg ${standingScore}`
                          : `Standing ${standingScore}`}
                        {totalMode === 'adjusted' &&
                          bumpNet !== 0 &&
                          item.adjustedTotalScore !== null && (
                            <span className="text-cyan-400/80">
                              {' '}
                              · base {item.adjustedTotalScore}
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
