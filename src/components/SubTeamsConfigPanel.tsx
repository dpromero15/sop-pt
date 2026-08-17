import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Users, X } from 'lucide-react';
import type { Player, SubTeam } from '../types';
import { StorageService } from '../services/storage';
import { flushNow } from '../services/storage/cloudSync';
import { SaveAndSyncButton } from './SaveAndSyncButton';
import {
  SUB_TEAM_COLOR_IDS,
  missingSuggestedSubTeams,
  newSubTeamId,
  normalizeSubTeams,
  playerSquadIds,
  stripSquadIdFromPlayers,
  subTeamChipClass,
} from '../utils/subTeams';

interface SubTeamsConfigPanelProps {
  subTeams: SubTeam[];
  players: Player[];
  onRefreshData: () => void;
}

type Draft = {
  originalId: string | null;
  name: string;
  shortName: string;
  color: string;
};

function emptyDraft(): Draft {
  return { originalId: null, name: '', shortName: '', color: 'emerald' };
}

function draftFrom(team: SubTeam): Draft {
  return {
    originalId: team.id,
    name: team.name,
    shortName: team.shortName,
    color: team.color,
  };
}

export const SubTeamsConfigPanel: React.FC<SubTeamsConfigPanelProps> = ({
  subTeams,
  players,
  onRefreshData,
}) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const usedIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const player of players) {
      for (const id of playerSquadIds(player, subTeams)) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [players, subTeams]);

  const persist = (next: SubTeam[]) => {
    StorageService.saveSubTeams(normalizeSubTeams(next));
    void flushNow();
    onRefreshData();
  };

  const handleSaveDraft = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError('Name is required (e.g. Varsity).');
      return;
    }
    const shortName = draft.shortName.trim() || name.slice(0, 3);
    const existingIds = subTeams.map((row) => row.id);
    const id =
      draft.originalId ??
      newSubTeamId(
        name,
        existingIds.filter((value) => value !== draft.originalId),
      );
    const nextRow: SubTeam = {
      id,
      name,
      shortName,
      color: draft.color,
      sortOrder:
        subTeams.find((row) => row.id === draft.originalId)?.sortOrder ??
        subTeams.length,
    };
    const next = draft.originalId
      ? subTeams.map((row) => (row.id === draft.originalId ? nextRow : row))
      : [...subTeams, nextRow];
    persist(next);
    setDraft(null);
    setError('');
  };

  const move = (index: number, delta: number) => {
    const next = [...subTeams];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    persist(next.map((item, sortOrder) => ({ ...item, sortOrder })));
  };

  const handleDelete = (id: string) => {
    const assigned = usedIds.get(id) ?? 0;
    const label = subTeams.find((row) => row.id === id)?.name ?? 'this group';
    if (
      !confirm(
        assigned > 0
          ? `Delete ${label}? It will be removed from ${assigned} player${assigned === 1 ? '' : 's'}.`
          : `Delete ${label}?`,
      )
    ) {
      return;
    }
    persist(subTeams.filter((row) => row.id !== id).map((row, sortOrder) => ({ ...row, sortOrder })));
    StorageService.savePlayers(stripSquadIdFromPlayers(players, id));
    void flushNow();
    onRefreshData();
  };

  const addSuggested = (name: string, shortName: string, color: string) => {
    persist([
      ...subTeams,
      {
        id: newSubTeamId(
          name,
          subTeams.map((row) => row.id),
        ),
        name,
        shortName,
        color,
        sortOrder: subTeams.length,
      },
    ]);
  };

  const suggestions = missingSuggestedSubTeams(subTeams);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-emerald-400">
            <Users className="w-4 h-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Sub-teams
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Varsity, JV, C-team, or any groups inside this program. Players can
            belong to more than one. Rankings can show Combined or Separated
            lists.
          </p>
        </div>
        <SaveAndSyncButton />
      </div>

      {subTeams.length === 0 ? (
        <p className="text-xs text-slate-500">
          No groups yet. Rankings stay whole-squad until you add at least one.
        </p>
      ) : (
        <ul className="space-y-2">
          {subTeams.map((team, index) => (
            <li
              key={team.id}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
                  aria-label={`Move ${team.name} up`}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === subTeams.length - 1}
                  className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
                  aria-label={`Move ${team.name} down`}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-white text-sm">{team.name}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {team.shortName}
                  {(usedIds.get(team.id) ?? 0) > 0
                    ? ` · ${usedIds.get(team.id)} on roster`
                    : ''}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${subTeamChipClass(team.color)}`}
              >
                {team.shortName}
              </span>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setDraft(draftFrom(team));
                }}
                className="text-xs font-semibold text-emerald-300 hover:text-white px-2 py-1"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(team.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10"
                aria-label={`Delete ${team.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((row) => (
            <button
              key={row.name}
              type="button"
              onClick={() => addSuggested(row.name, row.shortName, row.color)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
            >
              Add {row.name}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setError('');
          setDraft(emptyDraft());
        }}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
      >
        <Plus className="w-3.5 h-3.5" />
        Add group
      </button>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 px-3">
          <div className="w-full max-w-md max-h-[min(92dvh,100%)] flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {draft.originalId ? 'Edit group' : 'Add group'}
              </h3>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Name
                </label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Varsity"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Short name
                </label>
                <input
                  value={draft.shortName}
                  onChange={(e) =>
                    setDraft({ ...draft, shortName: e.target.value })
                  }
                  placeholder="V"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Color
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SUB_TEAM_COLOR_IDS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setDraft({ ...draft, color })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${subTeamChipClass(color)} ${
                        draft.color === color ? 'ring-2 ring-white/40' : ''
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <p className="text-xs text-rose-300 font-semibold">{error}</p>
              )}
            </div>
            <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-slate-800 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
