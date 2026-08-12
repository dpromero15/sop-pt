import React, { useState, useEffect, useMemo } from 'react';
import { TabRoute, Navigation } from './components/Navigation';
import { RankingsView } from './components/RankingsView';
import { QuickInsertView } from './components/QuickInsertView';
import { PlayersView } from './components/PlayersView';
import { SessionsView } from './components/SessionsView';
import { ConfigView } from './components/ConfigView';
import { AdminPageView } from './components/AdminPageView';
import { AuthConfigMissing, LandingPage } from './components/LandingPage';
import { TeamPickerPage } from './components/TeamPickerPage';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { ScoringConfigModal } from './components/ScoringConfigModal';
import { StorageService, subscribeToStorage } from './services/storage';
import { calculatePlayerRankings } from './utils/scoring';
import { attachCoachesTotals } from './utils/coachesRating';
import { applyAdjustedBumps } from './utils/adjustedBumps';
import {
  applyEligibilityToAdjustedRanks,
  eligiblePlayerIdSet,
} from './utils/eligibility';
import { Player } from './types';
import { useAccess } from './access/AccessProvider';
import { ensureSignedInCoach } from './utils/coachIdentity';
import { isLocalDebugMockAuth } from './services/firebase';

const BUMP_COACH_STORAGE_KEY = 'stm_active_bump_coach_v1';

const ALL_TABS: TabRoute[] = [
  'rankings',
  'quick-insert',
  'players',
  'sessions',
  'config',
  'admin',
];

export default function App() {
  const {
    authConfigured,
    authReady,
    auth,
    can,
    access,
    workspaceReady,
    refreshSession,
    teams: accessTeams,
  } = useAccess();

  const [currentTab, setCurrentTab] = useState<TabRoute>(() => {
    const hash = window.location.hash.replace('#', '');
    if (ALL_TABS.includes(hash as TabRoute)) {
      return hash as TabRoute;
    }
    return 'rankings';
  });

  const [team, setTeam] = useState(() => StorageService.getTeam());
  const [players, setPlayers] = useState(() => StorageService.getPlayers());
  const [sessions, setSessions] = useState(() => StorageService.getSessions());
  const [entries, setEntries] = useState(() => StorageService.getEntries());
  const [metrics, setMetrics] = useState(() => StorageService.getMetrics());
  const [labels, setLabels] = useState(() => StorageService.getLabels());
  const [formula, setFormula] = useState(() => StorageService.getFormula());
  const [coaches, setCoaches] = useState(() => StorageService.getCoaches());
  const [coachBallots, setCoachBallots] = useState(() =>
    StorageService.getCoachBallots(),
  );
  const [adjustedBumps, setAdjustedBumps] = useState(() =>
    StorageService.getAdjustedBumps(),
  );
  const [bumpTransactions, setBumpTransactions] = useState(() =>
    StorageService.getBumpTransactions(),
  );
  const [bumpBudget, setBumpBudget] = useState(() =>
    StorageService.getBumpBudget(),
  );
  const [complianceRequirements, setComplianceRequirements] = useState(() =>
    StorageService.getComplianceRequirements(),
  );
  const [playerCompliance, setPlayerCompliance] = useState(() =>
    StorageService.getPlayerCompliance(),
  );
  const [equipmentGroups, setEquipmentGroups] = useState(() =>
    StorageService.getEquipmentGroups(),
  );
  const [equipmentItems, setEquipmentItems] = useState(() =>
    StorageService.getEquipmentItems(),
  );
  const [rankingBoundaries, setRankingBoundaries] = useState(() =>
    StorageService.getRankingBoundaries(),
  );
  const [bumpCoachId, setBumpCoachId] = useState(() => {
    try {
      return localStorage.getItem(BUMP_COACH_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loggerSessionId, setLoggerSessionId] = useState<string | null>(null);

  const refreshData = () => {
    setTeam(StorageService.getTeam());
    setPlayers(StorageService.getPlayers());
    setSessions(StorageService.getSessions());
    setEntries(StorageService.getEntries());
    setMetrics(StorageService.getMetrics());
    setLabels(StorageService.getLabels());
    setFormula(StorageService.getFormula());
    setCoaches(StorageService.getCoaches());
    setCoachBallots(StorageService.getCoachBallots());
    setAdjustedBumps(StorageService.getAdjustedBumps());
    setBumpTransactions(StorageService.getBumpTransactions());
    setBumpBudget(StorageService.getBumpBudget());
    setComplianceRequirements(StorageService.getComplianceRequirements());
    setPlayerCompliance(StorageService.getPlayerCompliance());
    setEquipmentGroups(StorageService.getEquipmentGroups());
    setEquipmentItems(StorageService.getEquipmentItems());
    setRankingBoundaries(StorageService.getRankingBoundaries());
  };

  useEffect(() => {
    const unsubscribe = subscribeToStorage(refreshData);
    return () => unsubscribe();
  }, []);

  // Local debug mock: if signed in but session never got System Admin / teams, retry once.
  useEffect(() => {
    if (!import.meta.env.DEV || !isLocalDebugMockAuth()) return;
    if (!auth.signedIn || workspaceReady) return;
    if (access.systemRole === 'systemAdmin' || accessTeams.length > 0) return;
    void refreshSession();
  }, [
    auth.signedIn,
    workspaceReady,
    access.systemRole,
    accessTeams.length,
    refreshSession,
  ]);

  // Link signed-in Google user to a Coach record for bumps / ballots
  useEffect(() => {
    if (!auth.signedIn || access.role === 'none' || access.role === 'viewer') {
      return;
    }
    const row = accessTeams.find(
      (t) => (t.team as { id?: string }).id === access.teamId,
    );
    const membershipName =
      (row?.membership as { coachDisplayName?: string } | null)
        ?.coachDisplayName ?? null;
    const coach = ensureSignedInCoach({
      uid: auth.uid,
      email: auth.email,
      displayName: auth.displayName,
      membershipCoachName: membershipName,
    });
    if (coach && coach.id !== bumpCoachId) {
      setBumpCoachId(coach.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    auth.signedIn,
    auth.uid,
    auth.email,
    auth.displayName,
    access.role,
    access.teamId,
    accessTeams,
    bumpCoachId,
  ]);

  useEffect(() => {
    if (coaches.length === 0) {
      if (bumpCoachId) setBumpCoachId('');
      return;
    }
    if (!coaches.some((c) => c.id === bumpCoachId)) {
      setBumpCoachId(coaches[0].id);
    }
  }, [coaches, bumpCoachId]);

  useEffect(() => {
    try {
      if (bumpCoachId) {
        localStorage.setItem(BUMP_COACH_STORAGE_KEY, bumpCoachId);
      } else {
        localStorage.removeItem(BUMP_COACH_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [bumpCoachId]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (ALL_TABS.includes(hash as TabRoute)) {
        setCurrentTab(hash as TabRoute);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Redirect away from gated tabs
  useEffect(() => {
    if (currentTab === 'quick-insert' && !can('dataEntry')) {
      setCurrentTab('rankings');
      window.location.hash = 'rankings';
    }
    if (currentTab === 'config' && !can('configWrite')) {
      setCurrentTab('rankings');
      window.location.hash = 'rankings';
    }
    if (currentTab === 'admin' && !can('adminPage')) {
      setCurrentTab('rankings');
      window.location.hash = 'rankings';
    }
  }, [currentTab, can]);

  const handleSelectTab = (tab: TabRoute) => {
    setCurrentTab(tab);
    window.location.hash = tab;
  };

  const rankings = useMemo(() => {
    const base = calculatePlayerRankings(
      players,
      entries,
      metrics,
      labels,
      formula,
    );
    const withCoaches = attachCoachesTotals(base, players, coachBallots);
    const withBumps = applyAdjustedBumps(withCoaches, adjustedBumps);
    const eligibleIds = eligiblePlayerIdSet(
      players.map((p) => p.id),
      complianceRequirements,
      playerCompliance,
    );
    return applyEligibilityToAdjustedRanks(withBumps, eligibleIds);
  }, [
    players,
    entries,
    metrics,
    labels,
    formula,
    coachBallots,
    adjustedBumps,
    complianceRequirements,
    playerCompliance,
  ]);

  const handleApplyBump = (playerId: string, delta: 1 | -1) => {
    if (!can('adjustedBumps')) return;
    if (!bumpCoachId) return;
    StorageService.applyBump(playerId, delta, bumpCoachId);
    refreshData();
  };

  const handleClearBumps = () => {
    if (!can('adjustedBumps')) return;
    StorageService.saveBumpTransactions([]);
    refreshData();
  };

  const handleClearPlayerBump = (playerId: string) => {
    if (!can('adjustedBumps')) return;
    StorageService.clearPlayerBumps(playerId);
    refreshData();
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (!authConfigured) {
    return <AuthConfigMissing />;
  }

  if (!auth.signedIn) {
    return (
      <LandingPage
        onSignedIn={() => {
          void refreshSession();
        }}
      />
    );
  }

  if (!workspaceReady) {
    // Always show the picker so anyone can Add new team (or Continue as admin).
    if (
      import.meta.env.DEV &&
      isLocalDebugMockAuth() &&
      access.systemRole !== 'systemAdmin' &&
      accessTeams.length === 0
    ) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-6 space-y-4 text-center">
            <h1 className="font-display text-lg font-bold">Local debug auth</h1>
            <p className="text-sm text-slate-400">
              Simulated sign-in is on, but mock System Admin access has not
              loaded yet.
            </p>
            <button
              type="button"
              className="rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/30"
              onClick={() => void refreshSession()}
            >
              Load mock teams
            </button>
          </div>
        </div>
      );
    }
    return (
      <TeamPickerPage
        onEnterAdmin={() => {
          setCurrentTab('admin');
          window.location.hash = 'admin';
        }}
      />
    );
  }

  if (access.role === 'none' && access.systemRole !== 'systemAdmin') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-3 text-center">
          <h1 className="font-display text-lg font-bold">No team access</h1>
          <p className="text-sm text-slate-400">
            Signed in as {auth.email}. Pick another team from your profile, or
            ask a System Admin for access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      <Navigation
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenQuickAddPlayer={() => {
          if (!can('rosterWrite')) return;
          setCurrentTab('players');
          setIsAddPlayerOpen(true);
        }}
        onOpenQuickSession={() => {
          if (!can('dataEntry')) return;
          setCurrentTab('sessions');
          setIsAddSessionOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        playerCount={players.length}
        sessionCount={sessions.length}
        team={team}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
        {currentTab === 'rankings' && (
          <RankingsView
            rankings={rankings}
            labels={labels}
            metrics={metrics}
            formula={formula}
            hasLoggedData={entries.length > 0}
            coaches={coaches}
            coachBallots={coachBallots}
            bumpCoachId={bumpCoachId}
            onBumpCoachChange={setBumpCoachId}
            bumpBudget={bumpBudget}
            adjustedBumps={adjustedBumps}
            bumpTransactions={bumpTransactions}
            onApplyBump={handleApplyBump}
            onClearBumps={handleClearBumps}
            onClearPlayerBump={handleClearPlayerBump}
            onOpenFormulaConfig={() => {
              if (can('configWrite')) setIsFormulaModalOpen(true);
            }}
            onSelectPlayer={(p) => setSelectedPlayer(p)}
            onOpenQuickInsert={() => {
              if (can('dataEntry')) handleSelectTab('quick-insert');
            }}
            rankingBoundaries={rankingBoundaries}
            allowBumps={can('adjustedBumps')}
          />
        )}

        {currentTab === 'quick-insert' && can('dataEntry') && (
          <QuickInsertView
            players={players}
            sessions={sessions}
            metrics={metrics}
            initialSessionId={loggerSessionId}
            onConsumedInitialSession={() => setLoggerSessionId(null)}
            onRefreshData={refreshData}
          />
        )}

        {currentTab === 'players' && (
          <PlayersView
            players={players}
            labels={labels}
            metrics={metrics}
            coaches={coaches}
            coachBallots={coachBallots}
            complianceRequirements={complianceRequirements}
            playerCompliance={playerCompliance}
            onSelectPlayer={(p) => setSelectedPlayer(p)}
            onRefreshData={refreshData}
            isAddModalOpen={isAddPlayerOpen && can('rosterWrite')}
            onCloseAddModal={() => setIsAddPlayerOpen(false)}
            readOnlyRoster={!can('rosterWrite')}
            allowCoachesRating={can('coachesRating')}
            allowProfileNotes={can('profileNotes')}
          />
        )}

        {currentTab === 'sessions' && (
          <SessionsView
            sessions={sessions}
            players={players}
            metrics={metrics}
            onRefreshData={refreshData}
            isAddModalOpen={isAddSessionOpen && can('dataEntry')}
            onCloseAddModal={() => setIsAddSessionOpen(false)}
            onOpenAddModal={() => {
              if (can('dataEntry')) setIsAddSessionOpen(true);
            }}
            onOpenQuickInsertForSession={(sId) => {
              if (!can('dataEntry')) return;
              const session = StorageService.getSessions().find((s) => s.id === sId);
              if (session?.status === 'closed') {
                StorageService.updateSession({ ...session, status: 'open' });
                refreshData();
              }
              setLoggerSessionId(sId);
              handleSelectTab('quick-insert');
            }}
            readOnly={!can('dataEntry')}
          />
        )}

        {currentTab === 'config' && can('configWrite') && (
          <ConfigView
            labels={labels}
            metrics={metrics}
            formula={formula}
            bumpBudget={bumpBudget}
            complianceRequirements={complianceRequirements}
            equipmentGroups={equipmentGroups}
            equipmentItems={equipmentItems}
            rankingBoundaries={rankingBoundaries}
            players={players}
            onRefreshData={refreshData}
          />
        )}

        {currentTab === 'admin' && can('adminPage') && (
          <AdminPageView onRefreshData={refreshData} />
        )}
      </main>

      {selectedPlayer && (
        <PlayerProfileModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onEditPlayer={() => {
            setSelectedPlayer(null);
            setCurrentTab('players');
          }}
          labels={labels}
          metrics={metrics}
        />
      )}

      {isFormulaModalOpen && can('configWrite') && (
        <ScoringConfigModal
          isOpen={isFormulaModalOpen}
          onClose={() => setIsFormulaModalOpen(false)}
          labels={labels}
          formula={formula}
          onRefreshData={refreshData}
        />
      )}

      <AccountSettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenAdmin={() => {
          if (can('adminPage')) setCurrentTab('admin');
        }}
      />
    </div>
  );
}
