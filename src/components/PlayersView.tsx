import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  ChevronRight, 
  Shield, 
  Award, 
  X, 
  UserPlus, 
  Check 
} from 'lucide-react';
import { Player, PlayerPosition, LabelDefinition, MetricDefinition } from '../types';
import { StorageService } from '../services/storage';
import { calculatePlayerRankings } from '../utils/scoring';

interface PlayersViewProps {
  players: Player[];
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
  onSelectPlayer: (player: Player) => void;
  onRefreshData: () => void;
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
}

export const PlayersView: React.FC<PlayersViewProps> = ({
  players,
  labels,
  metrics,
  onSelectPlayer,
  onRefreshData,
  isAddModalOpen,
  onCloseAddModal
}) => {
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
        avatarUrl: formAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256',
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
        avatarUrl: formAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256',
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
    if (confirm('Are you sure you want to delete this player from the squad roster?')) {
      StorageService.deletePlayer(id);
      onRefreshData();
    }
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
  const rankings = calculatePlayerRankings(players, entries, metrics, labels, formula);
  const rankingMap = new Map(rankings.map(r => [r.player.id, r]));

  return (
    <div className="space-y-6 pb-28">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <Users className="w-4 h-4" />
              <span>Squad Roster</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Registered Players ({players.length})
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Manage your squad players, track positions, preferred feet, and individual season score sheets.
            </p>
          </div>

          <button
            onClick={() => {
              setEditingPlayer(null);
              setFormName('');
              setFormJersey(Math.max(1, players.length + 1));
              setFormNotes('');
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm transition-all active:scale-95 shrink-0 shadow-lg shadow-emerald-500/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Player</span>
          </button>
        </div>
      </div>

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
          const totalScore = rInfo?.totalScore ?? 70;

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
                      src={player.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256'}
                      alt={player.name}
                      className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-800 group-hover:ring-blue-500/50 transition-all"
                    />
                    <div>
                      <h3 className="font-extrabold text-white text-base group-hover:text-blue-400 transition-colors">
                        {player.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[11px] font-extrabold border border-blue-500/30">
                          #{player.jerseyNumber} • {player.position}
                        </span>
                        <span className="text-slate-400 text-xs font-medium">
                          {player.preferredFoot} Foot
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Score</span>
                    <span className={`text-xl font-black ${
                      totalScore >= 85 ? 'text-emerald-400' : totalScore >= 70 ? 'text-blue-400' : 'text-amber-400'
                    }`}>
                      {totalScore}
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
                  Att Rate: <strong className="text-emerald-400 font-bold">{rInfo?.attendanceRate ?? 100}%</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleStartEdit(player, e)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all active:scale-95"
                    title="Edit player profile"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDeletePlayer(player.id, e)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all active:scale-95"
                    title="Delete player"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
                  placeholder="https://images.unsplash.com/..."
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
