import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Plus, Trash2, Check, GripVertical } from 'lucide-react';
import { Reorder, useDragControls } from 'motion/react';
import type {
  Coach,
  CoachBallot,
  CoachPositionBallot,
  LabelDefinition,
  Player,
  PlayerRanking,
  PositionDefinition,
} from '../types';
import { StorageService } from '../services/storage';
import { flushNow } from '../services/storage/cloudSync';
import {
  activePlayers,
  isCompleteBallot,
  isCompletePositionBallot,
  playersForPosition,
} from '../utils/coachesRating';
import {
  formatPlayerPosition,
  formatPlayerPositions,
  formatPositionLabel,
} from '../utils/playerPositions';
import { catalogPositionsWithPlayers } from '../utils/positionRankings';
import { SaveAndSyncButton } from './SaveAndSyncButton';
import { defaultAvatarFor } from '../constants/avatars';

interface CoachesRatingViewProps {
  coaches: Coach[];
  ballots: CoachBallot[];
  positionBallots: CoachPositionBallot[];
  players: Player[];
  rankings: PlayerRanking[];
  labels: LabelDefinition[];
  positions: PositionDefinition[];
  onRefreshData: () => void;
}

function scoreToneClass(score: number | null | undefined): string {
  if (score == null) return 'text-slate-500';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-300';
  return 'text-rose-400';
}

function formatRank(rank: number | null | undefined): string {
  return rank != null ? `#${rank}` : '—';
}

/** Order active players by saved ranks (1 first); unscored/missing → jersey order at end. */
function orderFromBallot(
  active: Player[],
  ranks: Record<string, number> | undefined,
): Player[] {
  const byId = new Map(active.map((p) => [p.id, p]));
  const ranked = active
    .filter((p) => ranks?.[p.id] != null && Number.isFinite(ranks[p.id]))
    .sort((a, b) => (ranks![a.id] ?? 0) - (ranks![b.id] ?? 0));
  const rankedIds = new Set(ranked.map((p) => p.id));
  const rest = active
    .filter((p) => !rankedIds.has(p.id))
    .sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  return [...ranked, ...rest].map((p) => byId.get(p.id)!);
}

function ranksFromOrder(ordered: Player[]): Record<string, number> {
  const ranks: Record<string, number> = {};
  ordered.forEach((p, i) => {
    ranks[p.id] = i + 1;
  });
  return ranks;
}

interface RankRowProps {
  player: Player;
  rank: number;
  ranking?: PlayerRanking;
  labels: LabelDefinition[];
}

const RankRow: React.FC<RankRowProps> = ({
  player,
  rank,
  ranking,
  labels,
}) => {
  const controls = useDragControls();
  const labelChips = labels
    .map((lbl) => {
      const score = ranking?.labelScores[lbl.id]?.score ?? null;
      return { lbl, score };
    })
    .filter((x) => x.score != null)
    .slice(0, 6);

  return (
    <Reorder.Item
      value={player}
      dragListener={false}
      dragControls={controls}
      className="flex items-stretch gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 list-none select-none"
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        borderColor: 'rgba(245, 158, 11, 0.45)',
        zIndex: 20,
      }}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${player.name}`}
        title="Drag to reorder"
        className="p-1.5 -ml-1 self-center rounded-lg text-slate-500 hover:text-amber-300 hover:bg-slate-800 touch-none cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={(e) => controls.start(e)}
        style={{ touchAction: 'none' }}
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <span
        className={`w-8 shrink-0 self-center text-center text-sm font-black tabular-nums ${
          rank === 1
            ? 'text-amber-400'
            : rank <= 3
              ? 'text-emerald-400'
              : 'text-slate-400'
        }`}
      >
        #{rank}
      </span>

      <img
        src={player.avatarUrl || defaultAvatarFor(player.id || player.jerseyNumber)}
        alt=""
        draggable={false}
        className="w-11 h-11 self-center rounded-xl object-cover ring-2 ring-slate-800 shrink-0 pointer-events-none"
      />

      <div className="min-w-0 flex-1 pointer-events-none space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white truncate">
                {player.name}
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold shrink-0">
                #{player.jerseyNumber}
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-slate-800/80 text-slate-400 text-[10px] font-bold shrink-0">
                {formatPlayerPositions(player)}
              </span>
              {player.status === 'injured' && (
                <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[10px] font-semibold">
                  Injured
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
              <span>
                Att{' '}
                <strong className="text-emerald-400 font-semibold">
                  {ranking?.attendanceRate != null
                    ? `${ranking.attendanceRate}%`
                    : '—'}
                </strong>
              </span>
              <span>Foot: {player.preferredFoot}</span>
              {player.grade != null && <span>Gr {player.grade}</span>}
              {player.birthYear != null && <span>Born {player.birthYear}</span>}
              {ranking?.recentTrend && ranking.recentTrend !== 'stable' && (
                <span
                  className={
                    ranking.recentTrend === 'up'
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }
                >
                  Trend {ranking.recentTrend === 'up' ? '↑' : '↓'}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right tabular-nums">
            <div className="flex items-baseline justify-end gap-2">
              <div>
                <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">
                  Stat
                </div>
                <div
                  className={`text-sm font-black leading-tight ${
                    ranking?.overallRank != null
                      ? 'text-emerald-400'
                      : 'text-slate-500'
                  }`}
                >
                  {formatRank(ranking?.overallRank)}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">
                  Adj
                </div>
                <div
                  className={`text-sm font-black leading-tight ${
                    ranking?.adjustedRank != null
                      ? 'text-cyan-300'
                      : 'text-slate-500'
                  }`}
                >
                  {formatRank(ranking?.adjustedRank)}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {ranking?.totalScore != null ? (
                <>
                  Score{' '}
                  <span className={scoreToneClass(ranking.totalScore)}>
                    {Math.round(ranking.totalScore)}
                  </span>
                </>
              ) : (
                'Unscored'
              )}
            </div>
          </div>
        </div>

        {labelChips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {labelChips.map(({ lbl, score }) => (
              <span
                key={lbl.id}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] ${lbl.badgeBg}`}
              >
                <span className="opacity-80">{lbl.name}</span>
                <span className={`font-extrabold ${scoreToneClass(score)}`}>
                  {Math.round(score!)}
                </span>
              </span>
            ))}
          </div>
        )}

        {player.notes?.trim() && (
          <p className="text-[11px] text-slate-500 italic line-clamp-1">
            “{player.notes.trim()}”
          </p>
        )}
      </div>
    </Reorder.Item>
  );
};

export const CoachesRatingView: React.FC<CoachesRatingViewProps> = ({
  coaches,
  ballots,
  positionBallots,
  players,
  rankings,
  labels,
  positions,
  onRefreshData,
}) => {
  const active = useMemo(() => activePlayers(players), [players]);
  const rankingMap = useMemo(
    () => new Map(rankings.map((r) => [r.player.id, r])),
    [rankings],
  );
  const [ballotMode, setBallotMode] = useState<'squad' | 'position'>('squad');
  const filledPositions = useMemo(
    () => catalogPositionsWithPlayers(positions, players),
    [positions, players],
  );
  const [selectedPosition, setSelectedPosition] = useState(
    () => filledPositions[0]?.code ?? '',
  );
  const eligible = useMemo(() => {
    if (ballotMode === 'position' && selectedPosition) {
      return playersForPosition(players, selectedPosition);
    }
    return active;
  }, [ballotMode, selectedPosition, players, active]);

  useEffect(() => {
    if (ballotMode !== 'position') return;
    if (filledPositions.length === 0) {
      if (selectedPosition) setSelectedPosition('');
      return;
    }
    if (!filledPositions.some((position) => position.code === selectedPosition)) {
      setSelectedPosition(filledPositions[0].code);
    }
  }, [ballotMode, filledPositions, selectedPosition]);
  const [selectedCoachId, setSelectedCoachId] = useState<string>(
    () => coaches[0]?.id ?? '',
  );
  const [newCoachName, setNewCoachName] = useState('');
  const [orderedPlayers, setOrderedPlayers] = useState<Player[]>(() =>
    orderFromBallot(activePlayers(players), undefined),
  );
  const [toast, setToast] = useState<string | null>(null);
  const reorderSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCoach =
    coaches.find((c) => c.id === selectedCoachId) ?? coaches[0] ?? null;

  // Load ballot order when coach, mode, position, or roster changes
  useEffect(() => {
    if (!selectedCoach) {
      setOrderedPlayers(orderFromBallot(eligible, undefined));
      return;
    }
    if (ballotMode === 'position' && selectedPosition) {
      const existing = positionBallots.find(
        (b) =>
          b.coachId === selectedCoach.id && b.position === selectedPosition,
      );
      setOrderedPlayers(orderFromBallot(eligible, existing?.ranks));
      return;
    }
    const existing = ballots.find((b) => b.coachId === selectedCoach.id);
    setOrderedPlayers(orderFromBallot(eligible, existing?.ranks));
  }, [
    selectedCoach?.id,
    ballots,
    positionBallots,
    eligible,
    ballotMode,
    selectedPosition,
  ]);

  // Keep selection valid when coaches list changes
  React.useEffect(() => {
    if (coaches.length === 0) {
      setSelectedCoachId('');
      return;
    }
    if (!coaches.some((c) => c.id === selectedCoachId)) {
      setSelectedCoachId(coaches[0].id);
    }
  }, [coaches, selectedCoachId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleAddCoach = () => {
    const name = newCoachName.trim();
    if (!name) return;
    const coach = StorageService.addCoach({ name });
    setNewCoachName('');
    setSelectedCoachId(coach.id);
    onRefreshData();
    showToast(`Added ${name}`);
  };

  const handleDeleteCoach = (id: string) => {
    if (!confirm('Remove this coach and their ballot?')) return;
    StorageService.deleteCoach(id);
    onRefreshData();
  };

  const draftRanks = ranksFromOrder(orderedPlayers);
  const draftBallot: CoachBallot | null =
    selectedCoach && ballotMode === 'squad'
      ? { coachId: selectedCoach.id, ranks: draftRanks }
      : null;
  const draftPositionBallot: CoachPositionBallot | null =
    selectedCoach && ballotMode === 'position' && selectedPosition
      ? {
          coachId: selectedCoach.id,
          position: selectedPosition,
          ranks: draftRanks,
        }
      : null;

  const activeIds = eligible.map((p) => p.id);
  const complete =
    ballotMode === 'position'
      ? isCompletePositionBallot(draftPositionBallot ?? undefined, activeIds)
      : draftBallot !== null && isCompleteBallot(draftBallot, activeIds);

  const persistSquadBallot = (draft: CoachBallot, announce: boolean) => {
    StorageService.saveCoachBallot(draft);
    void flushNow();
    onRefreshData();
    if (!announce) return;
    const counts = isCompleteBallot(
      draft,
      activePlayers(players).map((p) => p.id),
    );
    showToast(
      counts
        ? 'Ballot saved — counts toward squad Coaches Rank'
        : 'Ballot saved (incomplete — rank every active player)',
    );
  };

  const persistPositionBallot = (
    draft: CoachPositionBallot,
    announce: boolean,
  ) => {
    StorageService.saveCoachPositionBallot(draft);
    void flushNow();
    onRefreshData();
    if (!announce) return;
    showToast(
      isCompletePositionBallot(draft, activeIds)
        ? `Saved — counts toward ${formatPlayerPosition(draft.position)} Coaches Rank`
        : 'Saved (incomplete — rank every player assigned this role)',
    );
  };

  const handleSaveBallot = () => {
    if (draftPositionBallot) {
      persistPositionBallot(draftPositionBallot, true);
      return;
    }
    if (!draftBallot) return;
    persistSquadBallot(draftBallot, true);
  };

  const handleReorder = (next: Player[]) => {
    setOrderedPlayers(next);
    if (!selectedCoach) return;
    if (reorderSaveTimer.current) clearTimeout(reorderSaveTimer.current);
    reorderSaveTimer.current = setTimeout(() => {
      const ranks = ranksFromOrder(next);
      if (ballotMode === 'position' && selectedPosition) {
        persistPositionBallot(
          { coachId: selectedCoach.id, position: selectedPosition, ranks },
          false,
        );
        return;
      }
      persistSquadBallot({ coachId: selectedCoach.id, ranks }, false);
    }, 400);
  };

  useEffect(() => {
    if (reorderSaveTimer.current) {
      clearTimeout(reorderSaveTimer.current);
      reorderSaveTimer.current = null;
    }
  }, [selectedCoach?.id]);

  useEffect(
    () => () => {
      if (reorderSaveTimer.current) clearTimeout(reorderSaveTimer.current);
    },
    [],
  );

  const n = orderedPlayers.length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
      {toast && (
        <div className="fixed top-16 right-4 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2">
          <Check className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Coaches Rating</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Squad ballots rank the whole roster 1…N. By position is a separate
            depth chart: only players assigned that role, unique 1…N for that
            role. Drag the grip — top is #1.
          </p>
        </div>
        {selectedCoach && (
          <SaveAndSyncButton
            beforeFlush={() => {
              if (draftPositionBallot) {
                StorageService.saveCoachPositionBallot(draftPositionBallot);
              } else if (draftBallot) {
                StorageService.saveCoachBallot(draftBallot);
              }
            }}
            onSaved={() => {
              onRefreshData();
              showToast(
                complete
                  ? 'Saved — counts toward Coaches Rank'
                  : 'Saved (incomplete — rank every active player)',
              );
            }}
          />
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="New coach name"
          value={newCoachName}
          onChange={(e) => setNewCoachName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddCoach();
          }}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onClick={handleAddCoach}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          Add coach
        </button>
      </div>

      <div
        className="inline-flex rounded-xl border border-slate-800 bg-slate-950/80 p-1"
        role="tablist"
        aria-label="Coaches ballot type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={ballotMode === 'squad'}
          onClick={() => setBallotMode('squad')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            ballotMode === 'squad'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Squad
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={ballotMode === 'position'}
          onClick={() => {
            setBallotMode('position');
            if (!selectedPosition && filledPositions[0]) {
              setSelectedPosition(filledPositions[0].code);
            }
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            ballotMode === 'position'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          By position
        </button>
      </div>
      {ballotMode === 'position' && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filledPositions.length === 0 ? (
            <p className="text-xs text-slate-500">
              Assign players to positions on the roster first.
            </p>
          ) : (
            filledPositions.map((def) => (
              <button
                key={def.code}
                type="button"
                onClick={() => setSelectedPosition(def.code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  selectedPosition === def.code
                    ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                {formatPositionLabel(def)}
              </button>
            ))
          )}
        </div>
      )}

      {coaches.length === 0 ? (
        <p className="text-sm text-slate-500">No coaches yet — add one above.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {coaches.map((c) => {
              const isComplete =
                ballotMode === 'position' && selectedPosition
                  ? isCompletePositionBallot(
                      positionBallots.find(
                        (b) =>
                          b.coachId === c.id && b.position === selectedPosition,
                      ),
                      activeIds,
                    )
                  : (() => {
                      const ballot = ballots.find((b) => b.coachId === c.id);
                      return (
                        ballot !== undefined &&
                        isCompleteBallot(
                          ballot,
                          activePlayers(players).map((p) => p.id),
                        )
                      );
                    })();
              const selected = selectedCoach?.id === c.id;
              return (
                <div key={c.id} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCoachId(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      selected
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {c.name}
                    {isComplete ? ' ✓' : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCoach(c.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                    title="Remove coach"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {selectedCoach && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400">
                  Ranking as{' '}
                  <strong className="text-white">{selectedCoach.name}</strong>
                  {' · '}
                  {n} {ballotMode === 'position' ? 'assigned' : 'active'} player
                  {n === 1 ? '' : 's'}
                  {ballotMode === 'position' && selectedPosition
                    ? ` at ${formatPlayerPosition(selectedPosition)}`
                    : ''}
                  {' · '}
                  {complete ? (
                    <span className="text-emerald-400">
                      Complete — shows on Coaches Rank
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      Incomplete — finish unique 1…{n || 'N'} for this list
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleSaveBallot}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save ballot
                </button>
              </div>

              {n === 0 ? (
                <p className="text-sm text-slate-500">
                  No active players to rank.
                </p>
              ) : (
                <Reorder.Group
                  axis="y"
                  values={orderedPlayers}
                  onReorder={handleReorder}
                  className="space-y-2 max-h-[36rem] overflow-y-auto pr-1"
                >
                  {orderedPlayers.map((p, index) => (
                    <RankRow
                      key={p.id}
                      player={p}
                      rank={index + 1}
                      ranking={rankingMap.get(p.id)}
                      labels={labels}
                    />
                  ))}
                </Reorder.Group>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
