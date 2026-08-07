import React, { useMemo, useState } from 'react';
import { Award, Plus, Trash2, Check } from 'lucide-react';
import type { Coach, CoachBallot, Player } from '../types';
import { StorageService } from '../services/storage';
import { activePlayers, isCompleteBallot } from '../utils/coachesRating';

interface CoachesRatingViewProps {
  coaches: Coach[];
  ballots: CoachBallot[];
  players: Player[];
  onRefreshData: () => void;
}

export const CoachesRatingView: React.FC<CoachesRatingViewProps> = ({
  coaches,
  ballots,
  players,
  onRefreshData,
}) => {
  const active = useMemo(() => activePlayers(players), [players]);
  const [selectedCoachId, setSelectedCoachId] = useState<string>(
    () => coaches[0]?.id ?? '',
  );
  const [newCoachName, setNewCoachName] = useState('');
  const [draftRanks, setDraftRanks] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);

  const selectedCoach =
    coaches.find((c) => c.id === selectedCoachId) ?? coaches[0] ?? null;

  const ballotForSelected = selectedCoach
    ? ballots.find((b) => b.coachId === selectedCoach.id)
    : undefined;

  // Load ballot into draft when coach changes
  React.useEffect(() => {
    if (!selectedCoach) {
      setDraftRanks({});
      return;
    }
    const existing = ballots.find((b) => b.coachId === selectedCoach.id);
    setDraftRanks(existing?.ranks ? { ...existing.ranks } : {});
  }, [selectedCoach?.id, ballots]);

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

  const setRank = (playerId: string, rank: number) => {
    setDraftRanks((prev) => {
      const next = { ...prev };
      if (!rank) {
        delete next[playerId];
      } else {
        next[playerId] = rank;
      }
      return next;
    });
  };

  const draftBallot: CoachBallot | null = selectedCoach
    ? { coachId: selectedCoach.id, ranks: draftRanks }
    : null;

  const activeIds = active.map((p) => p.id);
  const complete =
    draftBallot !== null && isCompleteBallot(draftBallot, activeIds);

  const usedRanks = new Set(
    Object.values(draftRanks).filter((r) => Number.isFinite(r)),
  );

  const handleSaveBallot = () => {
    if (!draftBallot) return;
    StorageService.saveCoachBallot(draftBallot);
    onRefreshData();
    showToast(
      complete
        ? 'Ballot saved (complete — counts toward Coaches Totals)'
        : 'Ballot saved (incomplete — ignored until all active players ranked)',
    );
  };

  const n = active.length;

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
            Each coach assigns unique ordinal ranks (1 = best) to every active
            player. Coaches Totals sum complete ballots only — lower sum ranks
            higher. Incomplete ballots are ignored.
          </p>
        </div>
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

      {coaches.length === 0 ? (
        <p className="text-sm text-slate-500">No coaches yet — add one above.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {coaches.map((c) => {
              const ballot = ballots.find((b) => b.coachId === c.id);
              const isComplete =
                ballot !== undefined &&
                isCompleteBallot(ballot, activeIds);
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
                  Ranking as <strong className="text-white">{selectedCoach.name}</strong>
                  {' · '}
                  {n} active player{n === 1 ? '' : 's'}
                  {' · '}
                  <span className={complete ? 'text-emerald-400' : 'text-amber-400'}>
                    {complete ? 'Complete ballot' : 'Incomplete'}
                  </span>
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

              {active.length === 0 ? (
                <p className="text-sm text-slate-500">No active players to rank.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {[...active]
                    .sort((a, b) => a.jerseyNumber - b.jerseyNumber)
                    .map((p) => {
                      const current = draftRanks[p.id];
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                        >
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-white truncate">
                              #{p.jerseyNumber} {p.name}
                            </span>
                            <span className="ml-2 text-[11px] text-slate-500">
                              {p.position}
                            </span>
                          </div>
                          <select
                            value={current ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRank(p.id, v === '' ? 0 : Number(v));
                            }}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                          >
                            <option value="">—</option>
                            {Array.from({ length: n }, (_, i) => i + 1).map(
                              (rank) => {
                                const taken =
                                  usedRanks.has(rank) && current !== rank;
                                return (
                                  <option
                                    key={rank}
                                    value={rank}
                                    disabled={taken}
                                  >
                                    {rank}
                                    {rank === 1 ? ' (best)' : ''}
                                  </option>
                                );
                              },
                            )}
                          </select>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
