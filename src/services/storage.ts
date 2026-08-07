import { 
  Player, 
  Session, 
  MetricEntry, 
  MetricDefinition, 
  LabelDefinition, 
  ScoringFormulaConfig 
} from '../types';
import { 
  INITIAL_PLAYERS, 
  INITIAL_SESSIONS, 
  INITIAL_ENTRIES, 
  DEFAULT_METRICS, 
  DEFAULT_LABELS, 
  DEFAULT_FORMULA_CONFIG 
} from '../data/initialData';

const STORAGE_KEYS = {
  PLAYERS: 'stm_players_v1',
  SESSIONS: 'stm_sessions_v1',
  ENTRIES: 'stm_entries_v1',
  METRICS: 'stm_metrics_v1',
  LABELS: 'stm_labels_v1',
  FORMULA: 'stm_formula_v1'
};

type StorageChangeListener = () => void;
const listeners = new Set<StorageChangeListener>();

export function subscribeToStorage(listener: StorageChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export const StorageService = {
  // --- PLAYERS ---
  getPlayers(): Player[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PLAYERS);
    if (!raw) {
      this.savePlayers(INITIAL_PLAYERS);
      return INITIAL_PLAYERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_PLAYERS;
    }
  },

  savePlayers(players: Player[]) {
    localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
    notifyListeners();
  },

  addPlayer(player: Omit<Player, 'id' | 'joinedDate'>): Player {
    const players = this.getPlayers();
    const newPlayer: Player = {
      ...player,
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      joinedDate: new Date().toISOString().split('T')[0]
    };
    players.push(newPlayer);
    this.savePlayers(players);
    return newPlayer;
  },

  updatePlayer(updated: Player) {
    const players = this.getPlayers().map(p => p.id === updated.id ? updated : p);
    this.savePlayers(players);
  },

  deletePlayer(id: string) {
    const players = this.getPlayers().filter(p => p.id !== id);
    this.savePlayers(players);
  },

  // --- SESSIONS ---
  getSessions(): Session[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!raw) {
      this.saveSessions(INITIAL_SESSIONS);
      return INITIAL_SESSIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_SESSIONS;
    }
  },

  saveSessions(sessions: Session[]) {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    notifyListeners();
  },

  addSession(session: Omit<Session, 'id'>): Session {
    const sessions = this.getSessions();
    const newSession: Session = {
      ...session,
      id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    sessions.unshift(newSession); // Newest first
    this.saveSessions(sessions);
    return newSession;
  },

  updateSession(updated: Session) {
    const sessions = this.getSessions().map(s => s.id === updated.id ? updated : s);
    this.saveSessions(sessions);
  },

  deleteSession(id: string) {
    const sessions = this.getSessions().filter(s => s.id !== id);
    this.saveSessions(sessions);
    // Also cleanup entries for this session
    const entries = this.getEntries().filter(e => e.sessionId !== id);
    this.saveEntries(entries);
  },

  // --- METRIC ENTRIES ---
  getEntries(): MetricEntry[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ENTRIES);
    if (!raw) {
      this.saveEntries(INITIAL_ENTRIES);
      return INITIAL_ENTRIES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_ENTRIES;
    }
  },

  saveEntries(entries: MetricEntry[]) {
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
    notifyListeners();
  },

  addOrUpdateEntry(entry: Omit<MetricEntry, 'id' | 'timestamp'> & { id?: string }): MetricEntry {
    const entries = this.getEntries();
    // Check if an entry already exists for same session, player, and metric
    const existingIndex = entries.findIndex(
      e => e.sessionId === entry.sessionId && e.playerId === entry.playerId && e.metricId === entry.metricId
    );

    const now = new Date().toISOString();
    let updatedEntry: MetricEntry;

    if (existingIndex >= 0) {
      updatedEntry = {
        ...entries[existingIndex],
        value: entry.value,
        rawValue: entry.rawValue,
        notes: entry.notes ?? entries[existingIndex].notes,
        timestamp: now
      };
      entries[existingIndex] = updatedEntry;
    } else {
      updatedEntry = {
        ...entry,
        id: entry.id || `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now
      };
      entries.push(updatedEntry);
    }

    this.saveEntries(entries);
    return updatedEntry;
  },

  batchSaveEntries(newEntries: Omit<MetricEntry, 'id' | 'timestamp'>[]) {
    const entries = this.getEntries();
    const now = new Date().toISOString();

    newEntries.forEach(item => {
      const idx = entries.findIndex(
        e => e.sessionId === item.sessionId && e.playerId === item.playerId && e.metricId === item.metricId
      );
      if (idx >= 0) {
        entries[idx] = {
          ...entries[idx],
          value: item.value,
          rawValue: item.rawValue,
          notes: item.notes,
          timestamp: now
        };
      } else {
        entries.push({
          ...item,
          id: `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now
        });
      }
    });

    this.saveEntries(entries);
  },

  deleteEntry(id: string) {
    const entries = this.getEntries().filter(e => e.id !== id);
    this.saveEntries(entries);
  },

  // --- METRIC DEFINITIONS ---
  getMetrics(): MetricDefinition[] {
    const raw = localStorage.getItem(STORAGE_KEYS.METRICS);
    if (!raw) {
      this.saveMetrics(DEFAULT_METRICS);
      return DEFAULT_METRICS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_METRICS;
    }
  },

  saveMetrics(metrics: MetricDefinition[]) {
    localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(metrics));
    notifyListeners();
  },

  addMetric(metric: Omit<MetricDefinition, 'id'>): MetricDefinition {
    const metrics = this.getMetrics();
    const newMetric: MetricDefinition = {
      ...metric,
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    metrics.push(newMetric);
    this.saveMetrics(metrics);
    return newMetric;
  },

  updateMetric(updated: MetricDefinition) {
    const metrics = this.getMetrics().map(m => m.id === updated.id ? updated : m);
    this.saveMetrics(metrics);
  },

  deleteMetric(id: string) {
    const metrics = this.getMetrics().filter(m => m.id !== id);
    this.saveMetrics(metrics);
  },

  // --- LABELS / CATEGORIES ---
  getLabels(): LabelDefinition[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LABELS);
    if (!raw) {
      this.saveLabels(DEFAULT_LABELS);
      return DEFAULT_LABELS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_LABELS;
    }
  },

  saveLabels(labels: LabelDefinition[]) {
    localStorage.setItem(STORAGE_KEYS.LABELS, JSON.stringify(labels));
    notifyListeners();
  },

  addLabel(label: Omit<LabelDefinition, 'id'>): LabelDefinition {
    const labels = this.getLabels();
    const newLabel: LabelDefinition = {
      ...label,
      id: label.name.toLowerCase().replace(/[^a-z0-9]/g, '_') || `lbl_${Date.now()}`
    };
    labels.push(newLabel);
    this.saveLabels(labels);

    // Also update formula weights to include this new label
    const formula = this.getFormula();
    if (!formula.weights.some(w => w.labelId === newLabel.id)) {
      formula.weights.push({ labelId: newLabel.id, weightPercent: 10, enabled: true });
      this.saveFormula(formula);
    }

    return newLabel;
  },

  // --- FORMULA & SCORING WEIGHTS ---
  getFormula(): ScoringFormulaConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.FORMULA);
    if (!raw) {
      this.saveFormula(DEFAULT_FORMULA_CONFIG);
      return DEFAULT_FORMULA_CONFIG;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_FORMULA_CONFIG;
    }
  },

  saveFormula(formula: ScoringFormulaConfig) {
    localStorage.setItem(STORAGE_KEYS.FORMULA, JSON.stringify(formula));
    notifyListeners();
  },

  // --- RESET & EXPORT/IMPORT ---
  resetToSampleData() {
    this.savePlayers(INITIAL_PLAYERS);
    this.saveSessions(INITIAL_SESSIONS);
    this.saveEntries(INITIAL_ENTRIES);
    this.saveMetrics(DEFAULT_METRICS);
    this.saveLabels(DEFAULT_LABELS);
    this.saveFormula(DEFAULT_FORMULA_CONFIG);
  },

  exportFullBackupJSON(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      players: this.getPlayers(),
      sessions: this.getSessions(),
      entries: this.getEntries(),
      metrics: this.getMetrics(),
      labels: this.getLabels(),
      formula: this.getFormula()
    };
    return JSON.stringify(backup, null, 2);
  },

  importFullBackupJSON(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.players && data.sessions && data.entries) {
        if (data.players) this.savePlayers(data.players);
        if (data.sessions) this.saveSessions(data.sessions);
        if (data.entries) this.saveEntries(data.entries);
        if (data.metrics) this.saveMetrics(data.metrics);
        if (data.labels) this.saveLabels(data.labels);
        if (data.formula) this.saveFormula(data.formula);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
};
