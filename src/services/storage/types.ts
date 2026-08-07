import type {
  Team,
  Player,
  Session,
  MetricEntry,
  MetricDefinition,
  LabelDefinition,
  ScoringFormulaConfig,
} from '../../types';

export type StorageMode = 'cloud' | 'local-fallback';

export interface ConnectionStatus {
  mode: StorageMode;
  apiConfigured: boolean;
  apiHealthy: boolean;
  firestoreReachable: boolean | null;
  authConfigured: boolean;
  signedIn: boolean;
  userEmail: string | null;
  forceLocal: boolean;
  lastCheckedAt: string | null;
  message: string;
}

export interface TeamSnapshot {
  team: Team;
  players: Player[];
  sessions: Session[];
  entries: MetricEntry[];
  metrics: MetricDefinition[];
  labels: LabelDefinition[];
  formula: ScoringFormulaConfig;
}

export interface StorageRepository {
  getTeam(): Team;
  saveTeam(team: Team): void;
  updateTeam(partial: Partial<Team> & { id: string }): Team;

  getPlayers(): Player[];
  savePlayers(players: Player[]): void;
  addPlayer(player: Omit<Player, 'id' | 'joinedDate'>): Player;
  updatePlayer(updated: Player): void;
  deletePlayer(id: string): void;

  getSessions(): Session[];
  saveSessions(sessions: Session[]): void;
  addSession(session: Omit<Session, 'id'>): Session;
  updateSession(updated: Session): void;
  deleteSession(id: string): void;

  getEntries(): MetricEntry[];
  saveEntries(entries: MetricEntry[]): void;
  addOrUpdateEntry(
    entry: Omit<MetricEntry, 'id' | 'timestamp'> & { id?: string },
  ): MetricEntry;
  batchSaveEntries(newEntries: Omit<MetricEntry, 'id' | 'timestamp'>[]): void;
  deleteEntry(id: string): void;

  getMetrics(): MetricDefinition[];
  saveMetrics(metrics: MetricDefinition[]): void;
  addMetric(metric: Omit<MetricDefinition, 'id'>): MetricDefinition;
  updateMetric(updated: MetricDefinition): void;
  deleteMetric(id: string): void;

  getLabels(): LabelDefinition[];
  saveLabels(labels: LabelDefinition[]): void;
  addLabel(label: Omit<LabelDefinition, 'id'>): LabelDefinition;

  getFormula(): ScoringFormulaConfig;
  saveFormula(formula: ScoringFormulaConfig): void;

  resetToSampleData(): void;
  exportFullBackupJSON(): string;
  importFullBackupJSON(jsonString: string): boolean;
  getSnapshot(): TeamSnapshot;
}
