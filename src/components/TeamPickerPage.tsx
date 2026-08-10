import React from 'react';
import { ChevronRight, Shield, Users } from 'lucide-react';
import type { Team, TeamMembership } from '../types';
import { useAccess } from '../access/AccessProvider';
import { roleLabel } from '../utils/roles';

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
  } = useAccess();

  const isSystemAdmin = access.systemRole === 'systemAdmin';

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
                {(auth.displayName || auth.email || '?').slice(0, 1).toUpperCase()}
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4 text-center">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400 leading-relaxed">
                {isSystemAdmin
                  ? 'No teams yet. Open administration to create a team and invite members.'
                  : 'No team memberships for this account. Ask a System Admin to invite you.'}
              </p>
              {isSystemAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    enterWorkspace(null);
                    onEnterAdmin?.();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 text-sm"
                >
                  <Shield className="w-4 h-4" />
                  Open administration
                </button>
              )}
              <button
                type="button"
                onClick={() => void refreshSession()}
                className="block mx-auto text-xs text-slate-500 hover:text-slate-300"
              >
                Refresh teams
              </button>
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
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 shrink-0" />
                </button>
              );
            })
          )}
        </div>

        {isSystemAdmin && teams.length > 0 && (
          <button
            type="button"
            onClick={() => {
              enterWorkspace(null);
              onEnterAdmin?.();
            }}
            className="w-full text-xs text-slate-500 hover:text-emerald-400 py-2"
          >
            Or open administration without a team
          </button>
        )}
      </div>
    </div>
  );
};
