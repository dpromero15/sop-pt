import React, { useState } from 'react';
import { ChevronRight, Loader2, Plus, Shield, Users } from 'lucide-react';
import type { Team, TeamMembership } from '../types';
import { claimLocalSquad, useAccess } from '../access/AccessProvider';
import { roleLabel } from '../utils/roles';
import { StorageService } from '../services/storage';
import { getApiBaseUrl } from '../services/storage/connectionStatus';
import { createTeam } from '../services/adminApi';

interface TeamPickerPageProps {
  onEnterAdmin?: () => void;
}

export const TeamPickerPage: React.FC<TeamPickerPageProps> = ({
  onEnterAdmin,
}) => {
  const {
    auth,
    teams,
    access,
    enterWorkspace,
    signOut,
    refreshSession,
    setActiveTeamId,
  } = useAccess();

  const isSystemAdmin = access.systemRole === 'systemAdmin';
  const localOnly = !getApiBaseUrl();
  const [showCreate, setShowCreate] = useState(teams.length === 0);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAdmin = () => {
    const fallbackId = teams[0] ? (teams[0].team as Team).id : null;
    enterWorkspace(fallbackId);
    onEnterAdmin?.();
  };

  const addNewTeam = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (localOnly) {
        const current = StorageService.getTeam();
        const next: Team = {
          ...current,
          id: `team_${Date.now()}`,
          name,
          shortName: name.slice(0, 4).toUpperCase(),
          updatedAt: new Date().toISOString(),
        };
        StorageService.saveTeam(next);
        claimLocalSquad();
        await refreshSession();
        enterWorkspace(next.id);
        return;
      }

      if (!isSystemAdmin) {
        setError(
          'Cloud team create requires System Admin until invites are available.',
        );
        return;
      }

      const team = await createTeam({
        name,
        shortName: name.slice(0, 4).toUpperCase(),
        season: String(new Date().getFullYear()),
        ageGroup: '',
        clubName: '',
        homeVenue: '',
        primaryColor: '#10b981',
        secondaryColor: '#0f172a',
        timezone: 'America/Denver',
      });
      setActiveTeamId(team.id);
      await refreshSession();
      enterWorkspace(team.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create team');
    } finally {
      setBusy(false);
    }
  };

  const canAddTeam = localOnly || isSystemAdmin;

  const createForm = (
    <div className="space-y-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Add new team
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void addNewTeam();
            }
          }}
          placeholder="Team name"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm"
          autoFocus
          disabled={busy}
        />
        <button
          type="button"
          disabled={busy || !newName.trim()}
          onClick={() => void addNewTeam()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 text-sm disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {busy ? 'Creating…' : 'Create & enter'}
        </button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {localOnly && (
        <p className="text-[11px] text-slate-500 leading-snug">
          Stored in this browser until the cloud API is connected. Changes stay
          tied to your signed-in Google account.
        </p>
      )}
      {!localOnly && (
        <p className="text-[11px] text-slate-500 leading-snug">
          Creates the team via the cloud API. If this hangs, the API may be
          unreachable — check <code className="text-slate-400">VITE_API_BASE_URL</code>.
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(16,185,129,0.18), transparent), linear-gradient(180deg, #020617, #04150f 90%)',
        }}
      />

      <div className="relative z-10 max-w-lg mx-auto px-6 py-12 sm:py-16 space-y-10">
        <header className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400/90">
                Systems of Play
              </p>
              <h1 className="font-display text-3xl font-bold text-white mt-1 tracking-tight">
                Choose your team
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs text-slate-500 hover:text-slate-300 underline-offset-2 hover:underline"
            >
              Sign out
            </button>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
            {auth.photoURL ? (
              <img
                src={auth.photoURL}
                alt=""
                className="w-10 h-10 rounded-full border border-slate-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-300">
                {(auth.displayName || auth.email || '?')
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {auth.displayName || 'Signed in'}
              </p>
              <p className="text-xs text-slate-500 truncate">{auth.email}</p>
            </div>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Select the squad you want to work with in{' '}
            <span className="text-slate-200">SOP-PT</span>. You can switch teams
            anytime from your profile menu.
          </p>
        </header>

        <div className="space-y-3">
          {teams.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-5">
              <div className="text-center space-y-3">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400 leading-relaxed">
                  No teams yet.
                  {canAddTeam
                    ? ' Enter a name below to create one'
                    : ' Ask a System Admin for an invite'}
                  {isSystemAdmin ? ', or continue as admin.' : '.'}
                </p>
              </div>

              {canAddTeam && createForm}

              {!canAddTeam && (
                <p className="text-xs text-slate-500 text-center">
                  Ask a System Admin to invite this email, then refresh.
                </p>
              )}

              <div className="flex flex-col gap-3 pt-1">
                {isSystemAdmin && (
                  <button
                    type="button"
                    onClick={openAdmin}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-100 font-semibold px-4 py-3 text-sm hover:bg-emerald-500/20"
                  >
                    <Shield className="w-4 h-4" />
                    Continue as admin
                  </button>
                )}

                <button
                  type="button"
                  disabled={refreshBusy}
                  onClick={() => {
                    void (async () => {
                      setRefreshBusy(true);
                      setError(null);
                      try {
                        await refreshSession();
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : 'Could not refresh teams',
                        );
                      } finally {
                        setRefreshBusy(false);
                      }
                    })();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 mx-auto text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50"
                >
                  {refreshBusy ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : null}
                  Refresh teams
                </button>
              </div>
            </div>
          ) : (
            teams.map((row) => {
              const team = row.team as Team;
              const membership = row.membership as TeamMembership;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => enterWorkspace(team.id)}
                  className="w-full text-left group rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-emerald-500/40 hover:bg-slate-900 px-4 py-4 transition-colors flex items-center gap-4"
                >
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate group-hover:text-emerald-100">
                      {team.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {[team.ageGroup, team.season && `Season ${team.season}`]
                        .filter(Boolean)
                        .join(' · ') || 'Squad'}
                      {' · '}
                      {roleLabel(membership.role)}
                      {localOnly ? ' · local' : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 shrink-0" />
                </button>
              );
            })
          )}
        </div>

        {teams.length > 0 && canAddTeam && showCreate && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            {createForm}
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        )}

        {teams.length > 0 && canAddTeam && !showCreate && (
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setError(null);
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 text-slate-200 font-semibold px-4 py-3 text-sm hover:border-emerald-500/40 hover:text-emerald-100"
          >
            <Plus className="w-4 h-4" />
            Add new team
          </button>
        )}

        {isSystemAdmin && teams.length > 0 && (
          <button
            type="button"
            onClick={openAdmin}
            className="w-full text-xs text-slate-500 hover:text-emerald-400 py-2"
          >
            Open administration
          </button>
        )}
      </div>
    </div>
  );
};
