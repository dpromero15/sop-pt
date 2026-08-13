import React, { useEffect, useRef, useState } from 'react';
import { 
  Users, 
  Search, 
  Edit3, 
  Trash2, 
  ChevronRight, 
  X, 
  UserPlus, 
  Download,
  Upload,
  Award,
  ClipboardList,
  RotateCcw,
} from 'lucide-react';
import {
  Player,
  PlayerPosition,
  LabelDefinition,
  MetricDefinition,
  Coach,
  CoachBallot,
  ComplianceRequirement,
  PlayerComplianceState,
} from '../types';
import { StorageService } from '../services/storage';
import { calculatePlayerRankings } from '../utils/scoring';
import {
  applyEligibilityToAdjustedRanks,
  completeFromChecked,
  eligiblePlayerIdSet,
  isRequirementChecked,
  missingBlockingRequirements,
} from '../utils/eligibility';
import {
  CONSEQUENCE_BADGE_CLASS,
  CONSEQUENCE_LABEL,
  consequenceLabelsForRequirement,
  playerConsequenceBadges,
  polarityHint,
} from '../utils/complianceConsequences';
import {
  buildPlayerCsvTemplate,
  downloadCsv,
  parseAndValidatePlayerCsv,
} from '../utils/playerCsv';
import { CoachesRatingView } from './CoachesRatingView';
import { ComplianceBoardView } from './ComplianceBoardView';
import { defaultAvatarFor } from '../constants/avatars';
import { flushNow } from '../services/storage/cloudSync';

type PlayersPane = 'roster' | 'coaches' | 'compliance';

interface PlayersViewProps {
  players: Player[];
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
  coaches: Coach[];
  coachBallots: CoachBallot[];
  complianceRequirements: ComplianceRequirement[];
  playerCompliance: PlayerComplianceState;
  onSelectPlayer: (player: Player) => void;
  onRefreshData: () => void;
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  readOnlyRoster?: boolean;
  allowCoachesRating?: boolean;
  allowProfileNotes?: boolean;
}

export const PlayersView: React.FC<PlayersViewProps> = ({
  players,
  labels,
  metrics,
  coaches,
  coachBallots,
  complianceRequirements,
  playerCompliance,
  onSelectPlayer,
  onRefreshData,
  isAddModalOpen,
  onCloseAddModal,
  readOnlyRoster = false,
  allowCoachesRating = true,
  allowProfileNotes = true,
}) => {
  const [pane, setPane] = useState<PlayersPane>('roster');
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formJersey, setFormJersey] = useState<number>(10);
  const [formPosition, setFormPosition] = useState<PlayerPosition>('CM');
  const [formFoot, setFormFoot] = useState<'Left' | 'Right' | 'Both'>('Right');
  const [formAge, setFormAge] = useState<number>(15);
  const [formAvatar, setFormAvatar] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!allowCoachesRating && pane === 'coaches') setPane('roster');
  }, [allowCoachesRating, pane]);

  const paneTitle =
    pane === 'roster'
      ? `Registered Players (${players.length})`
      : pane === 'coaches'
        ? 'Coaches Rating'
        : 'Compliance';

  const paneSubtitle =
    pane === 'roster'
      ? 'Manage your squad roster, positions, and individual score sheets.'
      : pane === 'coaches'
        ? 'Add coaches and submit ordinal ballots — complete ballots feed Rankings → Coaches Rank.'
        : 'See who is out of compliance and update paperwork for the whole squad.';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Handle open edit
  const handleStartEdit = (player: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlayer(player);
    setFormName(player.name);
    setFormJersey(player.jerseyNumber);
    setFormPosition(player.position);
    setFormFoot(player.preferredFoot);
    setFormAge(player.age || 15);
    setFormAvatar(player.avatarUrl || '');
    setFormNotes(player.notes || '');
  };

  const handleSavePlayerForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingPlayer) {
      StorageService.updatePlayer({
        ...editingPlayer,
        name: formName,
        jerseyNumber: formJersey,
        position: formPosition,
        preferredFoot: formFoot,
        age: formAge,
        avatarUrl: formAvatar || defaultAvatarFor(formJersey || formName || Date.now()),
        notes: formNotes
      });
      setEditingPlayer(null);
    } else {
      StorageService.addPlayer({
        name: formName,
        jerseyNumber: formJersey,
        position: formPosition,
        preferredFoot: formFoot,
        age: formAge,
        avatarUrl: formAvatar || defaultAvatarFor(formJersey || formName || Date.now()),
        status: 'active',
        notes: formNotes
      });
      onCloseAddModal();
    }

    // Reset Form
    setFormName('');
    setFormNotes('');
    onRefreshData();
  };

  const handleDeletePlayer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      confirm(
        'Move this player to trash? You can restore them from Recently deleted. Players still in trash after 90 days are permanently removed.',
      )
    ) {
      StorageService.deletePlayer(id);
      onRefreshData();
    }
  };

  const handleExportCsvTemplate = () => {
    downloadCsv('player_roster_template.csv', buildPlayerCsvTemplate());
    showToast('✓ CSV template downloaded');
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const existing = new Set<number>(players.map((p) => p.jerseyNumber));
      const { ok, errors, skipped } = parseAndValidatePlayerCsv(text, existing);

      ok.forEach((row) => {
        StorageService.addPlayer(row);
        existing.add(row.jerseyNumber);
      });

      onRefreshData();

      const summary = [
        `Imported ${ok.length} player${ok.length === 1 ? '' : 's'}`,
        skipped > 0 ? `skipped ${skipped}` : null,
      ]
        .filter(Boolean)
        .join(', ');

      if (errors.length > 0) {
        alert(
          `${summary}.\n\n${errors.slice(0, 8).join('\n')}${
            errors.length > 8 ? `\n…and ${errors.length - 8} more` : ''
          }`,
        );
      }
      showToast(`✓ ${summary}`);
    };
    reader.readAsText(file);
  };

  const handleClearAllPlayers = () => {
    if (
      !confirm(
        'Permanently clear the entire squad roster? This cannot be undone (export a backup first if needed).',
      )
    ) {
      return;
    }
    if (
      !confirm(
        `Type confirm: delete all ${players.length} player${players.length === 1 ? '' : 's'} from this team?`,
      )
    ) {
      return;
    }
    StorageService.clearAllPlayers();
    onRefreshData();
    showToast('✓ Roster cleared');
    void flushNow();
  };

  // Filter logic
  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.jerseyNumber.toString() === searchQuery;

    if (positionFilter === 'GK') return matchesSearch && p.position === 'GK';
    if (positionFilter === 'DEF') return matchesSearch && ['CB', 'LB', 'RB'].includes(p.position);
    if (positionFilter === 'MID') return matchesSearch && ['CDM', 'CM', 'CAM'].includes(p.position);
    if (positionFilter === 'FWD') return matchesSearch && ['LW', 'RW', 'ST'].includes(p.position);

    return matchesSearch;
  });

  // Calculate scores lookup map
  const entries = StorageService.getEntries();
  const formula = StorageService.getFormula();
  const rankings = applyEligibilityToAdjustedRanks(
    calculatePlayerRankings(players, entries, metrics, labels, formula),
    eligiblePlayerIdSet(
      players.map((p) => p.id),
      complianceRequirements,
      playerCompliance,
    ),
  );
  const rankingMap = new Map(rankings.map(r => [r.player.id, r]));

  return (
    <div className="space-y-6 pb-28">
      {toastMsg && (
        <div className="fixed top-16 right-4 z-50 bg-emerald-500 text-slate-950 font-extrabold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-emerald-300 animate-bounce">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <Users className="w-4 h-4" />
              <span>Squad</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {paneTitle}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              {paneSubtitle}
            </p>
          </div>

          {pane === 'roster' && !readOnlyRoster && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportCsvTemplate}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all active:scale-95"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export template</span>
              </button>
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all active:scale-95"
              >
                <Upload className="w-4 h-4 text-blue-400" />
                <span>Import CSV</span>
              </button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportCsv}
              />
              <button
                type="button"
                onClick={handleClearAllPlayers}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 font-semibold text-xs border border-slate-700 transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear all</span>
              </button>
              <button
                onClick={() => {
                  setEditingPlayer(null);
                  setFormName('');
                  setFormJersey(Math.max(1, players.length + 1));
                  setFormNotes('');
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register New Player</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Roster / Compliance / Coaches Rating */}
      <div
        className="inline-flex rounded-xl border border-slate-800 bg-slate-950/80 p-1"
        role="group"
        aria-label="Players pane"
      >
        <button
          type="button"
          onClick={() => setPane('roster')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            pane === 'roster'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Roster
        </button>
        <button
          type="button"
          onClick={() => setPane('compliance')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            pane === 'compliance'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Compliance
          {complianceRequirements.length > 0 && (
            <span
              className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                pane === 'compliance'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {complianceRequirements.length}
            </span>
          )}
        </button>
        {allowCoachesRating && (
          <button
            type="button"
            onClick={() => setPane('coaches')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              pane === 'coaches'
                ? 'bg-violet-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Coaches Rating
            {coaches.length > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  pane === 'coaches'
                    ? 'bg-slate-950/20 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {coaches.length}
              </span>
            )}
          </button>
        )}
      </div>

      {pane === 'compliance' ? (
        <ComplianceBoardView
          players={players}
          requirements={complianceRequirements}
          playerCompliance={playerCompliance}
          onRefreshData={onRefreshData}
          readOnly={readOnlyRoster}
        />
      ) : pane === 'coaches' && allowCoachesRating ? (
        <CoachesRatingView
          coaches={coaches}
          ballots={coachBallots}
          players={players}
          rankings={rankings}
          labels={labels}
          onRefreshData={onRefreshData}
        />
      ) : (
      <>
      {/* Search & Position Tabs */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or jersey number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Positions' },
            { id: 'GK', label: 'Goalkeepers' },
            { id: 'DEF', label: 'Defenders' },
            { id: 'MID', label: 'Midfielders' },
            { id: 'FWD', label: 'Forwards' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setPositionFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                positionFilter === tab.id
                  ? 'bg-blue-500 text-white font-bold shadow-md shadow-blue-500/20'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlayers.map(player => {
          const rInfo = rankingMap.get(player.id);
          const missing = missingBlockingRequirements(
            player.id,
            complianceRequirements,
            playerCompliance,
          );
          const consequenceBadges = playerConsequenceBadges(
            player.id,
            complianceRequirements,
            playerCompliance,
          );

          return (
            <div
              key={player.id}
              onClick={() => onSelectPlayer(player)}
              className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-md group relative"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={player.avatarUrl || defaultAvatarFor(player.id || player.jerseyNumber)}
                      alt={player.name}
                      className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-800 group-hover:ring-blue-500/50 transition-all"
                    />
                    <div>
                      <h3 className="font-extrabold text-white text-base group-hover:text-blue-400 transition-colors">
                        {player.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[11px] font-extrabold border border-blue-500/30">
                          #{player.jerseyNumber} • {player.position}
                        </span>
                        <span className="text-slate-400 text-xs font-medium">
                          {player.preferredFoot} Foot
                        </span>
                        {consequenceBadges.map((key) => (
                          <span
                            key={key}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${CONSEQUENCE_BADGE_CLASS[key]}`}
                            title={missing.map((m) => m.name).join(', ')}
                          >
                            {CONSEQUENCE_LABEL[key]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Statistical Rank</span>
                    <span className={`text-xl font-black ${
                      rInfo?.overallRank == null
                        ? 'text-slate-500'
                        : 'text-emerald-400'
                    }`}>
                      {rInfo?.overallRank != null ? `#${rInfo.overallRank}` : 'Unscored'}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Adj {rInfo?.adjustedRank != null ? `#${rInfo.adjustedRank}` : '—'}
                    </span>
                  </div>
                </div>

                {player.notes && (
                  <p className="text-xs text-slate-400 italic mt-3 line-clamp-2 bg-slate-950/40 p-2 rounded-xl">
                    "{player.notes}"
                  </p>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Att Rate:{' '}
                  <strong className="text-emerald-400 font-bold">
                    {rInfo?.attendanceRate !== null &&
                    rInfo?.attendanceRate !== undefined
                      ? `${rInfo.attendanceRate}%`
                      : '—'}
                  </strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleStartEdit(player, e)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all active:scale-95"
                    title="Edit player profile"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {!readOnlyRoster && (
                  <button
                    onClick={(e) => handleDeletePlayer(player.id, e)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all active:scale-95"
                    title="Delete player"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  )}
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(() => {
        const deleted = StorageService.getDeletedPlayers();
        if (deleted.length === 0) return null;
        return (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Recently deleted
              </h3>
              <p className="text-xs text-slate-500">
                Restore within 90 days. After that, players are permanently
                removed.
              </p>
            </div>
            <ul className="space-y-2">
              {deleted.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100 truncate">
                      {player.name}{' '}
                      <span className="text-slate-400 font-medium">
                        #{player.jerseyNumber}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Deleted{' '}
                      {player.deletedAt
                        ? new Date(player.deletedAt).toLocaleDateString()
                        : '—'}
                    </div>
                  </div>
                  {!readOnlyRoster && (
                    <button
                      type="button"
                      onClick={() => {
                        StorageService.restorePlayer(player.id);
                        onRefreshData();
                      }}
                      className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold px-2.5 py-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
      </>
      )}

      {/* Modal Form for Add/Edit Player */}
      {(isAddModalOpen || editingPlayer) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>{editingPlayer ? 'Edit Player Info' : 'Register New Player'}</span>
              </h3>
              <button
                onClick={() => {
                  setEditingPlayer(null);
                  onCloseAddModal();
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlayerForm} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Full Player Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Leo Messi"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Jersey Number *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={99}
                    value={formJersey}
                    onChange={(e) => setFormJersey(parseInt(e.target.value) || 10)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Position *</label>
                  <select
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value as PlayerPosition)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'].map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Preferred Foot</label>
                  <select
                    value={formFoot}
                    onChange={(e) => setFormFoot(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Right">Right</option>
                    <option value="Left">Left</option>
                    <option value="Both">Both (Ambidextrous)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Age</label>
                  <input
                    type="number"
                    min={6}
                    max={50}
                    value={formAge}
                    onChange={(e) => setFormAge(parseInt(e.target.value) || 15)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Avatar Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="/avatars/cucurella-outline.svg or https://..."
                  value={formAvatar}
                  onChange={(e) => setFormAvatar(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Coach Notes / Strengths</label>
                <textarea
                  rows={2}
                  placeholder="Playmaker vision, high stamina, vocal leader..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {editingPlayer && complianceRequirements.length > 0 && (
                <div className="space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950/50">
                  <div className="text-slate-400 font-semibold">Compliance checklist</div>
                  {complianceRequirements.map((req) => {
                    const complete =
                      playerCompliance[editingPlayer.id]?.[req.id]?.complete ===
                      true;
                    return (
                      <label
                        key={req.id}
                        className="flex items-center justify-between gap-2 text-sm text-slate-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="min-w-0">
                          {req.name}
                          {consequenceLabelsForRequirement(req).map((label) => (
                            <span
                              key={label}
                              className="ml-1.5 text-[10px] uppercase text-rose-300"
                            >
                              {label}
                            </span>
                          ))}
                          <span className="block text-[10px] text-slate-500 font-normal">
                            {polarityHint(req)}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={isRequirementChecked(req, complete)}
                          onChange={(e) => {
                            StorageService.setPlayerRequirementComplete(
                              editingPlayer.id,
                              req.id,
                              completeFromChecked(req, e.target.checked),
                            );
                            onRefreshData();
                          }}
                          className="rounded border-slate-600"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlayer(null);
                    onCloseAddModal();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-extrabold hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                >
                  Save Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
