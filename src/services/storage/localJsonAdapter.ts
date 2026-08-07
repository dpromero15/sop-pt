import type {
  Player,
  Session,
  MetricEntry,
  MetricDefinition,
  LabelDefinition,
  ScoringFormulaConfig,
  Team,
} from '../../types';
import {
  INITIAL_PLAYERS,
  INITIAL_SESSIONS,
  INITIAL_ENTRIES,
  DEFAULT_METRICS,
  DEFAULT_LABELS,
  DEFAULT_FORMULA_CONFIG,
  DEFAULT_TEAM,
} from '../../data/initialData';
import type { StorageRepository, TeamSnapshot } from './types';

export const STORAGE_KEYS = {
  TEAM: 'stm_team_v1',
  PLAYERS: 'stm_players_v1',
  SESSIONS: 'stm_sessions_v1',
  ENTRIES: 'stm_entries_v1',
  METRICS: 'stm_metrics_v1',
  LABELS: 'stm_labels_v1',
  FORMULA: 'stm_formula_v1',
} as const;

type StorageChangeListener = () => void;

export type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function createMemoryStorage(): LocalStorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

export class LocalJsonAdapter implements StorageRepository {
  private listeners = new Set<StorageChangeListener>();
  private store: LocalStorageLike;

  constructor(store?: LocalStorageLike) {
    this.store =
      store ??
      (typeof localStorage !== 'undefined' ? localStorage : createMemoryStorage());
  }

  subscribe(listener: StorageChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  private readJson<T>(key: string, fallback: T): T {
    const raw = this.store.getItem(key);
    if (!raw) {
      this.writeJson(key, fallback);
      return fallback;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private writeJson(key: string, value: unknown) {
    this.store.setItem(key, JSON.stringify(value));
  }

  getTeam(): Team {
    return this.readJson(STORAGE_KEYS.TEAM, DEFAULT_TEAM);
  }

  saveTeam(team: Team) {
    this.writeJson(STORAGE_KEYS.TEAM, { ...team, updatedAt: new Date().toISOString() });
    this.notify();
  }

  updateTeam(partial: Partial<Team> & { id: string }): Team {
    const current = this.getTeam();
    const next: Team = {
      ...current,
      ...partial,
      id: partial.id || current.id,
      updatedAt: new Date().toISOString(),
    };
    this.saveTeam(next);
    return next;
  }

  getPlayers(): Player[] {
    return this.readJson(STORAGE_KEYS.PLAYERS, INITIAL_PLAYERS);
  }

  savePlayers(players: Player[]) {
    this.writeJson(STORAGE_KEYS.PLAYERS, players);
    this.notify();
  }

  addPlayer(player: Omit<Player, 'id' | 'joinedDate'>): Player {
    const players = this.getPlayers();
    const newPlayer: Player = {
      ...player,
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      joinedDate: new Date().toISOString().split('T')[0],
    };
    players.push(newPlayer);
    this.savePlayers(players);
    return newPlayer;
  }

  updatePlayer(updated: Player) {
    this.savePlayers(this.getPlayers().map((p) => (p.id === updated.id ? updated : p)));
  }

  deletePlayer(id: string) {
    this.savePlayers(this.getPlayers().filter((p) => p.id !== id));
  }

  getSessions(): Session[] {
    return this.readJson(STORAGE_KEYS.SESSIONS, INITIAL_SESSIONS);
  }

  saveSessions(sessions: Session[]) {
    this.writeJson(STORAGE_KEYS.SESSIONS, sessions);
    this.notify();
  }

  addSession(session: Omit<Session, 'id'>): Session {
    const sessions = this.getSessions();
    const newSession: Session = {
      ...session,
      id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    sessions.unshift(newSession);
    this.saveSessions(sessions);
    return newSession;
  }

  updateSession(updated: Session) {
    this.saveSessions(this.getSessions().map((s) => (s.id === updated.id ? updated : s)));
  }

  deleteSession(id: string) {
    this.saveSessions(this.getSessions().filter((s) => s.id !== id));
    this.saveEntries(this.getEntries().filter((e) => e.sessionId !== id));
  }

  getEntries(): MetricEntry[] {
    return this.readJson(STORAGE_KEYS.ENTRIES, INITIAL_ENTRIES);
  }

  saveEntries(entries: MetricEntry[]) {
    this.writeJson(STORAGE_KEYS.ENTRIES, entries);
    this.notify();
  }

  addOrUpdateEntry(
    entry: Omit<MetricEntry, 'id' | 'timestamp'> & { id?: string },
  ): MetricEntry {
    const entries = this.getEntries();
    const existingIndex = entries.findIndex(
      (e) =>
        e.sessionId === entry.sessionId &&
        e.playerId === entry.playerId &&
        e.metricId === entry.metricId,
    );
    const now = new Date().toISOString();
    let updatedEntry: MetricEntry;

    if (existingIndex >= 0) {
      updatedEntry = {
        ...entries[existingIndex],
        value: entry.value,
        rawValue: entry.rawValue,
        notes: entry.notes ?? entries[existingIndex].notes,
        timestamp: now,
      };
      entries[existingIndex] = updatedEntry;
    } else {
      updatedEntry = {
        ...entry,
        id: entry.id || `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
      };
      entries.push(updatedEntry);
    }

    this.saveEntries(entries);
    return updatedEntry;
  }

  batchSaveEntries(newEntries: Omit<MetricEntry, 'id' | 'timestamp'>[]) {
    const entries = this.getEntries();
    const now = new Date().toISOString();

    newEntries.forEach((item) => {
      const idx = entries.findIndex(
        (e) =>
          e.sessionId === item.sessionId &&
          e.playerId === item.playerId &&
          e.metricId === item.metricId,
      );
      if (idx >= 0) {
        entries[idx] = {
          ...entries[idx],
          value: item.value,
          rawValue: item.rawValue,
          notes: item.notes,
          timestamp: now,
        };
      } else {
        entries.push({
          ...item,
          id: `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
        });
      }
    });

    this.saveEntries(entries);
  }

  deleteEntry(id: string) {
    this.saveEntries(this.getEntries().filter((e) => e.id !== id));
  }

  getMetrics(): MetricDefinition[] {
    return this.readJson(STORAGE_KEYS.METRICS, DEFAULT_METRICS);
  }

  saveMetrics(metrics: MetricDefinition[]) {
    this.writeJson(STORAGE_KEYS.METRICS, metrics);
    this.notify();
  }

  addMetric(metric: Omit<MetricDefinition, 'id'>): MetricDefinition {
    const metrics = this.getMetrics();
    const newMetric: MetricDefinition = {
      ...metric,
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    metrics.push(newMetric);
    this.saveMetrics(metrics);
    return newMetric;
  }

  updateMetric(updated: MetricDefinition) {
    this.saveMetrics(this.getMetrics().map((m) => (m.id === updated.id ? updated : m)));
  }

  deleteMetric(id: string) {
    this.saveMetrics(this.getMetrics().filter((m) => m.id !== id));
  }

  getLabels(): LabelDefinition[] {
    return this.readJson(STORAGE_KEYS.LABELS, DEFAULT_LABELS);
  }

  saveLabels(labels: LabelDefinition[]) {
    this.writeJson(STORAGE_KEYS.LABELS, labels);
    this.notify();
  }

  addLabel(label: Omit<LabelDefinition, 'id'>): LabelDefinition {
    const labels = this.getLabels();
    const newLabel: LabelDefinition = {
      ...label,
      id: label.name.toLowerCase().replace(/[^a-z0-9]/g, '_') || `lbl_${Date.now()}`,
    };
    labels.push(newLabel);
    this.saveLabels(labels);

    const formula = this.getFormula();
    if (!formula.weights.some((w) => w.labelId === newLabel.id)) {
      formula.weights.push({ labelId: newLabel.id, weightPercent: 10, enabled: true });
      this.saveFormula(formula);
    }

    return newLabel;
  }

  getFormula(): ScoringFormulaConfig {
    return this.readJson(STORAGE_KEYS.FORMULA, DEFAULT_FORMULA_CONFIG);
  }

  saveFormula(formula: ScoringFormulaConfig) {
    this.writeJson(STORAGE_KEYS.FORMULA, formula);
    this.notify();
  }

  resetToSampleData() {
    this.saveTeam(DEFAULT_TEAM);
    this.savePlayers(INITIAL_PLAYERS);
    this.saveSessions(INITIAL_SESSIONS);
    this.saveEntries(INITIAL_ENTRIES);
    this.saveMetrics(DEFAULT_METRICS);
    this.saveLabels(DEFAULT_LABELS);
    this.saveFormula(DEFAULT_FORMULA_CONFIG);
  }

  getSnapshot(): TeamSnapshot {
    return {
      team: this.getTeam(),
      players: this.getPlayers(),
      sessions: this.getSessions(),
      entries: this.getEntries(),
      metrics: this.getMetrics(),
      labels: this.getLabels(),
      formula: this.getFormula(),
    };
  }

  exportFullBackupJSON(): string {
    const backup = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      ...this.getSnapshot(),
    };
    return JSON.stringify(backup, null, 2);
  }

  importFullBackupJSON(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.players && data.sessions && data.entries) {
        if (data.team) this.saveTeam(data.team);
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
}
