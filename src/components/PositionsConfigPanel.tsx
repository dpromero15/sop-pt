import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Shirt, Trash2, X } from 'lucide-react';
import type {
  Player,
  PlayerRankingPool,
  PositionDefinition,
  PositionLine,
} from '../types';
import { StorageService } from '../services/storage';
import { flushNow } from '../services/storage/cloudSync';
import { SaveAndSyncButton } from './SaveAndSyncButton';
import {
  cloneDefaultPlayerPositions,
  ensureCatalogCoversCodes,
  formatPositionLabel,
  normalizePlayerPositions,
  normalizePositionCode,
  playerPositionCodes,
} from '../utils/playerPositions';
import { PLAYER_RANKING_POOLS } from '../utils/playerRankingPools';

const LINE_OPTIONS: Array<{ id: PositionLine; label: string }> = [
  { id: 'gk', label: 'Goalkeeper' },
  { id: 'def', label: 'Defense' },
  { id: 'mid', label: 'Midfield' },
  { id: 'fwd', label: 'Forward' },
];

interface PositionsConfigPanelProps {
  positions: PositionDefinition[];
  players: Player[];
  onRefreshData: () => void;
}

type Draft = {
  originalCode: string | null;
  code: string;
  name: string;
  tacticalNumber: string;
  tacticalNumberSecondary: string;
  line: PositionLine;
  rankingPool: PlayerRankingPool;
};

function emptyDraft(sortHint: number): Draft {
  return {
    originalCode: null,
    code: '',
    name: '',
    tacticalNumber: String(sortHint >= 30 && sortHint < 40 ? 4 : 8),
    tacticalNumberSecondary: '',
    line: 'def',
    rankingPool: 'center-defense',
  };
}

function draftFrom(position: PositionDefinition): Draft {
  return {
    originalCode: position.code,
    code: position.code,
    name: position.name,
    tacticalNumber: String(position.tacticalNumber),
    tacticalNumberSecondary:
      position.tacticalNumberSecondary != null
        ? String(position.tacticalNumberSecondary)
        : '',
    line: position.line,
    rankingPool: position.rankingPool,
  };
}

export const PositionsConfigPanel: React.FC<PositionsConfigPanelProps> = ({
  positions,
  players,
  onRefreshData,
}) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const usedCodes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const player of players) {
      for (const code of playerPositionCodes(player)) {
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    }
    return counts;
  }, [players]);

  const persist = (next: PositionDefinition[]) => {
    StorageService.savePositions(
      ensureCatalogCoversCodes(
        normalizePlayerPositions(next),
        players.flatMap((p) => playerPositionCodes(p)),
      ),
    );
    void flushNow();
    onRefreshData();
  };

  const handleSaveDraft = () => {
    if (!draft) return;
    const code = normalizePositionCode(draft.code);
    const name = draft.name.trim() || code;
    const tacticalNumber = Math.floor(Number(draft.tacticalNumber));
    const secondaryRaw = draft.tacticalNumberSecondary.trim();
    const secondary = secondaryRaw
      ? Math.floor(Number(secondaryRaw))
      : undefined;
    if (!code) {
      setError('Code is required (e.g. LCB).');
      return;
    }
    if (!Number.isFinite(tacticalNumber) || tacticalNumber < 1 || tacticalNumber > 99) {
      setError('Tactical number must be 1–99.');
      return;
    }
    if (
      secondary != null &&
      (!Number.isFinite(secondary) || secondary < 1 || secondary > 99)
    ) {
      setError('Second number must be 1–99 if set.');
      return;
    }
    const taken = positions.some(
      (p) => p.code === code && p.code !== draft.originalCode,
    );
    if (taken) {
      setError(`Code ${code} is already in the catalog.`);
      return;
    }

    const next = [...positions];
    const row: PositionDefinition = {
      code,
      name,
      tacticalNumber,
      line: draft.line,
      rankingPool: draft.rankingPool,
      sortOrder:
        draft.originalCode != null
          ? (positions.find((p) => p.code === draft.originalCode)?.sortOrder ??
            (positions.length + 1) * 10)
          : Math.max(0, ...positions.map((p) => p.sortOrder)) + 10,
    };
    if (secondary != null && secondary !== tacticalNumber) {
      row.tacticalNumberSecondary = secondary;
    }
    if (draft.originalCode) {
      const idx = next.findIndex((p) => p.code === draft.originalCode);
      if (idx >= 0) next[idx] = row;
      else next.push(row);
    } else {
      next.push(row);
    }
    persist(next);
    setDraft(null);
    setError('');
  };

  const handleDelete = (code: string) => {
    const inUse = usedCodes.get(code) ?? 0;
    if (inUse > 0) {
      alert(
        `Cannot delete ${code}: ${inUse} player${inUse === 1 ? '' : 's'} still use it. Reassign them first.`,
      );
      return;
    }
    if (!confirm(`Remove ${code} from the catalog?`)) return;
    persist(positions.filter((p) => p.code !== code));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= positions.length) return;
    const next = positions.map((p) => ({ ...p }));
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    persist(next.map((p, i) => ({ ...p, sortOrder: (i + 1) * 10 })));
  };

  const handleReset = () => {
    if (
      !confirm(
        'Reset positions to the default catalog (LCB 5 / RCB 4, classic numbers)? Codes still on the roster are kept.',
      )
    ) {
      return;
    }
    persist(
      ensureCatalogCoversCodes(
        cloneDefaultPlayerPositions(),
        players.flatMap((p) => playerPositionCodes(p)),
      ),
    );
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <Shirt className="w-5 h-5 text-emerald-400" />
            <span>Positions & tactical numbers</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Each role has its own soccer number — RCB is a 4, LCB is a 5, not
            one combined CB 4/5. Change numbers if your club numbers the other
            way.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveAndSyncButton compact />
          <button
            type="button"
            onClick={() => {
              setError('');
              setDraft(emptyDraft(30));
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold px-3 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>

      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 overflow-hidden">
        {positions.map((position, index) => (
          <li
            key={position.code}
            className="flex items-center gap-2 bg-slate-950/40 px-3 py-2.5"
          >
            <div className="flex flex-col">
              <button
                type="button"
                aria-label={`Move ${position.code} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Move ${position.code} down`}
                disabled={index === positions.length - 1}
                onClick={() => move(index, 1)}
                className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-white text-sm">
                {formatPositionLabel(position)}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {LINE_OPTIONS.find((l) => l.id === position.line)?.label} ·{' '}
                {PLAYER_RANKING_POOLS.find((p) => p.id === position.rankingPool)
                  ?.label}
                {(usedCodes.get(position.code) ?? 0) > 0
                  ? ` · ${usedCodes.get(position.code)} on roster`
                  : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setError('');
                setDraft(draftFrom(position));
              }}
              className="text-xs font-semibold text-emerald-300 hover:text-white px-2 py-1"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => handleDelete(position.code)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10"
              aria-label={`Delete ${position.code}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleReset}
        className="text-xs font-semibold text-slate-500 hover:text-slate-300"
      >
        Reset to default catalog
      </button>

      {draft && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[min(92dvh,100%)] flex flex-col overflow-hidden shadow-2xl">
            <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {draft.originalCode ? `Edit ${draft.originalCode}` : 'Add position'}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                    Code
                  </label>
                  <input
                    value={draft.code}
                    disabled={draft.originalCode != null}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="LCB"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                    Display name
                  </label>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="LCB"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                    Tactical number
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={draft.tacticalNumber}
                    onChange={(e) =>
                      setDraft({ ...draft, tacticalNumber: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                    Second number (optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={draft.tacticalNumberSecondary}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        tacticalNumberSecondary: e.target.value,
                      })
                    }
                    placeholder="Only for generics like WB"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Line
                </label>
                <select
                  value={draft.line}
                  onChange={(e) =>
                    setDraft({ ...draft, line: e.target.value as PositionLine })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                >
                  {LINE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Default Coaches Rank pool
                </label>
                <select
                  value={draft.rankingPool}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rankingPool: e.target.value as PlayerRankingPool,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                >
                  {PLAYER_RANKING_POOLS.map((pool) => (
                    <option key={pool.id} value={pool.id}>
                      {pool.label}
                    </option>
                  ))}
                </select>
              </div>
              {error && (
                <p className="text-xs font-semibold text-rose-300">{error}</p>
              )}
            </div>
            <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-slate-800 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-bold"
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
