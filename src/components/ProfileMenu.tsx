import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';
import type { Team } from '../types';
import { useAccess } from '../access/AccessProvider';

interface ProfileMenuProps {
  onOpenSettings?: () => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({ onOpenSettings }) => {
  const {
    auth,
    teams,
    activeTeamId,
    roleLabel,
    enterWorkspace,
    clearWorkspace,
    signOut,
  } = useAccess();
  const [open, setOpen] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowTeams(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setShowTeams(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeTeam = teams.find(
    (row) => (row.team as Team).id === activeTeamId,
  )?.team as Team | undefined;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 pl-1.5 pr-2 py-1.5 transition-colors"
      >
        {auth.photoURL ? (
          <img
            src={auth.photoURL}
            alt=""
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-200">
            {(auth.displayName || auth.email || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-white truncate">
              {auth.displayName || 'Account'}
            </p>
            <p className="text-xs text-slate-500 truncate">{auth.email}</p>
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/90 mt-1.5 font-semibold">
              {roleLabel}
              {activeTeam ? ` · ${activeTeam.name}` : ''}
            </p>
          </div>

          {!showTeams ? (
            <div className="p-1.5 space-y-0.5">
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
                onClick={() => setShowTeams(true)}
              >
                <Users className="w-4 h-4 text-emerald-400" />
                Switch team
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings?.();
                }}
              >
                <Settings className="w-4 h-4 text-slate-400" />
                Settings
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-rose-300 hover:bg-slate-800"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          ) : (
            <div className="p-1.5 max-h-64 overflow-y-auto">
              <button
                type="button"
                className="w-full text-left text-[11px] text-slate-500 px-3 py-1.5 hover:text-slate-300"
                onClick={() => setShowTeams(false)}
              >
                ← Back
              </button>
              {teams.map((row) => {
                const team = row.team as Team;
                const selected = team.id === activeTeamId;
                return (
                  <button
                    key={team.id}
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      enterWorkspace(team.id);
                      setOpen(false);
                      setShowTeams(false);
                    }}
                  >
                    <span className="flex-1 text-left truncate">{team.name}</span>
                    {selected && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                );
              })}
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-slate-400 hover:bg-slate-800 mt-1 border-t border-slate-800"
                onClick={() => {
                  clearWorkspace();
                  setOpen(false);
                  setShowTeams(false);
                }}
              >
                Choose team from full list…
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
