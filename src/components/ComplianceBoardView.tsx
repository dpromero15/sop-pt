import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, LayoutGrid, ListFilter } from 'lucide-react';
import type {
  ComplianceRequirement,
  Player,
  PlayerComplianceState,
} from '../types';
import { StorageService } from '../services/storage';
import {
  isEligibleToPlay,
  isEligibleToPractice,
  isRequirementComplete,
  missingBlockingRequirements,
  missingRequirements,
} from '../utils/eligibility';

type ComplianceMode = 'triage' | 'board';
type IncompleteScope = 'blocking' | 'all';

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

  const sortedRequirements = useMemo(
    () => [...requirements].sort((a, b) => a.sortOrder - b.sortOrder),
    [requirements],
  );

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber),
    [players],
  );

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
    if (
      !confirm(
        `Mark "${label}" complete for ${playerIds.length} visible player${
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
        const eligible = isEligibleToPlay(
          player.id,
          requirements,
          playerCompliance,
        );
        return { player, missing, eligible };
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
            {triageRows.map(({ player, missing, eligible }) => (
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
                      {!eligible ? (
                        <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[11px] font-bold border border-rose-500/30">
                          Ineligible
                        </span>
                      ) : null}
                      {!isEligibleToPractice(
                        player.id,
                        requirements,
                        playerCompliance,
                      ) ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                          No practice
                        </span>
                      ) : null}
                      {eligible &&
                        isEligibleToPractice(
                          player.id,
                          requirements,
                          playerCompliance,
                        ) && (
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
                      Mark all complete
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
                          : `Mark ${req.name} complete`
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        req.blocksPlay
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
                          : req.blocksPractice
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                            : 'border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {req.name}
                      {req.blocksPlay && (
                        <span className="text-[10px] uppercase opacity-80">
                          play
                        </span>
                      )}
                      {req.blocksPractice && (
                        <span className="text-[10px] uppercase opacity-80">
                          practice
                        </span>
                      )}
                      {!readOnly && (
                        <span className="text-emerald-300">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-semibold text-slate-100">
              Compliance board
            </p>
            <p className="text-xs text-slate-500">
              Toggle cells to update paperwork and fees for the whole squad.
              Column headers can mark an item complete for all visible rows.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="sticky left-0 z-10 bg-slate-950/95 px-3 py-2 font-semibold">
                    Player
                  </th>
                  {sortedRequirements.map((req) => (
                    <th
                      key={req.id}
                      className="px-2 py-2 font-semibold whitespace-nowrap align-bottom"
                    >
                      <div className="flex flex-col gap-1 items-start">
                        <span>
                          {req.name}
                          {req.blocksPlay && (
                            <span className="ml-1 font-normal text-rose-400/80">
                              · play
                            </span>
                          )}
                          {req.blocksPractice && (
                            <span className="ml-1 font-normal text-amber-400/80">
                              · practice
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
                            Mark column ✓
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {boardPlayers.map((player) => {
                  const eligible = isEligibleToPlay(
                    player.id,
                    requirements,
                    playerCompliance,
                  );
                  return (
                    <tr
                      key={player.id}
                      className="border-b border-slate-800/80 hover:bg-slate-800/40"
                    >
                      <td className="sticky left-0 z-10 bg-slate-900/95 px-3 py-2 whitespace-nowrap">
                        <div className="font-semibold text-slate-100">
                          #{player.jerseyNumber} {player.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {player.position}
                          {!eligible && (
                            <span className="ml-1.5 text-rose-300">
                              ineligible
                            </span>
                          )}
                          {!isEligibleToPractice(
                            player.id,
                            requirements,
                            playerCompliance,
                          ) && (
                            <span className="ml-1.5 text-amber-300">
                              no practice
                            </span>
                          )}
                        </div>
                      </td>
                      {sortedRequirements.map((req) => {
                        const complete = isRequirementComplete(
                          playerCompliance,
                          player.id,
                          req.id,
                        );
                        return (
                          <td key={req.id} className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={complete}
                              disabled={readOnly}
                              onChange={(e) =>
                                setComplete(
                                  player.id,
                                  req.id,
                                  e.target.checked,
                                )
                              }
                              className="rounded border-slate-600 h-4 w-4"
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
