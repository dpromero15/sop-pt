import React, { useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  Shield,
  Trash2,
  Users,
  Building2,
} from 'lucide-react';
import { useAccess } from '../access/AccessProvider';
import {
  createTeam,
  listMembers,
  listTeams,
  removeMember,
  upsertMember,
} from '../services/adminApi';
import type { Team, TeamMembership, TeamMembershipRole } from '../types';
import { AdminToolsView } from './AdminToolsView';
import { DataMigrationPanel } from './DataMigrationPanel';
import { getApiBaseUrl } from '../services/storage/connectionStatus';

interface AdminPageViewProps {
  onRefreshData: () => void;
}

export const AdminPageView: React.FC<AdminPageViewProps> = ({
  onRefreshData,
}) => {
  const { can, access, refreshSession, setActiveTeamId, localOpenMode } =
    useAccess();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMembership[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] =
    useState<TeamMembershipRole>('dataEntry');
  const [inviteCoachName, setInviteCoachName] = useState('');

  const apiReady = Boolean(getApiBaseUrl()) && !localOpenMode;

  const loadTeams = async () => {
    if (!apiReady) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await listTeams();
      setTeams(res.teams as Team[]);
      if (!selectedId && res.teams[0]) {
        setSelectedId((res.teams[0] as Team).id);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setBusy(false);
    }
  };

  const loadMembers = async (teamId: string) => {
    if (!apiReady) return;
    try {
      const res = await listMembers(teamId);
      setMembers(res.members);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load members');
      setMembers([]);
    }
  };

  useEffect(() => {
    void loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady]);

  useEffect(() => {
    if (selectedId) void loadMembers(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!can('adminPage')) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
        Team Admin or System Admin access required.
      </div>
    );
  }

  if (localOpenMode || !apiReady) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 text-sm text-amber-100/90">
          Cloud Admin (teams / members) needs Firebase +{' '}
          <code className="text-amber-200">VITE_API_BASE_URL</code>. Local-only
          mode still exposes System Admin cloud tools below when configured.
        </div>
        {can('cloudSync') && <AdminToolsView onRefreshData={onRefreshData} />}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sky-300">
          <Building2 className="w-4 h-4" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Teams
          </h2>
        </div>

        {can('manageAllTeams') && (
          <div className="flex flex-wrap gap-2">
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="New team name"
              className="flex-1 min-w-[12rem] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || !newTeamName.trim()}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const team = await createTeam({
                      name: newTeamName.trim(),
                      shortName: newTeamName.trim().slice(0, 4).toUpperCase(),
                      season: String(new Date().getFullYear()),
                      ageGroup: '',
                      clubName: '',
                      homeVenue: '',
                      primaryColor: '#10b981',
                      secondaryColor: '#0f172a',
                      timezone: 'America/Denver',
                    });
                    setNewTeamName('');
                    setSelectedId(team.id);
                    setActiveTeamId(team.id);
                    await loadTeams();
                    await refreshSession();
                    setMessage(`Created ${team.name}`);
                  } catch (err) {
                    setMessage(
                      err instanceof Error ? err.message : 'Create failed',
                    );
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold px-3 py-2 text-sm disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              Create team
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSelectedId(t.id);
                setActiveTeamId(t.id);
              }}
              className={`rounded-xl border px-3 py-1.5 text-sm ${
                selectedId === t.id
                  ? 'border-sky-500/50 bg-sky-500/10 text-sky-200'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {t.name}
            </button>
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-slate-500">No teams yet.</p>
          )}
        </div>
      </section>

      {selectedId && can('manageTeamMembers') && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center gap-2 text-violet-300">
            <Users className="w-4 h-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Members · {teams.find((t) => t.id === selectedId)?.name}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Google email"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as TeamMembershipRole)
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="dataEntry">Data Entry</option>
              <option value="teamAdmin">Team Admin</option>
            </select>
            <input
              value={inviteCoachName}
              onChange={(e) => setInviteCoachName(e.target.value)}
              placeholder="Coach display name (optional)"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || !inviteEmail.trim()}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    await upsertMember(selectedId, {
                      email: inviteEmail.trim(),
                      role: inviteRole,
                      coachDisplayName: inviteCoachName.trim() || undefined,
                    });
                    setInviteEmail('');
                    setInviteCoachName('');
                    await loadMembers(selectedId);
                    await refreshSession();
                    setMessage('Member saved');
                  } catch (err) {
                    setMessage(
                      err instanceof Error ? err.message : 'Invite failed',
                    );
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold px-3 py-2 text-sm disabled:opacity-40"
            >
              Save member
            </button>
          </div>

          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.email}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-100">{m.email}</span>
                  <span className="ml-2 text-xs text-slate-500">{m.role}</span>
                  {m.coachDisplayName && (
                    <span className="ml-2 text-xs text-sky-300">
                      coach: {m.coachDisplayName}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      await removeMember(selectedId, m.email);
                      await loadMembers(selectedId);
                      await refreshSession();
                    })();
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300"
                  aria-label={`Remove ${m.email}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {can('cloudSync') && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-300 px-1">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              System cloud tools
            </span>
          </div>
          <AdminToolsView onRefreshData={onRefreshData} />
        </section>
      )}

      <DataMigrationPanel onComplete={onRefreshData} />

      {(busy || message) && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {message}
          {access.role === 'systemAdmin' ? ' · System Admin' : ''}
        </p>
      )}
    </div>
  );
};
