import type {
  Team,
  Player,
  Session,
  MetricEntry,
  MetricDefinition,
  LabelDefinition,
  ScoringFormulaConfig,
  CalculatedFieldDefinition,
  Coach,
  CoachBallot,
  AdjustedBumpConfig,
  AdjustedBumpTransaction,
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
  calculatedFields: CalculatedFieldDefinition[];
  coaches: Coach[];
  coachBallots: CoachBallot[];
  /** Derived playerId → net bump (convenience / older backups). */
  adjustedBumps: Record<string, number>;
  /** Source of truth for Adjusted ±1 bumps with coach attribution. */
  bumpTransactions?: AdjustedBumpTransaction[];
  bumpBudget: AdjustedBumpConfig;
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
  addSession(session: Omit<Session, 'id' | 'status'> & { status?: Session['status'] }): Session;
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
  updateLabel(updated: LabelDefinition): void;
  deleteLabel(id: string): void;

  getFormula(): ScoringFormulaConfig;
  saveFormula(formula: ScoringFormulaConfig): void;

  getCalculatedFields(): CalculatedFieldDefinition[];
  saveCalculatedFields(fields: CalculatedFieldDefinition[]): void;
  updateCalculatedField(updated: CalculatedFieldDefinition): void;

  getCoaches(): Coach[];
  saveCoaches(coaches: Coach[]): void;
  addCoach(coach: Omit<Coach, 'id'>): Coach;
  deleteCoach(id: string): void;

  getCoachBallots(): CoachBallot[];
  saveCoachBallots(ballots: CoachBallot[]): void;
  saveCoachBallot(ballot: CoachBallot): void;

  getBumpTransactions(): AdjustedBumpTransaction[];
  saveBumpTransactions(transactions: AdjustedBumpTransaction[]): void;
  getAdjustedBumps(): Record<string, number>;
  saveAdjustedBumps(bumps: Record<string, number>): void;
  applyBump(playerId: string, delta: 1 | -1, coachId: string): boolean;
  clearPlayerBumps(playerId: string): void;

  getBumpBudget(): AdjustedBumpConfig;
  saveBumpBudget(budget: AdjustedBumpConfig): void;

  clearNonSystemLabels(): void;
  clearNonSystemMetrics(): void;
  clearAllPlayers(): void;

  resetToSampleData(): void;
  exportFullBackupJSON(): string;
  importFullBackupJSON(jsonString: string): boolean;
  getSnapshot(): TeamSnapshot;
}
