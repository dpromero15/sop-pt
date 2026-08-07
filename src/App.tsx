import React, { useState, useEffect } from 'react';
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
import { Player } from './types';

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

  // Modal States
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState<boolean>(false);
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState<boolean>(false);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState<boolean>(false);

  // Sync state on storage updates
  const refreshData = () => {
    setTeam(StorageService.getTeam());
    setPlayers(StorageService.getPlayers());
    setSessions(StorageService.getSessions());
    setEntries(StorageService.getEntries());
    setMetrics(StorageService.getMetrics());
    setLabels(StorageService.getLabels());
    setFormula(StorageService.getFormula());
  };

  useEffect(() => {
    const unsubscribe = subscribeToStorage(refreshData);
    return () => unsubscribe();
  }, []);

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

  // Compute live rankings for views
  const rankings = calculatePlayerRankings(players, entries, metrics, labels, formula);

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
            formula={formula}
            onOpenFormulaConfig={() => setIsFormulaModalOpen(true)}
            onSelectPlayer={(p) => setSelectedPlayer(p)}
            onOpenQuickInsert={() => handleSelectTab('quick-insert')}
          />
        )}

        {currentTab === 'quick-insert' && (
          <QuickInsertView
            players={players}
            sessions={sessions}
            metrics={metrics}
            onOpenCreateSession={() => {
              setCurrentTab('sessions');
              setIsAddSessionOpen(true);
            }}
            onRefreshData={refreshData}
          />
        )}

        {currentTab === 'players' && (
          <PlayersView
            players={players}
            labels={labels}
            metrics={metrics}
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
            onOpenQuickInsertForSession={(sId) => {
              handleSelectTab('quick-insert');
            }}
          />
        )}

        {currentTab === 'config' && (
          <ConfigView
            labels={labels}
            metrics={metrics}
            formula={formula}
            onRefreshData={refreshData}
          />
        )}
      </main>

      {/* Global Modals */}
      {selectedPlayer && (
        <PlayerProfileModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onEditPlayer={(p) => {
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
