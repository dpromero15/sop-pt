import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, LayoutGrid, ListFilter } from 'lucide-react';
import type {
  ComplianceRequirement,
  Player,
  PlayerComplianceState,
} from '../types';
import { StorageService } from '../services/storage';
import { SaveAndSyncButton } from './SaveAndSyncButton';
import {
  completeFromChecked,
  isFlagRequirement,
  isRequirementChecked,
  isRequirementComplete,
  missingBlockingRequirements,
  missingRequirements,
} from '../utils/eligibility';
import {
  CONSEQUENCE_BADGE_CLASS,
  CONSEQUENCE_LABEL,
  consequenceKeysForRequirement,
  consequenceLabelsForRequirement,
  playerConsequenceBadges,
} from '../utils/complianceConsequences';
import { rosterPlayers } from '../utils/playerStatus';

type ComplianceMode = 'triage' | 'board';
type IncompleteScope = 'blocking' | 'all';
type PlayerSortMode = 'name-asc' | 'name-desc' | 'jersey';

interface ComplianceBoardViewProps {
  players: Player[];
  requirements: ComplianceRequirement[];
  playerCompliance: PlayerComplianceState;
  onRefreshData: () => void;
  readOnly?: boolean;
}

export const ComplianceBoardView: React.FC<ComplianceBoardViewProps> = ({
  players,
  requirements,
  playerCompliance,
  onRefreshData,
  readOnly = false,
}) => {
  const [mode, setMode] = useState<ComplianceMode>('triage');
  const [incompleteScope, setIncompleteScope] =
    useState<IncompleteScope>('blocking');
  const [incompleteRowsOnly, setIncompleteRowsOnly] = useState(false);
  const [playerSort, setPlayerSort] = useState<PlayerSortMode>('name-asc');

  const sortedRequirements = useMemo(
    () => [...requirements].sort((a, b) => a.sortOrder - b.sortOrder),
    [requirements],
  );

  const sortedPlayers = useMemo(() => {
    const next = rosterPlayers(players);
    next.sort((a, b) => {
      if (playerSort === 'jersey') {
        const jersey = a.jerseyNumber - b.jerseyNumber;
        if (jersey !== 0) return jersey;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      const name = a.name.localeCompare(b.name, undefined, {
        sensitivity: 'base',
      });
      if (name !== 0) return playerSort === 'name-desc' ? -name : name;
      return a.jerseyNumber - b.jerseyNumber;
    });
    return next;
  }, [players, playerSort]);

  const setComplete = (
    playerId: string,
    requirementId: string,
    complete: boolean,
  ) => {
    if (readOnly) return;
    StorageService.setPlayerRequirementComplete(
      playerId,
      requirementId,
      complete,
    );
    onRefreshData();
  };

  const markAllCompleteForPlayer = (playerId: string, reqs: ComplianceRequirement[]) => {
    if (readOnly || reqs.length === 0) return;
    for (const req of reqs) {
      StorageService.setPlayerRequirementComplete(playerId, req.id, true);
    }
    onRefreshData();
  };

  const markColumnCompleteForPlayers = (
    requirementId: string,
    playerIds: string[],
  ) => {
    if (readOnly || playerIds.length === 0) return;
    const req = sortedRequirements.find((r) => r.id === requirementId);
    const label = req?.name ?? 'this item';
    const flag = req ? isFlagRequirement(req) : false;
    if (
      !confirm(
        flag
          ? `Clear "${label}" flags for ${playerIds.length} visible player${
              playerIds.length === 1 ? '' : 's'
            }?`
          : `Mark "${label}" complete for ${playerIds.length} visible player${
              playerIds.length === 1 ? '' : 's'
            }?`,
      )
    ) {
      return;
    }
    for (const playerId of playerIds) {
      StorageService.setPlayerRequirementComplete(playerId, requirementId, true);
    }
    onRefreshData();
  };

  const triageRows = useMemo(() => {
    return sortedPlayers
      .map((player) => {
        const missing =
          incompleteScope === 'blocking'
            ? missingBlockingRequirements(
                player.id,
                requirements,
                playerCompliance,
              )
            : missingRequirements(player.id, requirements, playerCompliance);
        return { player, missing };
      })
      .filter((row) => row.missing.length > 0);
  }, [sortedPlayers, requirements, playerCompliance, incompleteScope]);

  const boardPlayers = useMemo(() => {
    if (!incompleteRowsOnly) return sortedPlayers;
    return sortedPlayers.filter((p) => {
      const missing =
        incompleteScope === 'blocking'
          ? missingBlockingRequirements(p.id, requirements, playerCompliance)
          : missingRequirements(p.id, requirements, playerCompliance);
      return missing.length > 0;
    });
  }, [
    sortedPlayers,
    requirements,
    playerCompliance,
    incompleteScope,
    incompleteRowsOnly,
  ]);

  if (requirements.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center space-y-2">
        <ClipboardList className="w-8 h-8 text-amber-400 mx-auto" />
        <p className="text-slate-100 font-semibold">No compliance requirements</p>
        <p className="text-sm text-slate-400">
          Add paperwork, fees, eligibility, or disciplinary items under Config →
          Compliance Requirements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          className="inline-flex rounded-xl border border-slate-800 bg-slate-950/80 p-1"
          role="group"
          aria-label="Compliance mode"
        >
          <button
            type="button"
            onClick={() => setMode('triage')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'triage'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            Out of compliance
            {triageRows.length > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  mode === 'triage'
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {triageRows.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMode('board')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'board'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Board
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && <SaveAndSyncButton compact />}
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <span className="sr-only">Sort players</span>
            <select
              value={playerSort}
              onChange={(e) =>
                setPlayerSort(e.target.value as PlayerSortMode)
              }
              className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5 text-xs font-semibold text-slate-200"
              aria-label="Sort players"
            >
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="jersey">Jersey #</option>
            </select>
          </label>
          <div
            className="inline-flex rounded-xl border border-slate-800 bg-slate-950/80 p-1"
            role="group"
            aria-label="Incomplete scope"
          >
            <button
              type="button"
              onClick={() => setIncompleteScope('blocking')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                incompleteScope === 'blocking'
                  ? 'bg-rose-500/90 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Blocking only
            </button>
            <button
              type="button"
              onClick={() => setIncompleteScope('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                incompleteScope === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All incomplete
            </button>
          </div>
          {mode === 'board' && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-950/50">
              <input
                type="checkbox"
                checked={incompleteRowsOnly}
                onChange={(e) => setIncompleteRowsOnly(e.target.checked)}
                className="rounded border-slate-600"
              />
              Incomplete rows only
            </label>
          )}
        </div>
      </div>

      {readOnly && (
        <p className="text-xs text-slate-500">
          View only — you do not have roster write access to change compliance.
        </p>
      )}

      {mode === 'triage' ? (
        triageRows.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-slate-100 font-semibold">
              Everyone is in compliance
            </p>
            <p className="text-sm text-slate-400">
              {incompleteScope === 'blocking'
                ? 'No players are missing blocking requirements.'
                : 'No players have incomplete requirements.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {triageRows.map(({ player, missing }) => {
              const badges = playerConsequenceBadges(
                player.id,
                requirements,
                playerCompliance,
              );
              return (
              <li
                key={player.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-white">
                      {player.name}{' '}
                      <span className="text-slate-400 font-semibold text-sm">
                        #{player.jerseyNumber} · {player.position}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {badges.map((key) => (
                        <span
                          key={key}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${CONSEQUENCE_BADGE_CLASS[key]}`}
                        >
                          {CONSEQUENCE_LABEL[key]}
                        </span>
                      ))}
                      {badges.length === 0 && missing.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-200 text-[11px] font-bold border border-amber-500/30">
                          Incomplete (soft)
                        </span>
                      )}
                    </div>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() =>
                        markAllCompleteForPlayer(player.id, missing)
                      }
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950"
                    >
                      {missing.every((r) => isFlagRequirement(r))
                        ? 'Clear all flags'
                        : 'Mark all complete'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {missing.map((req) => (
                    <button
                      key={req.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() => setComplete(player.id, req.id, true)}
                      title={
                        readOnly
                          ? req.name
                          : isFlagRequirement(req)
                            ? `Clear ${req.name} flag`
                            : `Mark ${req.name} complete`
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        consequenceKeysForRequirement(req)[0]
                          ? CONSEQUENCE_BADGE_CLASS[
                              consequenceKeysForRequirement(req)[0]
                            ]
                          : 'border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {req.name}
                      {consequenceLabelsForRequirement(req).map((label) => (
                        <span
                          key={label}
                          className="text-[10px] uppercase opacity-80"
                        >
                          {label}
                        </span>
                      ))}
                      {!readOnly && (
                        <span className="text-emerald-300">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </li>
              );
            })}
          </ul>
        )
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-semibold text-slate-100">
              Compliance board
            </p>
            <p className="text-xs text-slate-500">
              Paperwork and fees: checked = complete. Grade check / eligibility
              and red-card: checked = flag (out of compliance). Column labels
              show No play, Ineligible, No practice, or No equipment.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 z-10 bg-slate-950/95 px-2 py-1.5 font-semibold whitespace-nowrap">
                    Player
                  </th>
                  {sortedRequirements.map((req) => (
                    <th
                      key={req.id}
                      className="px-1 py-1.5 font-semibold align-bottom max-w-[4.5rem] whitespace-normal leading-tight"
                    >
                      <div className="flex flex-col gap-0.5 items-center text-center">
                        <span className="line-clamp-2">
                          {req.name}
                          {consequenceLabelsForRequirement(req).length > 0 && (
                            <span className="block font-normal normal-case tracking-normal text-[9px] text-rose-300/90">
                              {consequenceLabelsForRequirement(req).join(' · ')}
                            </span>
                          )}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() =>
                              markColumnCompleteForPlayers(
                                req.id,
                                boardPlayers.map((p) => p.id),
                              )
                            }
                            className="normal-case tracking-normal text-[10px] font-semibold text-emerald-400 hover:text-emerald-300"
                          >
                            {isFlagRequirement(req) ? 'Clear flags' : 'Mark ✓'}
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {boardPlayers.map((player) => {
                  const badges = playerConsequenceBadges(
                    player.id,
                    requirements,
                    playerCompliance,
                  );
                  return (
                    <tr
                      key={player.id}
                      className="border-b border-slate-800/80 hover:bg-slate-800/40"
                    >
                      <td className="sticky left-0 z-10 bg-slate-900/95 px-2 py-1 whitespace-nowrap">
                        <div className="font-semibold text-slate-100">
                          {player.name}{' '}
                          <span className="text-slate-400 font-medium">
                            #{player.jerseyNumber}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {player.position}
                          {badges.map((key) => (
                            <span
                              key={key}
                              className={`ml-1.5 ${
                                key === 'noPractice'
                                  ? 'text-amber-300'
                                  : key === 'noEquipment'
                                    ? 'text-sky-300'
                                    : 'text-rose-300'
                              }`}
                            >
                              {CONSEQUENCE_LABEL[key].toLowerCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      {sortedRequirements.map((req) => {
                        const complete = isRequirementComplete(
                          playerCompliance,
                          player.id,
                          req,
                        );
                        return (
                          <td key={req.id} className="px-1 py-1 text-center w-8">
                            <input
                              type="checkbox"
                              checked={isRequirementChecked(req, complete)}
                              disabled={readOnly}
                              onChange={(e) =>
                                setComplete(
                                  player.id,
                                  req.id,
                                  completeFromChecked(req, e.target.checked),
                                )
                              }
                              className="rounded border-slate-600 h-3.5 w-3.5"
                              aria-label={`${player.name}: ${req.name}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {boardPlayers.length === 0 && (
                  <tr>
                    <td
                      colSpan={sortedRequirements.length + 1}
                      className="px-4 py-8 text-center text-slate-400 text-sm"
                    >
                      No incomplete rows for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
