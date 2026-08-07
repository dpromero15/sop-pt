import React from 'react';
import {
  Trophy,
  Zap,
  Users,
  Calendar,
  Sliders,
  Shield,
  Plus,
} from 'lucide-react';
import type { Team } from '../types';

export type TabRoute = 'rankings' | 'quick-insert' | 'players' | 'sessions' | 'config';

interface NavigationProps {
  currentTab: TabRoute;
  onSelectTab: (tab: TabRoute) => void;
  onOpenQuickAddPlayer: () => void;
  onOpenQuickSession: () => void;
  playerCount: number;
  sessionCount: number;
  team: Team;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  onOpenQuickAddPlayer,
  onOpenQuickSession,
  playerCount,
  sessionCount,
  team,
}) => {
  const tabs = [
    {
      id: 'rankings' as TabRoute,
      label: 'Rankings',
      icon: Trophy,
      badge: null as string | number | null,
      color: 'text-amber-500',
    },
    {
      id: 'quick-insert' as TabRoute,
      label: 'Quick Insert',
      icon: Zap,
      badge: 'LIVE' as string | number | null,
      color: 'text-emerald-500',
    },
    {
      id: 'players' as TabRoute,
      label: 'Players',
      icon: Users,
      badge: playerCount as string | number | null,
      color: 'text-blue-500',
    },
    {
      id: 'sessions' as TabRoute,
      label: 'Sessions',
      icon: Calendar,
      badge: sessionCount as string | number | null,
      color: 'text-purple-500',
    },
    {
      id: 'config' as TabRoute,
      label: 'Formula',
      icon: Sliders,
      badge: null as string | number | null,
      color: 'text-rose-500',
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 text-white px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-white leading-none">
                  {team.name}
                </h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {team.ageGroup} Squad
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Season {team.season} • Performance Tracker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenQuickSession}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>New Session</span>
            </button>
            <button
              onClick={onOpenQuickAddPlayer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Player</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-lg bg-slate-900/95 backdrop-blur-xl border border-slate-800/90 shadow-2xl rounded-2xl p-1.5">
        <div className="grid grid-cols-5 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'bg-slate-800/90 text-white shadow-inner font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {isActive && (
                  <div className="absolute -top-1 w-8 h-1 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                )}
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? tab.color : 'text-slate-400'}`} />
                  {tab.badge !== null && (
                    <span
                      className={`absolute -top-1.5 -right-2 px-1 py-0.2 text-[9px] font-bold rounded-full border ${
                        typeof tab.badge === 'string'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-700 text-slate-300 border-slate-600'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 tracking-tight truncate max-w-full ${
                    isActive ? 'text-white font-medium' : 'text-slate-400 font-normal'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
