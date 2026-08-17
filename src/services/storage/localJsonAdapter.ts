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
  CoachPositionBallot,
  AdjustedBumpConfig,
  AdjustedBumpTransaction,
  ComplianceRequirement,
  PlayerComplianceState,
  EquipmentGroup,
  EquipmentItem,
  RankingBoundariesConfig,
  PositionDefinition,
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
  DEFAULT_COACH_POSITION_BALLOTS,
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
  generateUniquePublicId,
  normalizePublicId,
} from '../../utils/playerPublicId';
import {
  ATTENDANCE_METRIC_ID,
  defaultMetricIdsForSessionType,
  ensureAttendanceFirst,
  migrateSessionsMetricIds,
  normalizeSessionStatus,
  sortSessionsNewestFirst,
  type LegacySession,
} from '../../utils/sessionMetrics';
import { migrateMetricsAggregation } from '../../utils/metricAggregation';
import {
  ATTENDANCE_LABEL,
  attendanceOnlyFormula,
  ensureAttendanceFormulaWeight,
  ensureAttendanceLabel,
  pruneFormulaWeightsToLabels,
} from '../../utils/formulaWeights';
import { normalizeRankingBoundaries } from '../../utils/rankingBoundaries';
import {
  cloneDefaultPlayerPositions,
  normalizePlayerPositions,
  playerPositionCodes,
  setActivePositionCatalog,
} from '../../utils/playerPositions';
import { normalizeMetricLabels } from '../../utils/metricLabels';
import {
  allocateLabelId,
  canParentHaveChildren,
  deleteLabelBlockReason,
  isRootLabel,
  normalizeLabelForest,
  parentIdsOf,
  primaryParentIdOf,
} from '../../utils/labelTree';
import { normalizeComplianceRequirements } from '../../utils/normalizeCompliance';
import {
  isPastSoftDeleteRetention,
  isSoftDeleted,
  withoutDeletedAt,
} from '../../utils/softDelete';
import {
  canApplyBump,
  createBumpTransaction,
  netBumpsFromTransactions,
  parseStoredBumpTransactions,
} from '../../utils/adjustedBumps';
import {
  ACTIVE_TEAM_KEY,
  STORAGE_KEYS,
  scopedStorageKey,
} from './storageKeys';
import {
  runLocalMigrations,
  writeStoredSchemaVersion,
} from '../migrations/runner';

export { STORAGE_KEYS } from './storageKeys';

export type StorageChangeListener = (key?: string) => void;

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
  private teamScopeId: string;
  /** When true, missing keys return empty/fallback without seeding sample data. */
  private holdSeeds = false;
  private silent = 0;

  constructor(store?: LocalStorageLike) {
    this.store =
      store ??
      (typeof localStorage !== 'undefined' ? localStorage : createMemoryStorage());
    this.teamScopeId = this.resolveInitialScope();
  }

  getTeamScopeId(): string {
    return this.teamScopeId;
  }

  /**
   * Switch the local cache namespace. `holdSeeds` avoids writing Thunder FC
   * sample data while a cloud hydrate is in flight.
   */
  setTeamScope(teamId: string, opts?: { holdSeeds?: boolean }): void {
    const next = teamId.trim();
    if (!next) return;
    const changed = next !== this.teamScopeId;
    this.teamScopeId = next;
    this.holdSeeds = opts?.holdSeeds ?? false;
    try {
      this.store.setItem(ACTIVE_TEAM_KEY, next);
    } catch {
      /* ignore */
    }
    if (changed) this.notify();
  }

  setHoldSeeds(value: boolean): void {
    this.holdSeeds = value;
  }

  subscribe(listener: StorageChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private resolveInitialScope(): string {
    try {
      const remembered = this.store.getItem(ACTIVE_TEAM_KEY)?.trim();
      if (remembered) return remembered;
      const raw = this.store.getItem(STORAGE_KEYS.TEAM);
      if (raw) {
        const team = JSON.parse(raw) as { id?: string };
        if (team?.id) return team.id;
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_TEAM.id;
  }

  private scoped(key: string): string {
    return scopedStorageKey(this.teamScopeId, key);
  }

  private notify(key?: string) {
    if (this.silent > 0) return;
    this.listeners.forEach((fn) => fn(key));
  }

  private parseJson<T>(raw: string | null, fallback: T): T {
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private emptyWhenHolding<T>(key: string, fallback: T): T {
    if (Array.isArray(fallback)) return [] as T;
    if (key === STORAGE_KEYS.TEAM) {
      return {
        ...(fallback as Team),
        id: this.teamScopeId,
        name: '',
        shortName: '',
      } as T;
    }
    if (key === STORAGE_KEYS.PLAYER_COMPLIANCE) {
      return {} as T;
    }
    // Never seed the Thunder FC demo formula into an empty workspace.
    if (key === STORAGE_KEYS.FORMULA) {
      return attendanceOnlyFormula() as T;
    }
    return fallback;
  }

  private readJson<T>(key: string, fallback: T): T {
    const scopedRaw = this.store.getItem(this.scoped(key));
    if (scopedRaw != null) return this.parseJson(scopedRaw, fallback);

    const legacyRaw = this.store.getItem(key);
    if (legacyRaw != null) return this.parseJson(legacyRaw, fallback);

    if (this.holdSeeds) return this.emptyWhenHolding(key, fallback);

    this.writeJson(key, fallback);
    return fallback;
  }

  private writeJson(key: string, value: unknown) {
    this.store.setItem(this.scoped(key), JSON.stringify(value));
    this.notify(key);
  }

  /** Apply a cloud/backup snapshot without marking every write dirty. */
  applySnapshot(snapshot: TeamSnapshot, opts?: { migrate?: boolean }): void {
    this.silent += 1;
    try {
      if (snapshot.team) this.saveTeam(snapshot.team);
      // Use Array.isArray so empty collections persist (truthy `if (arr)` skips []).
      if (Array.isArray(snapshot.players)) this.savePlayers(snapshot.players);
      if (Array.isArray(snapshot.sessions)) this.saveSessions(snapshot.sessions);
      if (Array.isArray(snapshot.entries)) this.saveEntries(snapshot.entries);
      if (Array.isArray(snapshot.metrics)) this.saveMetrics(snapshot.metrics);
      if (Array.isArray(snapshot.labels)) this.saveLabels(snapshot.labels);
      if (snapshot.formula != null) this.saveFormula(snapshot.formula);
      if (Array.isArray(snapshot.calculatedFields)) {
        this.saveCalculatedFields(snapshot.calculatedFields);
      }
      if (Array.isArray(snapshot.coaches)) this.saveCoaches(snapshot.coaches);
      if (Array.isArray(snapshot.coachBallots)) {
        this.saveCoachBallots(snapshot.coachBallots);
      }
      if (Array.isArray(snapshot.coachPositionBallots)) {
        this.saveCoachPositionBallots(snapshot.coachPositionBallots);
      }
      if (Array.isArray(snapshot.bumpTransactions)) {
        this.saveBumpTransactions(snapshot.bumpTransactions);
      } else if (snapshot.adjustedBumps) {
        this.saveAdjustedBumps(snapshot.adjustedBumps);
      }
      if (snapshot.bumpBudget != null) this.saveBumpBudget(snapshot.bumpBudget);
      if (Array.isArray(snapshot.complianceRequirements)) {
        this.saveComplianceRequirements(snapshot.complianceRequirements);
      }
      if (snapshot.playerCompliance != null) {
        this.savePlayerCompliance(snapshot.playerCompliance);
      }
      if (Array.isArray(snapshot.equipmentGroups)) {
        this.saveEquipmentGroups(snapshot.equipmentGroups);
      }
      if (Array.isArray(snapshot.equipmentItems)) {
        this.saveEquipmentItems(snapshot.equipmentItems);
      }
      if (snapshot.rankingBoundaries != null) {
        this.saveRankingBoundaries(snapshot.rankingBoundaries);
      }
      if (Array.isArray(snapshot.positions)) {
        this.savePositions(snapshot.positions);
      }
      if (opts?.migrate !== false) {
        writeStoredSchemaVersion(this.store, 0);
        runLocalMigrations(this.store);
      }
    } finally {
      this.silent -= 1;
      this.notify();
    }
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

  getPlayers(opts?: { includeDeleted?: boolean }): Player[] {
    const all = this.readJson(STORAGE_KEYS.PLAYERS, INITIAL_PLAYERS);
    return opts?.includeDeleted ? all : all.filter((p) => !isSoftDeleted(p));
  }

  getDeletedPlayers(): Player[] {
    return this.getPlayers({ includeDeleted: true })
      .filter((p) => isSoftDeleted(p))
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
  }

  savePlayers(players: Player[]) {
    const normalized = players.map((player) => {
      const codes = playerPositionCodes(player);
      const primary = codes[0] ?? player.position;
      return { ...player, position: primary, positions: codes };
    });
    this.writeJson(STORAGE_KEYS.PLAYERS, normalized);
    this.notify();
  }

  addPlayer(player: Omit<Player, 'id' | 'joinedDate'>): Player {
    const players = this.getPlayers({ includeDeleted: true });
    const taken = new Set(
      players
        .map((p) => normalizePublicId(p.publicId))
        .filter((id): id is string => Boolean(id)),
    );
    const requested = normalizePublicId(player.publicId);
    const publicId =
      requested && !taken.has(requested)
        ? requested
        : generateUniquePublicId(taken);
    const newPlayer: Player = {
      ...player,
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      publicId,
      joinedDate: new Date().toISOString().split('T')[0],
    };
    players.push(newPlayer);
    this.savePlayers(players);
    return newPlayer;
  }

  updatePlayer(updated: Player) {
    this.savePlayers(
      this.getPlayers({ includeDeleted: true }).map((p) =>
        p.id === updated.id ? updated : p,
      ),
    );
  }

  deletePlayer(id: string) {
    const now = new Date().toISOString();
    this.savePlayers(
      this.getPlayers({ includeDeleted: true }).map((p) =>
        p.id === id ? { ...p, deletedAt: now } : p,
      ),
    );
  }

  restorePlayer(id: string) {
    this.savePlayers(
      this.getPlayers({ includeDeleted: true }).map((p) =>
        p.id === id ? (withoutDeletedAt(p) as Player) : p,
      ),
    );
  }

  private hardDeletePlayer(id: string) {
    this.savePlayers(
      this.getPlayers({ includeDeleted: true }).filter((p) => p.id !== id),
    );
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

  getSessions(opts?: { includeDeleted?: boolean }): Session[] {
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
    const live = opts?.includeDeleted
      ? migrated
      : migrated.filter((s) => !isSoftDeleted(s));
    return sortSessionsNewestFirst(live);
  }

  getDeletedSessions(): Session[] {
    return this.getSessions({ includeDeleted: true })
      .filter((s) => isSoftDeleted(s))
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
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
    const sessions = this.getSessions({ includeDeleted: true });
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
    this.saveSessions(
      this.getSessions({ includeDeleted: true }).map((s) =>
        s.id === updated.id ? updated : s,
      ),
    );
  }

  deleteSession(id: string) {
    const now = new Date().toISOString();
    this.saveSessions(
      this.getSessions({ includeDeleted: true }).map((s) =>
        s.id === id ? { ...s, deletedAt: now } : s,
      ),
    );
  }

  restoreSession(id: string) {
    this.saveSessions(
      this.getSessions({ includeDeleted: true }).map((s) =>
        s.id === id ? (withoutDeletedAt(s) as Session) : s,
      ),
    );
  }

  private hardDeleteSession(id: string) {
    this.saveSessions(
      this.getSessions({ includeDeleted: true }).filter((s) => s.id !== id),
    );
    this.saveEntries(this.getEntries().filter((e) => e.sessionId !== id));
  }

  purgeExpiredDeletes(nowMs: number = Date.now()): {
    players: number;
    sessions: number;
  } {
    const expiredPlayers = this.getPlayers({ includeDeleted: true }).filter(
      (p) => isPastSoftDeleteRetention(p.deletedAt, nowMs),
    );
    for (const player of expiredPlayers) {
      this.hardDeletePlayer(player.id);
    }
    const expiredSessions = this.getSessions({ includeDeleted: true }).filter(
      (s) => isPastSoftDeleteRetention(s.deletedAt, nowMs),
    );
    for (const session of expiredSessions) {
      this.hardDeleteSession(session.id);
    }
    return {
      players: expiredPlayers.length,
      sessions: expiredSessions.length,
    };
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
    const attendanceOnly = DEFAULT_METRICS.filter(
      (m) => m.id === ATTENDANCE_METRIC_ID || m.type === 'attendance',
    );
    const raw = this.readJson<unknown>(STORAGE_KEYS.METRICS, attendanceOnly);
    const { metrics, changed } = migrateMetricsAggregation(raw);
    let next = metrics;
    let shouldWrite = changed;
    if (!Array.isArray(raw) && metrics.length === 0) {
      next = attendanceOnly;
      shouldWrite = true;
    }
    const labels = this.getLabels();
    next = next.map((m) => {
      const { labelId: _legacy, ...rest } = normalizeMetricLabels(
        m,
        labels,
      ) as MetricDefinition & { labelId?: string };
      return rest;
    });
    const normalizedChanged = next.some((m, i) => {
      const prev = metrics[i];
      return (
        !prev ||
        m.labelIds.join(',') !== (prev.labelIds || []).join(',') ||
        m.primaryLabelId !== prev.primaryLabelId
      );
    });
    if (shouldWrite || normalizedChanged) {
      this.writeJson(STORAGE_KEYS.METRICS, next);
    }
    return next;
  }

  saveMetrics(metrics: MetricDefinition[]) {
    this.writeJson(STORAGE_KEYS.METRICS, metrics);
    this.notify();
  }

  addMetric(metric: Omit<MetricDefinition, 'id'>): MetricDefinition {
    const labels = this.getLabels();
    const normalized = normalizeMetricLabels(metric, labels);
    const metrics = this.getMetrics();
    const newMetric: MetricDefinition = {
      ...normalized,
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    metrics.push(newMetric);
    this.saveMetrics(metrics);
    return newMetric;
  }

  updateMetric(updated: MetricDefinition) {
    const labels = this.getLabels();
    const normalized = normalizeMetricLabels(updated, labels);
    this.saveMetrics(
      this.getMetrics().map((m) => (m.id === updated.id ? { ...normalized, id: updated.id } : m)),
    );
  }

  deleteMetric(id: string) {
    this.saveMetrics(this.getMetrics().filter((m) => m.id !== id));
  }

  getLabels(): LabelDefinition[] {
    const labels = this.readJson(STORAGE_KEYS.LABELS, [ATTENDANCE_LABEL]);
    const { labels: ensured, changed } = ensureAttendanceLabel(labels);
    const forest = normalizeLabelForest(ensured);
    if (changed || forest.changed) {
      this.writeJson(STORAGE_KEYS.LABELS, forest.labels);
    }
    return forest.labels;
  }

  saveLabels(labels: LabelDefinition[]) {
    this.writeJson(STORAGE_KEYS.LABELS, labels);
    this.notify();
  }

  addLabel(label: Omit<LabelDefinition, 'id'>): LabelDefinition {
    const labels = this.getLabels();
    const parentLabelIds = Array.from(
      new Set(
        (label.parentLabelIds?.length
          ? label.parentLabelIds
          : label.parentLabelId
            ? [label.parentLabelId]
            : []
        )
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    );
    for (const parentId of parentLabelIds) {
      const parent = labels.find((l) => l.id === parentId);
      if (!parent || !canParentHaveChildren(parent)) {
        throw new Error(
          'Subcategories can only be added under a non-system parent category.',
        );
      }
    }
    const primaryParentLabelId =
      (label.primaryParentLabelId?.trim() &&
      parentLabelIds.includes(label.primaryParentLabelId.trim())
        ? label.primaryParentLabelId.trim()
        : undefined) || parentLabelIds[0];
    const newLabel: LabelDefinition = {
      ...label,
      id: allocateLabelId(
        label.name,
        labels.map((l) => l.id),
      ),
    };
    if (parentLabelIds.length > 0) {
      newLabel.parentLabelIds = parentLabelIds;
      newLabel.primaryParentLabelId = primaryParentLabelId;
      newLabel.parentLabelId = primaryParentLabelId;
      const parent = labels.find((l) => l.id === primaryParentLabelId);
      if (parent) {
        newLabel.color = newLabel.color || parent.color;
        newLabel.badgeBg = newLabel.badgeBg || parent.badgeBg;
        newLabel.badgeText = newLabel.badgeText || parent.badgeText;
      }
    } else {
      delete newLabel.parentLabelIds;
      delete newLabel.primaryParentLabelId;
      delete newLabel.parentLabelId;
    }
    labels.push(newLabel);
    this.saveLabels(normalizeLabelForest(labels).labels);

    if (parentLabelIds.length === 0) {
      const formula = this.getFormula();
      if (!formula.weights.some((w) => w.labelId === newLabel.id)) {
        formula.weights.push({
          labelId: newLabel.id,
          weightPercent: 10,
          enabled: true,
        });
        this.saveFormula(formula);
      }
    }

    return newLabel;
  }

  updateLabel(updated: LabelDefinition) {
    const labels = this.getLabels();
    const existing = labels.find((l) => l.id === updated.id);
    if (!existing) return;
    const wasRoot = isRootLabel(existing);
    const next: LabelDefinition = {
      ...updated,
      // Preserve system flag from storage / migration
      system: existing.system || updated.system,
    };
    const forest = normalizeLabelForest(
      labels.map((l) => (l.id === updated.id ? next : l)),
    );
    const saved = forest.labels.find((l) => l.id === updated.id) ?? next;
    this.saveLabels(forest.labels);

    const nowRoot = isRootLabel(saved);
    if (wasRoot && !nowRoot) {
      const formula = this.getFormula();
      this.saveFormula({
        ...formula,
        weights: formula.weights.filter((w) => w.labelId !== saved.id),
      });
    } else if (!wasRoot && nowRoot) {
      const formula = this.getFormula();
      if (!formula.weights.some((w) => w.labelId === saved.id)) {
        formula.weights.push({
          labelId: saved.id,
          weightPercent: 10,
          enabled: true,
        });
        this.saveFormula(formula);
      }
    }
  }

  deleteLabel(id: string) {
    const labels = this.getLabels();
    const label = labels.find((l) => l.id === id);
    if (!label) return;
    const block = deleteLabelBlockReason(id, labels, this.getMetrics());
    if (block) {
      throw new Error(block);
    }

    const next = labels
      .filter((l) => l.id !== id)
      .map((l) => {
        const parents = parentIdsOf(l);
        if (!parents.includes(id)) return l;
        const remaining = parents.filter((p) => p !== id);
        if (remaining.length === 0) {
          const {
            parentLabelId: _a,
            parentLabelIds: _b,
            primaryParentLabelId: _c,
            ...rest
          } = l;
          return rest;
        }
        const primary = remaining.includes(primaryParentIdOf(l) ?? '')
          ? primaryParentIdOf(l)!
          : remaining[0];
        return {
          ...l,
          parentLabelIds: remaining,
          primaryParentLabelId: primary,
          parentLabelId: primary,
        };
      });
    this.saveLabels(normalizeLabelForest(next).labels);

    const formula = this.getFormula();
    this.saveFormula({
      ...formula,
      weights: formula.weights.filter((w) => w.labelId !== id),
    });
  }

  clearNonSystemLabels() {
    const labels = this.getLabels();
    const kept = labels.filter((l) => l.system || l.id === 'attendance');
    const { labels: ensured } = ensureAttendanceLabel(kept);
    const keptIds = new Set(ensured.map((l) => l.id));
    this.saveLabels(ensured);

    const formula = this.getFormula();
    const { formula: withAttendance } = ensureAttendanceFormulaWeight({
      ...formula,
      weights: formula.weights.filter((w) => keptIds.has(w.labelId)),
    });
    this.saveFormula(withAttendance);
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

    const sessions = this.getSessions({ includeDeleted: true }).map((s) => ({
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
    const stored = this.readJson(
      STORAGE_KEYS.FORMULA,
      attendanceOnlyFormula(),
    );
    const { formula, changed } = pruneFormulaWeightsToLabels(
      stored,
      this.getLabels(),
    );
    if (changed) {
      this.writeJson(STORAGE_KEYS.FORMULA, formula);
    }
    return formula;
  }

  saveFormula(formula: ScoringFormulaConfig) {
    const { formula: pruned } = pruneFormulaWeightsToLabels(
      formula,
      this.getLabels(),
    );
    this.writeJson(STORAGE_KEYS.FORMULA, pruned);
    this.notify();
  }

  getCalculatedFields(): CalculatedFieldDefinition[] {
    // Product no longer uses calculated fields; keep empty for snapshot shape.
    const stored = this.readJson<CalculatedFieldDefinition[]>(
      STORAGE_KEYS.CALCULATED_FIELDS,
      [],
    );
    if (stored.length > 0) {
      this.writeJson(STORAGE_KEYS.CALCULATED_FIELDS, []);
    }
    return [];
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
    this.saveCoachPositionBallots(
      this.getCoachPositionBallots().filter((b) => b.coachId !== id),
    );
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

  getCoachPositionBallots(): CoachPositionBallot[] {
    const raw = this.readJson(
      STORAGE_KEYS.COACH_POSITION_BALLOTS,
      DEFAULT_COACH_POSITION_BALLOTS,
    );
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (row): row is CoachPositionBallot =>
        Boolean(row) &&
        typeof row === 'object' &&
        typeof (row as CoachPositionBallot).coachId === 'string' &&
        typeof (row as CoachPositionBallot).position === 'string' &&
        (row as CoachPositionBallot).ranks != null &&
        typeof (row as CoachPositionBallot).ranks === 'object',
    );
  }

  saveCoachPositionBallots(ballots: CoachPositionBallot[]) {
    this.writeJson(STORAGE_KEYS.COACH_POSITION_BALLOTS, ballots);
    this.notify();
  }

  saveCoachPositionBallot(ballot: CoachPositionBallot) {
    const ballots = this.getCoachPositionBallots();
    const idx = ballots.findIndex(
      (row) => row.coachId === ballot.coachId && row.position === ballot.position,
    );
    if (idx >= 0) ballots[idx] = ballot;
    else ballots.push(ballot);
    this.saveCoachPositionBallots(ballots);
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
      this.store.getItem(this.scoped(STORAGE_KEYS.COMPLIANCE_REQUIREMENTS)) !=
        null ||
      this.store.getItem(STORAGE_KEYS.COMPLIANCE_REQUIREMENTS) != null;
    const list = normalizeComplianceRequirements(
      this.readJson(
        STORAGE_KEYS.COMPLIANCE_REQUIREMENTS,
        DEFAULT_COMPLIANCE_REQUIREMENTS,
      ),
    );
    // First seed: mark current roster complete for blocking items so Adjusted
    // ranks / practice eligibility do not empty out until coaches edit checklists.
    if (!hadKey) {
      const players = this.getPlayers();
      const compliance = this.getPlayerCompliance();
      if (players.length > 0 && Object.keys(compliance).length === 0) {
        const seeded: PlayerComplianceState = {};
        const now = new Date().toISOString();
        for (const p of players) {
          seeded[p.id] = {};
          for (const req of list) {
            if (
              !req.blocksPlay &&
              !req.blocksPractice &&
              req.blocksEquipment !== true
            ) {
              continue;
            }
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
    return normalizeRankingBoundaries(raw);
  }

  saveRankingBoundaries(config: RankingBoundariesConfig) {
    this.writeJson(
      STORAGE_KEYS.RANKING_BOUNDARIES,
      normalizeRankingBoundaries(config),
    );
    this.notify();
  }

  getPositions(): PositionDefinition[] {
    const catalog = normalizePlayerPositions(
      this.readJson(STORAGE_KEYS.POSITIONS, cloneDefaultPlayerPositions()),
    );
    setActivePositionCatalog(catalog);
    return catalog;
  }

  savePositions(positions: PositionDefinition[]) {
    const catalog = normalizePlayerPositions(positions);
    setActivePositionCatalog(catalog);
    this.writeJson(STORAGE_KEYS.POSITIONS, catalog);
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
    this.saveCoachPositionBallots(DEFAULT_COACH_POSITION_BALLOTS);
    this.saveBumpTransactions(DEFAULT_ADJUSTED_BUMPS);
    this.saveBumpBudget(DEFAULT_BUMP_BUDGET);
    this.saveComplianceRequirements(DEFAULT_COMPLIANCE_REQUIREMENTS);
    this.savePlayerCompliance(DEFAULT_PLAYER_COMPLIANCE);
    this.saveEquipmentGroups(DEFAULT_EQUIPMENT_GROUPS);
    this.saveEquipmentItems(DEFAULT_EQUIPMENT_ITEMS);
    this.saveRankingBoundaries(DEFAULT_RANKING_BOUNDARIES);
    this.savePositions(cloneDefaultPlayerPositions());
  }

  getSnapshot(): TeamSnapshot {
    return {
      team: this.getTeam(),
      players: this.getPlayers({ includeDeleted: true }),
      sessions: this.getSessions({ includeDeleted: true }),
      entries: this.getEntries(),
      metrics: this.getMetrics(),
      labels: this.getLabels(),
      formula: this.getFormula(),
      calculatedFields: this.getCalculatedFields(),
      coaches: this.getCoaches(),
      coachBallots: this.getCoachBallots(),
      coachPositionBallots: this.getCoachPositionBallots(),
      adjustedBumps: this.getAdjustedBumps(),
      bumpTransactions: this.getBumpTransactions(),
      bumpBudget: this.getBumpBudget(),
      complianceRequirements: this.getComplianceRequirements(),
      playerCompliance: this.getPlayerCompliance(),
      equipmentGroups: this.getEquipmentGroups(),
      equipmentItems: this.getEquipmentItems(),
      rankingBoundaries: this.getRankingBoundaries(),
      positions: this.getPositions(),
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
      if (
        Array.isArray(data.players) &&
        Array.isArray(data.sessions) &&
        Array.isArray(data.entries)
      ) {
        if (data.team) this.saveTeam(data.team);
        this.savePlayers(data.players);
        this.saveSessions(data.sessions);
        this.saveEntries(data.entries);
        if (Array.isArray(data.metrics)) this.saveMetrics(data.metrics);
        if (Array.isArray(data.labels)) this.saveLabels(data.labels);
        if (data.formula != null) this.saveFormula(data.formula);
        if (Array.isArray(data.calculatedFields)) {
          this.saveCalculatedFields(data.calculatedFields);
        }
        if (Array.isArray(data.coaches)) this.saveCoaches(data.coaches);
        if (Array.isArray(data.coachBallots)) {
          this.saveCoachBallots(data.coachBallots);
        }
        if (Array.isArray(data.coachPositionBallots)) {
          this.saveCoachPositionBallots(data.coachPositionBallots);
        }
        if (Array.isArray(data.bumpTransactions)) {
          this.saveBumpTransactions(
            parseStoredBumpTransactions(data.bumpTransactions),
          );
        } else if (data.adjustedBumps) {
          this.saveAdjustedBumps(data.adjustedBumps);
        }
        if (data.bumpBudget != null) this.saveBumpBudget(data.bumpBudget);
        if (Array.isArray(data.complianceRequirements)) {
          this.saveComplianceRequirements(data.complianceRequirements);
        }
        if (data.playerCompliance != null) {
          this.savePlayerCompliance(data.playerCompliance);
        }
        if (Array.isArray(data.equipmentGroups)) {
          this.saveEquipmentGroups(data.equipmentGroups);
        }
        if (Array.isArray(data.equipmentItems)) {
          this.saveEquipmentItems(data.equipmentItems);
        }
        if (data.rankingBoundaries != null) {
          this.saveRankingBoundaries(data.rankingBoundaries);
        }
        if (Array.isArray(data.positions)) {
          this.savePositions(data.positions);
        }
        writeStoredSchemaVersion(this.store, 0);
        runLocalMigrations(this.store);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
