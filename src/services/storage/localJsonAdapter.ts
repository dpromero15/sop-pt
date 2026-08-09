import type {
  Player,
  Session,
  SessionStatus,
  MetricEntry,
  MetricDefinition,
  LabelDefinition,
  ScoringFormulaConfig,
  Team,
  CalculatedFieldDefinition,
  Coach,
  CoachBallot,
  AdjustedBumpConfig,
  AdjustedBumpTransaction,
  ComplianceRequirement,
  PlayerComplianceState,
  EquipmentGroup,
  EquipmentItem,
  RankingBoundariesConfig,
} from '../../types';
import {
  INITIAL_PLAYERS,
  INITIAL_SESSIONS,
  INITIAL_ENTRIES,
  DEFAULT_METRICS,
  DEFAULT_LABELS,
  DEFAULT_FORMULA_CONFIG,
  DEFAULT_TEAM,
  DEFAULT_CALCULATED_FIELDS,
  DEFAULT_COACHES,
  DEFAULT_COACH_BALLOTS,
  DEFAULT_BUMP_BUDGET,
  DEFAULT_ADJUSTED_BUMPS,
  DEFAULT_COMPLIANCE_REQUIREMENTS,
  DEFAULT_PLAYER_COMPLIANCE,
  DEFAULT_EQUIPMENT_GROUPS,
  DEFAULT_EQUIPMENT_ITEMS,
  DEFAULT_RANKING_BOUNDARIES,
} from '../../data/initialData';
import type { StorageRepository, TeamSnapshot } from './types';
import {
  ATTENDANCE_METRIC_ID,
  defaultMetricIdsForSessionType,
  ensureAttendanceFirst,
  migrateSessionsMetricIds,
  normalizeSessionStatus,
  type LegacySession,
} from '../../utils/sessionMetrics';
import { migrateMetricsAggregation } from '../../utils/metricAggregation';
import {
  canApplyBump,
  createBumpTransaction,
  netBumpsFromTransactions,
  parseStoredBumpTransactions,
} from '../../utils/adjustedBumps';

export const STORAGE_KEYS = {
  TEAM: 'stm_team_v1',
  PLAYERS: 'stm_players_v1',
  SESSIONS: 'stm_sessions_v1',
  ENTRIES: 'stm_entries_v1',
  METRICS: 'stm_metrics_v1',
  LABELS: 'stm_labels_v1',
  FORMULA: 'stm_formula_v1',
  CALCULATED_FIELDS: 'stm_calculated_fields_v1',
  COACHES: 'stm_coaches_v1',
  COACH_BALLOTS: 'stm_coach_ballots_v1',
  ADJUSTED_BUMPS: 'stm_adjusted_bumps_v1',
  BUMP_BUDGET: 'stm_bump_budget_v1',
  COMPLIANCE_REQUIREMENTS: 'stm_compliance_requirements_v1',
  PLAYER_COMPLIANCE: 'stm_player_compliance_v1',
  EQUIPMENT_GROUPS: 'stm_equipment_groups_v1',
  EQUIPMENT_ITEMS: 'stm_equipment_items_v1',
  RANKING_BOUNDARIES: 'stm_ranking_boundaries_v1',
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
    const txs = this.getBumpTransactions();
    const next = txs.filter((tx) => tx.playerId !== id);
    if (next.length !== txs.length) {
      this.saveBumpTransactions(next);
    }
    const compliance = this.getPlayerCompliance();
    if (compliance[id]) {
      const { [id]: _removed, ...rest } = compliance;
      this.savePlayerCompliance(rest);
    }
    const items = this.getEquipmentItems();
    const freed = items.map((item) =>
      item.assignedPlayerId === id
        ? {
            ...item,
            status: 'available' as const,
            assignedPlayerId: undefined,
            assignedAt: undefined,
          }
        : item,
    );
    if (freed.some((item, i) => item !== items[i])) {
      this.saveEquipmentItems(freed);
    }
  }

  getSessions(): Session[] {
    const raw = this.readJson<LegacySession[]>(STORAGE_KEYS.SESSIONS, INITIAL_SESSIONS);
    const entries = this.readJson(STORAGE_KEYS.ENTRIES, INITIAL_ENTRIES);
    const migrated = migrateSessionsMetricIds(raw, entries);
    const needsWrite = raw.some((s, i) => {
      const next = migrated[i];
      return (
        !('metricIds' in s) ||
        !s.metricIds ||
        s.metricIds.length === 0 ||
        !('status' in s) ||
        normalizeSessionStatus(s.status) !== next.status ||
        (s as { type?: string }).type !== next.type ||
        JSON.stringify(s.metricIds) !== JSON.stringify(next.metricIds)
      );
    });
    if (needsWrite) {
      this.writeJson(STORAGE_KEYS.SESSIONS, migrated);
    }
    return migrated;
  }

  saveSessions(sessions: Session[]) {
    this.writeJson(
      STORAGE_KEYS.SESSIONS,
      sessions.map((s) => ({
        ...s,
        type: s.type === 'match' ? 'match' : 'session',
        status: normalizeSessionStatus(s.status),
        metricIds: ensureAttendanceFirst(s.metricIds?.length ? s.metricIds : [ATTENDANCE_METRIC_ID]),
      })),
    );
    this.notify();
  }

  addSession(session: Omit<Session, 'id' | 'status'> & { status?: SessionStatus }): Session {
    const sessions = this.getSessions();
    const metricIds = ensureAttendanceFirst(
      session.metricIds?.length
        ? session.metricIds
        : defaultMetricIdsForSessionType(session.type),
    );
    const newSession: Session = {
      ...session,
      status: normalizeSessionStatus(session.status),
      metricIds,
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
    const raw = this.readJson<MetricDefinition[]>(
      STORAGE_KEYS.METRICS,
      DEFAULT_METRICS,
    );
    const { metrics, changed } = migrateMetricsAggregation(raw);
    if (changed) {
      this.writeJson(STORAGE_KEYS.METRICS, metrics);
    }
    return metrics;
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
    const labels = this.readJson(STORAGE_KEYS.LABELS, DEFAULT_LABELS);
    let changed = false;
    const migrated = labels.map((label) => {
      if (label.id === 'attendance' && !label.system) {
        changed = true;
        return { ...label, system: true };
      }
      return label;
    });
    if (changed) {
      this.writeJson(STORAGE_KEYS.LABELS, migrated);
    }
    return migrated;
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

  updateLabel(updated: LabelDefinition) {
    const labels = this.getLabels();
    const existing = labels.find((l) => l.id === updated.id);
    if (!existing) return;
    const next: LabelDefinition = {
      ...updated,
      // Preserve system flag from storage / migration
      system: existing.system || updated.system,
    };
    this.saveLabels(labels.map((l) => (l.id === updated.id ? next : l)));
  }

  deleteLabel(id: string) {
    const labels = this.getLabels();
    const label = labels.find((l) => l.id === id);
    if (!label) return;
    if (label.system) return;

    const metrics = this.getMetrics();
    if (metrics.some((m) => m.labelId === id)) {
      throw new Error(
        'Reassign or remove metrics that use this label before deleting it.',
      );
    }

    this.saveLabels(labels.filter((l) => l.id !== id));

    const formula = this.getFormula();
    this.saveFormula({
      ...formula,
      weights: formula.weights.filter((w) => w.labelId !== id),
    });
  }

  clearNonSystemLabels() {
    const labels = this.getLabels();
    const kept = labels.filter((l) => l.system);
    const keptIds = new Set(kept.map((l) => l.id));
    this.saveLabels(kept);

    const formula = this.getFormula();
    this.saveFormula({
      ...formula,
      weights: formula.weights.filter((w) => keptIds.has(w.labelId)),
    });
  }

  clearNonSystemMetrics() {
    const metrics = this.getMetrics();
    const kept = metrics.filter(
      (m) => m.id === ATTENDANCE_METRIC_ID || m.type === 'attendance',
    );
    const keptIds = new Set(kept.map((m) => m.id));
    this.saveMetrics(kept);

    const fields = this.getCalculatedFields().filter((f) =>
      keptIds.has(f.baseMetricId),
    );
    this.saveCalculatedFields(fields);

    const sessions = this.getSessions().map((s) => ({
      ...s,
      metricIds: ensureAttendanceFirst(
        (s.metricIds || []).filter((id) => keptIds.has(id)),
      ),
    }));
    this.saveSessions(sessions);
  }

  clearAllPlayers() {
    this.savePlayers([]);
    this.saveAdjustedBumps({});
    this.savePlayerCompliance({});
    const items = this.getEquipmentItems().map((item) =>
      item.status === 'assigned'
        ? {
            ...item,
            status: 'available' as const,
            assignedPlayerId: undefined,
            assignedAt: undefined,
          }
        : item,
    );
    this.saveEquipmentItems(items);
  }

  getFormula(): ScoringFormulaConfig {
    return this.readJson(STORAGE_KEYS.FORMULA, DEFAULT_FORMULA_CONFIG);
  }

  saveFormula(formula: ScoringFormulaConfig) {
    this.writeJson(STORAGE_KEYS.FORMULA, formula);
    this.notify();
  }

  getCalculatedFields(): CalculatedFieldDefinition[] {
    const stored = this.readJson<CalculatedFieldDefinition[]>(
      STORAGE_KEYS.CALCULATED_FIELDS,
      DEFAULT_CALCULATED_FIELDS,
    );
    const metricIds = new Set(this.getMetrics().map((m) => m.id));
    // Merge in any new catalog defaults without clobbering enabled flags,
    // but only when the base metric still exists (cleared metrics stay gone).
    const byId = new Map(stored.map((f) => [f.id, f]));
    let changed = false;
    for (const def of DEFAULT_CALCULATED_FIELDS) {
      if (!byId.has(def.id) && metricIds.has(def.baseMetricId)) {
        byId.set(def.id, def);
        changed = true;
      }
    }
    const merged = [...byId.values()].filter((f) => metricIds.has(f.baseMetricId));
    if (changed || merged.length !== stored.length) {
      this.writeJson(STORAGE_KEYS.CALCULATED_FIELDS, merged);
    }
    return merged;
  }

  saveCalculatedFields(fields: CalculatedFieldDefinition[]) {
    this.writeJson(STORAGE_KEYS.CALCULATED_FIELDS, fields);
    this.notify();
  }

  updateCalculatedField(updated: CalculatedFieldDefinition) {
    this.saveCalculatedFields(
      this.getCalculatedFields().map((f) =>
        f.id === updated.id ? updated : f,
      ),
    );
  }

  getCoaches(): Coach[] {
    return this.readJson(STORAGE_KEYS.COACHES, DEFAULT_COACHES);
  }

  saveCoaches(coaches: Coach[]) {
    this.writeJson(STORAGE_KEYS.COACHES, coaches);
    this.notify();
  }

  addCoach(coach: Omit<Coach, 'id'>): Coach {
    const coaches = this.getCoaches();
    const newCoach: Coach = {
      ...coach,
      id: `coach_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    coaches.push(newCoach);
    this.saveCoaches(coaches);
    return newCoach;
  }

  deleteCoach(id: string) {
    this.saveCoaches(this.getCoaches().filter((c) => c.id !== id));
    this.saveCoachBallots(this.getCoachBallots().filter((b) => b.coachId !== id));
    const txs = this.getBumpTransactions();
    const next = txs.filter((tx) => tx.coachId !== id);
    if (next.length !== txs.length) {
      this.saveBumpTransactions(next);
    }
  }

  getCoachBallots(): CoachBallot[] {
    return this.readJson(STORAGE_KEYS.COACH_BALLOTS, DEFAULT_COACH_BALLOTS);
  }

  saveCoachBallots(ballots: CoachBallot[]) {
    this.writeJson(STORAGE_KEYS.COACH_BALLOTS, ballots);
    this.notify();
  }

  saveCoachBallot(ballot: CoachBallot) {
    const ballots = this.getCoachBallots();
    const idx = ballots.findIndex((b) => b.coachId === ballot.coachId);
    if (idx >= 0) {
      ballots[idx] = ballot;
    } else {
      ballots.push(ballot);
    }
    this.saveCoachBallots(ballots);
  }

  getBumpTransactions(): AdjustedBumpTransaction[] {
    const raw = this.readJson<unknown>(
      STORAGE_KEYS.ADJUSTED_BUMPS,
      DEFAULT_ADJUSTED_BUMPS,
    );
    const parsed = parseStoredBumpTransactions(raw);
    // Persist migration from legacy net map → transactions once.
    if (
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      parsed.length > 0
    ) {
      this.writeJson(STORAGE_KEYS.ADJUSTED_BUMPS, parsed);
    }
    return parsed;
  }

  saveBumpTransactions(transactions: AdjustedBumpTransaction[]) {
    this.writeJson(STORAGE_KEYS.ADJUSTED_BUMPS, transactions);
    this.notify();
  }

  /** Derived playerId → net bump (for ranking / budget). */
  getAdjustedBumps(): Record<string, number> {
    return netBumpsFromTransactions(this.getBumpTransactions());
  }

  /**
   * Replace the bump ledger. Accepts a net map (clears / restores nets as
   * legacy-style unit txs) or an empty object to clear all.
   */
  saveAdjustedBumps(bumps: Record<string, number>) {
    this.saveBumpTransactions(
      Object.keys(bumps).length === 0
        ? []
        : parseStoredBumpTransactions(bumps),
    );
  }

  applyBump(playerId: string, delta: 1 | -1, coachId: string): boolean {
    if (!coachId) return false;
    const budget = this.getBumpBudget();
    const bumps = this.getAdjustedBumps();
    if (!canApplyBump(bumps, budget, playerId, delta)) {
      return false;
    }
    const txs = [
      ...this.getBumpTransactions(),
      createBumpTransaction(playerId, coachId, delta),
    ];
    this.saveBumpTransactions(txs);
    return true;
  }

  clearPlayerBumps(playerId: string) {
    this.saveBumpTransactions(
      this.getBumpTransactions().filter((tx) => tx.playerId !== playerId),
    );
  }

  getBumpBudget(): AdjustedBumpConfig {
    return this.readJson(STORAGE_KEYS.BUMP_BUDGET, DEFAULT_BUMP_BUDGET);
  }

  saveBumpBudget(budget: AdjustedBumpConfig) {
    this.writeJson(STORAGE_KEYS.BUMP_BUDGET, {
      plusBudget: Math.max(0, Math.floor(budget.plusBudget)),
      minusBudget: Math.max(0, Math.floor(budget.minusBudget)),
    });
    this.notify();
  }

  getComplianceRequirements(): ComplianceRequirement[] {
    const hadKey =
      this.store.getItem(STORAGE_KEYS.COMPLIANCE_REQUIREMENTS) != null;
    const list = this.readJson(
      STORAGE_KEYS.COMPLIANCE_REQUIREMENTS,
      DEFAULT_COMPLIANCE_REQUIREMENTS,
    );
    // First seed: mark current roster complete for blocking items so Adjusted
    // ranks do not empty out until coaches edit checklists.
    if (!hadKey) {
      const players = this.getPlayers();
      const compliance = this.getPlayerCompliance();
      if (players.length > 0 && Object.keys(compliance).length === 0) {
        const seeded: PlayerComplianceState = {};
        const now = new Date().toISOString();
        for (const p of players) {
          seeded[p.id] = {};
          for (const req of list) {
            if (!req.blocksPlay) continue;
            seeded[p.id][req.id] = { complete: true, completedAt: now };
          }
        }
        this.writeJson(STORAGE_KEYS.PLAYER_COMPLIANCE, seeded);
      }
    }
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  saveComplianceRequirements(requirements: ComplianceRequirement[]) {
    this.writeJson(STORAGE_KEYS.COMPLIANCE_REQUIREMENTS, requirements);
    this.notify();
  }

  addComplianceRequirement(
    req: Omit<ComplianceRequirement, 'id'>,
  ): ComplianceRequirement {
    const list = this.getComplianceRequirements();
    const idBase =
      req.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'req';
    const newReq: ComplianceRequirement = {
      ...req,
      id: `req_${idBase}_${Date.now().toString(36)}`,
    };
    list.push(newReq);
    this.saveComplianceRequirements(list);
    return newReq;
  }

  updateComplianceRequirement(updated: ComplianceRequirement) {
    this.saveComplianceRequirements(
      this.getComplianceRequirements().map((r) =>
        r.id === updated.id ? updated : r,
      ),
    );
  }

  deleteComplianceRequirement(id: string) {
    this.saveComplianceRequirements(
      this.getComplianceRequirements().filter((r) => r.id !== id),
    );
    const state = this.getPlayerCompliance();
    let changed = false;
    for (const playerId of Object.keys(state)) {
      if (state[playerId]?.[id] !== undefined) {
        delete state[playerId][id];
        changed = true;
      }
    }
    if (changed) this.savePlayerCompliance(state);
  }

  getPlayerCompliance(): PlayerComplianceState {
    return this.readJson(
      STORAGE_KEYS.PLAYER_COMPLIANCE,
      DEFAULT_PLAYER_COMPLIANCE,
    );
  }

  savePlayerCompliance(state: PlayerComplianceState) {
    this.writeJson(STORAGE_KEYS.PLAYER_COMPLIANCE, state);
    this.notify();
  }

  setPlayerRequirementComplete(
    playerId: string,
    requirementId: string,
    complete: boolean,
    note?: string,
  ) {
    const state = this.getPlayerCompliance();
    const playerState = { ...(state[playerId] ?? {}) };
    playerState[requirementId] = {
      complete,
      completedAt: complete ? new Date().toISOString() : undefined,
      note: note ?? playerState[requirementId]?.note,
    };
    this.savePlayerCompliance({ ...state, [playerId]: playerState });
  }

  getEquipmentGroups(): EquipmentGroup[] {
    return this.readJson(
      STORAGE_KEYS.EQUIPMENT_GROUPS,
      DEFAULT_EQUIPMENT_GROUPS,
    );
  }

  saveEquipmentGroups(groups: EquipmentGroup[]) {
    this.writeJson(STORAGE_KEYS.EQUIPMENT_GROUPS, groups);
    this.notify();
  }

  addEquipmentGroup(group: Omit<EquipmentGroup, 'id'>): EquipmentGroup {
    const groups = this.getEquipmentGroups();
    const newGroup: EquipmentGroup = {
      ...group,
      id: `eqg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    groups.push(newGroup);
    this.saveEquipmentGroups(groups);
    return newGroup;
  }

  updateEquipmentGroup(updated: EquipmentGroup) {
    this.saveEquipmentGroups(
      this.getEquipmentGroups().map((g) =>
        g.id === updated.id ? updated : g,
      ),
    );
  }

  deleteEquipmentGroup(id: string) {
    this.saveEquipmentGroups(
      this.getEquipmentGroups().filter((g) => g.id !== id),
    );
    this.saveEquipmentItems(
      this.getEquipmentItems().filter((item) => item.groupId !== id),
    );
  }

  getEquipmentItems(): EquipmentItem[] {
    return this.readJson(STORAGE_KEYS.EQUIPMENT_ITEMS, DEFAULT_EQUIPMENT_ITEMS);
  }

  saveEquipmentItems(items: EquipmentItem[]) {
    this.writeJson(STORAGE_KEYS.EQUIPMENT_ITEMS, items);
    this.notify();
  }

  addEquipmentItem(
    item: Omit<EquipmentItem, 'id' | 'status'> & {
      status?: EquipmentItem['status'];
    },
  ): EquipmentItem {
    const items = this.getEquipmentItems();
    const newItem: EquipmentItem = {
      ...item,
      id: `eqi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: item.status ?? 'available',
    };
    items.push(newItem);
    this.saveEquipmentItems(items);
    return newItem;
  }

  updateEquipmentItem(updated: EquipmentItem) {
    this.saveEquipmentItems(
      this.getEquipmentItems().map((item) =>
        item.id === updated.id ? updated : item,
      ),
    );
  }

  deleteEquipmentItem(id: string) {
    this.saveEquipmentItems(
      this.getEquipmentItems().filter((item) => item.id !== id),
    );
  }

  assignEquipmentItem(itemId: string, playerId: string): boolean {
    const items = this.getEquipmentItems();
    const item = items.find((i) => i.id === itemId);
    if (!item || item.status === 'retired') return false;
    if (item.status === 'assigned' && item.assignedPlayerId !== playerId) {
      return false;
    }
    this.saveEquipmentItems(
      items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status: 'assigned' as const,
              assignedPlayerId: playerId,
              assignedAt: new Date().toISOString(),
            }
          : i,
      ),
    );
    return true;
  }

  returnEquipmentItem(itemId: string): boolean {
    const items = this.getEquipmentItems();
    const item = items.find((i) => i.id === itemId);
    if (!item || item.status !== 'assigned') return false;
    this.saveEquipmentItems(
      items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status: 'available' as const,
              assignedPlayerId: undefined,
              assignedAt: undefined,
            }
          : i,
      ),
    );
    return true;
  }

  getRankingBoundaries(): RankingBoundariesConfig {
    const raw = this.readJson(
      STORAGE_KEYS.RANKING_BOUNDARIES,
      DEFAULT_RANKING_BOUNDARIES,
    );
    return {
      primaryCut: Math.max(1, Math.floor(raw.primaryCut ?? 18)),
      secondaryCut: Math.max(1, Math.floor(raw.secondaryCut ?? 36)),
      specialtyCuts: { GK: 4, ...(raw.specialtyCuts ?? {}) },
    };
  }

  saveRankingBoundaries(config: RankingBoundariesConfig) {
    this.writeJson(STORAGE_KEYS.RANKING_BOUNDARIES, {
      primaryCut: Math.max(1, Math.floor(config.primaryCut)),
      secondaryCut: Math.max(1, Math.floor(config.secondaryCut)),
      specialtyCuts: config.specialtyCuts ?? {},
    });
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
    this.saveCalculatedFields(DEFAULT_CALCULATED_FIELDS);
    this.saveCoaches(DEFAULT_COACHES);
    this.saveCoachBallots(DEFAULT_COACH_BALLOTS);
    this.saveBumpTransactions(DEFAULT_ADJUSTED_BUMPS);
    this.saveBumpBudget(DEFAULT_BUMP_BUDGET);
    this.saveComplianceRequirements(DEFAULT_COMPLIANCE_REQUIREMENTS);
    this.savePlayerCompliance(DEFAULT_PLAYER_COMPLIANCE);
    this.saveEquipmentGroups(DEFAULT_EQUIPMENT_GROUPS);
    this.saveEquipmentItems(DEFAULT_EQUIPMENT_ITEMS);
    this.saveRankingBoundaries(DEFAULT_RANKING_BOUNDARIES);
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
      calculatedFields: this.getCalculatedFields(),
      coaches: this.getCoaches(),
      coachBallots: this.getCoachBallots(),
      adjustedBumps: this.getAdjustedBumps(),
      bumpTransactions: this.getBumpTransactions(),
      bumpBudget: this.getBumpBudget(),
      complianceRequirements: this.getComplianceRequirements(),
      playerCompliance: this.getPlayerCompliance(),
      equipmentGroups: this.getEquipmentGroups(),
      equipmentItems: this.getEquipmentItems(),
      rankingBoundaries: this.getRankingBoundaries(),
    };
  }

  exportFullBackupJSON(): string {
    const backup = {
      version: '2.6',
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
        if (data.calculatedFields) {
          this.saveCalculatedFields(data.calculatedFields);
        }
        if (data.coaches) this.saveCoaches(data.coaches);
        if (data.coachBallots) this.saveCoachBallots(data.coachBallots);
        if (Array.isArray(data.bumpTransactions)) {
          this.saveBumpTransactions(
            parseStoredBumpTransactions(data.bumpTransactions),
          );
        } else if (data.adjustedBumps) {
          this.saveAdjustedBumps(data.adjustedBumps);
        }
        if (data.bumpBudget) this.saveBumpBudget(data.bumpBudget);
        if (data.complianceRequirements) {
          this.saveComplianceRequirements(data.complianceRequirements);
        }
        if (data.playerCompliance) {
          this.savePlayerCompliance(data.playerCompliance);
        }
        if (data.equipmentGroups) {
          this.saveEquipmentGroups(data.equipmentGroups);
        }
        if (data.equipmentItems) {
          this.saveEquipmentItems(data.equipmentItems);
        }
        if (data.rankingBoundaries) {
          this.saveRankingBoundaries(data.rankingBoundaries);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
