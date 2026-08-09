import React, { useState, useEffect, useMemo } from 'react';
import { TabRoute, Navigation } from './components/Navigation';
import { RankingsView } from './components/RankingsView';
import { QuickInsertView } from './components/QuickInsertView';
import { PlayersView } from './components/PlayersView';
import { SessionsView } from './components/SessionsView';
import { ConfigView } from './components/ConfigView';
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

const BUMP_COACH_STORAGE_KEY = 'stm_active_bump_coach_v1';

export default function App() {
  // Hash Routing with default to 'rankings'
  const [currentTab, setCurrentTab] = useState<TabRoute>(() => {
    const hash = window.location.hash.replace('#', '');
    if (['rankings', 'quick-insert', 'players', 'sessions', 'config'].includes(hash)) {
      return hash as TabRoute;
    }
    return 'rankings';
  });

  // App Data State
  const [team, setTeam] = useState(() => StorageService.getTeam());
  const [players, setPlayers] = useState(() => StorageService.getPlayers());
  const [sessions, setSessions] = useState(() => StorageService.getSessions());
  const [entries, setEntries] = useState(() => StorageService.getEntries());
  const [metrics, setMetrics] = useState(() => StorageService.getMetrics());
  const [labels, setLabels] = useState(() => StorageService.getLabels());
  const [formula, setFormula] = useState(() => StorageService.getFormula());
  const [calculatedFields, setCalculatedFields] = useState(() =>
    StorageService.getCalculatedFields(),
  );
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

  // Modal States
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState<boolean>(false);
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState<boolean>(false);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState<boolean>(false);
  const [loggerSessionId, setLoggerSessionId] = useState<string | null>(null);

  // Sync state on storage updates
  const refreshData = () => {
    setTeam(StorageService.getTeam());
    setPlayers(StorageService.getPlayers());
    setSessions(StorageService.getSessions());
    setEntries(StorageService.getEntries());
    setMetrics(StorageService.getMetrics());
    setLabels(StorageService.getLabels());
    setFormula(StorageService.getFormula());
    setCalculatedFields(StorageService.getCalculatedFields());
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

  // Keep bump coach selection valid as roster of coaches changes
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
      /* ignore quota / private mode */
    }
  }, [bumpCoachId]);

  // Listen to window hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['rankings', 'quick-insert', 'players', 'sessions', 'config'].includes(hash)) {
        setCurrentTab(hash as TabRoute);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
      calculatedFields,
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
    calculatedFields,
    coachBallots,
    adjustedBumps,
    complianceRequirements,
    playerCompliance,
  ]);

  const handleApplyBump = (playerId: string, delta: 1 | -1) => {
    if (!bumpCoachId) return;
    StorageService.applyBump(playerId, delta, bumpCoachId);
    refreshData();
  };

  const handleClearBumps = () => {
    StorageService.saveBumpTransactions([]);
    refreshData();
  };

  const handleClearPlayerBump = (playerId: string) => {
    StorageService.clearPlayerBumps(playerId);
    refreshData();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* iOS App Navigation Header */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenQuickAddPlayer={() => {
          setCurrentTab('players');
          setIsAddPlayerOpen(true);
        }}
        onOpenQuickSession={() => {
          setCurrentTab('sessions');
          setIsAddSessionOpen(true);
        }}
        playerCount={players.length}
        sessionCount={sessions.length}
        team={team}
      />

      {/* Main Screen Router View Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
        {currentTab === 'rankings' && (
          <RankingsView
            rankings={rankings}
            labels={labels}
            metrics={metrics}
            calculatedFields={calculatedFields}
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
            onOpenFormulaConfig={() => setIsFormulaModalOpen(true)}
            onSelectPlayer={(p) => setSelectedPlayer(p)}
            onOpenQuickInsert={() => handleSelectTab('quick-insert')}
            rankingBoundaries={rankingBoundaries}
          />
        )}

        {currentTab === 'quick-insert' && (
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
            isAddModalOpen={isAddPlayerOpen}
            onCloseAddModal={() => setIsAddPlayerOpen(false)}
          />
        )}

        {currentTab === 'sessions' && (
          <SessionsView
            sessions={sessions}
            players={players}
            metrics={metrics}
            onRefreshData={refreshData}
            isAddModalOpen={isAddSessionOpen}
            onCloseAddModal={() => setIsAddSessionOpen(false)}
            onOpenAddModal={() => setIsAddSessionOpen(true)}
            onOpenQuickInsertForSession={(sId) => {
              const session = StorageService.getSessions().find((s) => s.id === sId);
              if (session?.status === 'closed') {
                StorageService.updateSession({ ...session, status: 'open' });
                refreshData();
              }
              setLoggerSessionId(sId);
              handleSelectTab('quick-insert');
            }}
          />
        )}

        {currentTab === 'config' && (
          <ConfigView
            labels={labels}
            metrics={metrics}
            formula={formula}
            calculatedFields={calculatedFields}
            bumpBudget={bumpBudget}
            complianceRequirements={complianceRequirements}
            equipmentGroups={equipmentGroups}
            equipmentItems={equipmentItems}
            rankingBoundaries={rankingBoundaries}
            players={players}
            onRefreshData={refreshData}
          />
        )}
      </main>

      {/* Global Modals */}
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

      {isFormulaModalOpen && (
        <ScoringConfigModal
          isOpen={isFormulaModalOpen}
          onClose={() => setIsFormulaModalOpen(false)}
          labels={labels}
          formula={formula}
          onRefreshData={refreshData}
        />
      )}
    </div>
  );
}
