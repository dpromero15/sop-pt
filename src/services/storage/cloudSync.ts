import { getAuthState, isLocalDebugMockAuth, refreshIdToken } from '../firebase';
import { StorageService } from '../storage';
import { ApiAdapter, type ConfigName } from './apiAdapter';
import { getApiBaseUrl, isForceLocal } from './connectionStatus';
import { STORAGE_KEYS } from './storageKeys';
import { __resetSyncLogForTests, appendSyncLog } from './syncLog';
import { classifySyncFailure } from './syncFailure';
import type { TeamSnapshot } from './types';

export type SyncUiStatus =
  | 'local-only'
  | 'offline'
  | 'hydrating'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error';

export type SyncBucket =
  | 'team'
  | 'players'
  | 'sessions'
  | 'entries'
  | 'metrics'
  | 'labels'
  | 'formula'
  | 'calculatedFields'
  | 'coaches'
  | 'coachBallots'
  | 'bumpTransactions'
  | 'bumpBudget'
  | 'complianceRequirements'
  | 'playerCompliance'
  | 'equipmentGroups'
  | 'equipmentItems'
  | 'rankingBoundaries'
  | 'positions'
  | 'subTeams'
  | 'coachPositionBallots';

const OUTBOX_KEY = 'stm_cloud_outbox_v1';
const DEBOUNCE_MS = 10_000;
const BACKOFF_MS = [5_000, 15_000, 30_000, 60_000];

const KEY_TO_BUCKET: Record<string, SyncBucket> = {
  [STORAGE_KEYS.TEAM]: 'team',
  [STORAGE_KEYS.PLAYERS]: 'players',
  [STORAGE_KEYS.SESSIONS]: 'sessions',
  [STORAGE_KEYS.ENTRIES]: 'entries',
  [STORAGE_KEYS.METRICS]: 'metrics',
  [STORAGE_KEYS.LABELS]: 'labels',
  [STORAGE_KEYS.FORMULA]: 'formula',
  [STORAGE_KEYS.CALCULATED_FIELDS]: 'calculatedFields',
  [STORAGE_KEYS.COACHES]: 'coaches',
  [STORAGE_KEYS.COACH_BALLOTS]: 'coachBallots',
  [STORAGE_KEYS.ADJUSTED_BUMPS]: 'bumpTransactions',
  [STORAGE_KEYS.BUMP_BUDGET]: 'bumpBudget',
  [STORAGE_KEYS.COMPLIANCE_REQUIREMENTS]: 'complianceRequirements',
  [STORAGE_KEYS.PLAYER_COMPLIANCE]: 'playerCompliance',
  [STORAGE_KEYS.EQUIPMENT_GROUPS]: 'equipmentGroups',
  [STORAGE_KEYS.EQUIPMENT_ITEMS]: 'equipmentItems',
  [STORAGE_KEYS.RANKING_BOUNDARIES]: 'rankingBoundaries',
  [STORAGE_KEYS.POSITIONS]: 'positions',
  [STORAGE_KEYS.SUB_TEAMS]: 'subTeams',
  [STORAGE_KEYS.COACH_POSITION_BALLOTS]: 'coachPositionBallots',
};

type OutboxState = Record<string, SyncBucket[]>;

type Listener = (status: SyncUiStatus, detail?: string) => void;

const listeners = new Set<Listener>();
let status: SyncUiStatus = 'local-only';
let detail: string | undefined;
let boundTeamId: string | null = null;
let unsubStorage: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let backoffIdx = 0;
let flushing = false;
let startedBrowserHooks = false;

function emit(next: SyncUiStatus, nextDetail?: string) {
  const changed = next !== status || nextDetail !== detail;
  status = next;
  detail = nextDetail;
  listeners.forEach((fn) => fn(status, detail));
  if (!changed) return;
  const level =
    next === 'error' ? 'error' : next === 'offline' ? 'warn' : 'info';
  appendSyncLog(level, nextDetail || next, {
    status: next,
    teamId: boundTeamId,
  });
}

export function getCloudSyncStatus(): {
  status: SyncUiStatus;
  detail?: string;
} {
  return { status, detail };
}

export function getPendingSyncBuckets(teamId?: string): SyncBucket[] {
  const id = teamId ?? boundTeamId;
  if (!id) return [];
  return [...dirtyFor(id)];
}

export function subscribeCloudSync(listener: Listener): () => void {
  listeners.add(listener);
  listener(status, detail);
  return () => listeners.delete(listener);
}

function cloudEnabled(): boolean {
  if (isLocalDebugMockAuth()) return false;
  if (isForceLocal()) return false;
  if (!getApiBaseUrl()) return false;
  if (!getAuthState().signedIn) return false;
  return true;
}

function readOutbox(): OutboxState {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as OutboxState;
  } catch {
    return {};
  }
}

function writeOutbox(state: OutboxState) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function dirtyFor(teamId: string): Set<SyncBucket> {
  return new Set(readOutbox()[teamId] ?? []);
}

function markDirty(teamId: string, bucket: SyncBucket) {
  const all = readOutbox();
  const set = new Set(all[teamId] ?? []);
  const already = set.has(bucket);
  set.add(bucket);
  all[teamId] = [...set];
  writeOutbox(all);
  if (status !== 'syncing' && status !== 'hydrating') {
    emit('pending');
  }
  if (flushing) {
    if (!already) {
      appendSyncLog('info', `Queued ${bucket} during flush`, {
        buckets: [bucket],
        teamId,
        status: 'pending',
      });
    }
    return;
  }
  const data = payloadFor(bucket, StorageService.getSnapshot());
  const emptySquad =
    (bucket === 'players' ||
      bucket === 'sessions' ||
      bucket === 'entries') &&
    Array.isArray(data) &&
    data.length === 0;
  if (emptySquad) scheduleFlushSoon();
  else scheduleFlush();
}

function clearDirty(teamId: string, buckets: SyncBucket[]) {
  const all = readOutbox();
  const set = new Set(all[teamId] ?? []);
  buckets.forEach((b) => set.delete(b));
  if (set.size === 0) delete all[teamId];
  else all[teamId] = [...set];
  writeOutbox(all);
}

async function authToken(): Promise<string | null> {
  let token = getAuthState().idToken;
  if (!token) token = await refreshIdToken();
  return token;
}

function localHasSquadData(): boolean {
  return (
    StorageService.getPlayers({ includeDeleted: true }).length > 0 ||
    StorageService.getSessions({ includeDeleted: true }).length > 0 ||
    StorageService.getEntries().length > 0
  );
}

function remoteHasSquadData(snap: TeamSnapshot): boolean {
  return (
    (snap.players?.length ?? 0) > 0 ||
    (snap.sessions?.length ?? 0) > 0 ||
    (snap.entries?.length ?? 0) > 0
  );
}

function payloadFor(bucket: SyncBucket, snap: TeamSnapshot): unknown {
  switch (bucket) {
    case 'team':
      return snap.team;
    case 'players':
      return snap.players;
    case 'sessions':
      return snap.sessions;
    case 'entries':
      return snap.entries;
    case 'metrics':
      return snap.metrics;
    case 'labels':
      return snap.labels;
    case 'formula':
      return snap.formula;
    case 'calculatedFields':
      return snap.calculatedFields;
    case 'coaches':
      return snap.coaches;
    case 'coachBallots':
      return snap.coachBallots;
    case 'bumpTransactions':
      return snap.bumpTransactions ?? [];
    case 'bumpBudget':
      return snap.bumpBudget;
    case 'complianceRequirements':
      return snap.complianceRequirements ?? [];
    case 'playerCompliance':
      return snap.playerCompliance ?? {};
    case 'equipmentGroups':
      return snap.equipmentGroups ?? [];
    case 'equipmentItems':
      return snap.equipmentItems ?? [];
    case 'rankingBoundaries':
      return snap.rankingBoundaries;
    case 'positions':
      return snap.positions ?? [];
    case 'subTeams':
      return snap.subTeams ?? [];
    case 'coachPositionBallots':
      return snap.coachPositionBallots ?? [];
    default:
      return null;
  }
}

/** Prefer local snapshot values for every dirty outbox bucket. */
function overlayDirtyLocal(
  remoteMerged: TeamSnapshot,
  dirty: Set<SyncBucket>,
): TeamSnapshot {
  if (dirty.size === 0) return remoteMerged;
  const local = StorageService.getSnapshot();
  const next: TeamSnapshot = { ...remoteMerged };
  for (const bucket of dirty) {
    const data = payloadFor(bucket, local);
    switch (bucket) {
      case 'team':
        if (data) next.team = data as TeamSnapshot['team'];
        break;
      case 'players':
        next.players = data as TeamSnapshot['players'];
        break;
      case 'sessions':
        next.sessions = data as TeamSnapshot['sessions'];
        break;
      case 'entries':
        next.entries = data as TeamSnapshot['entries'];
        break;
      case 'metrics':
        next.metrics = data as TeamSnapshot['metrics'];
        break;
      case 'labels':
        next.labels = data as TeamSnapshot['labels'];
        break;
      case 'formula':
        if (data != null) next.formula = data as TeamSnapshot['formula'];
        break;
      case 'calculatedFields':
        next.calculatedFields = data as TeamSnapshot['calculatedFields'];
        break;
      case 'coaches':
        next.coaches = data as TeamSnapshot['coaches'];
        break;
      case 'coachBallots':
        next.coachBallots = data as TeamSnapshot['coachBallots'];
        break;
      case 'bumpTransactions':
        next.bumpTransactions = data as TeamSnapshot['bumpTransactions'];
        break;
      case 'bumpBudget':
        if (data != null) next.bumpBudget = data as TeamSnapshot['bumpBudget'];
        break;
      case 'complianceRequirements':
        next.complianceRequirements =
          data as TeamSnapshot['complianceRequirements'];
        break;
      case 'playerCompliance':
        next.playerCompliance = data as TeamSnapshot['playerCompliance'];
        break;
      case 'equipmentGroups':
        next.equipmentGroups = data as TeamSnapshot['equipmentGroups'];
        break;
      case 'equipmentItems':
        next.equipmentItems = data as TeamSnapshot['equipmentItems'];
        break;
      case 'rankingBoundaries':
        if (data != null) {
          next.rankingBoundaries = data as TeamSnapshot['rankingBoundaries'];
        }
        break;
      case 'positions':
        next.positions = data as TeamSnapshot['positions'];
        break;
      case 'subTeams':
        next.subTeams = data as TeamSnapshot['subTeams'];
        break;
      case 'coachPositionBallots':
        next.coachPositionBallots =
          data as TeamSnapshot['coachPositionBallots'];
        break;
      default:
        break;
    }
  }
  return next;
}

function ensureSquadArrays(snap: TeamSnapshot): TeamSnapshot {
  return {
    ...snap,
    players: Array.isArray(snap.players) ? snap.players : [],
    sessions: Array.isArray(snap.sessions) ? snap.sessions : [],
    entries: Array.isArray(snap.entries) ? snap.entries : [],
  };
}

/** Chip stays Pending/Retrying on network blips; auth/fatal stay Sync error. */
function applySyncFailure(
  message: string,
  teamId: string,
  buckets?: SyncBucket[],
): void {
  const offline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  const kind = classifySyncFailure(message);
  if (offline) {
    appendSyncLog('warn', message, {
      teamId,
      buckets,
      status: 'offline',
    });
    emit('offline');
    return;
  }
  if (kind === 'transient') {
    appendSyncLog('warn', message, {
      teamId,
      buckets,
      status: 'pending',
    });
    emit('pending', 'Retrying…');
    return;
  }
  emit('error', message);
}

async function flushTeam(teamId: string): Promise<void> {
  if (!cloudEnabled() || flushing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    emit('offline');
    return;
  }

  const buckets = [...dirtyFor(teamId)];
  if (buckets.length === 0) {
    emit('synced');
    return;
  }

  const token = await authToken();
  if (!token) {
    emit('error', 'Not signed in.');
    return;
  }

  flushing = true;
  emit('syncing');
  appendSyncLog('info', `Flushing ${buckets.join(', ')}`, {
    buckets,
    teamId,
    status: 'syncing',
  });
  const api = new ApiAdapter(getApiBaseUrl());
  const snap = StorageService.getSnapshot();
  const done: SyncBucket[] = [];

  try {
    for (const bucket of buckets) {
      const data = payloadFor(bucket, snap);
      if (bucket === 'team') {
        await api.putTeam(teamId, data, token);
      } else if (
        bucket === 'players' ||
        bucket === 'sessions' ||
        bucket === 'entries'
      ) {
        await api.putCollection(teamId, bucket, data as unknown[], token);
      } else {
        await api.putConfig(teamId, bucket as ConfigName, data, token);
      }
      done.push(bucket);
    }
    clearDirty(teamId, done);
    backoffIdx = 0;
    const still = dirtyFor(teamId);
    emit(still.size > 0 ? 'pending' : 'synced');
    if (still.size > 0) {
      appendSyncLog('info', `Flush done; still pending ${[...still].join(', ')}`, {
        buckets: [...still],
        teamId,
        status: 'pending',
      });
      scheduleFlushSoon();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    applySyncFailure(message, teamId, buckets);
    const wait = BACKOFF_MS[Math.min(backoffIdx, BACKOFF_MS.length - 1)];
    backoffIdx += 1;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void flushTeam(teamId);
    }, wait);
  } finally {
    flushing = false;
  }
}

function scheduleFlush() {
  if (!boundTeamId || !cloudEnabled()) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (boundTeamId) void flushTeam(boundTeamId);
  }, DEBOUNCE_MS);
}

/** Cancel debounce and flush now (destructive clears, tab hide, tests). */
export async function flushNow(teamId?: string): Promise<void> {
  const id = teamId ?? boundTeamId;
  if (!id || !cloudEnabled()) return;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  await flushTeam(id);
}

function scheduleFlushSoon() {
  if (!boundTeamId || !cloudEnabled()) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  // Let synchronous multi-bucket clears (e.g. clearAllPlayers) mark dirty first.
  debounceTimer = setTimeout(() => {
    if (boundTeamId) void flushTeam(boundTeamId);
  }, 0);
}

function ensureBrowserHooks() {
  if (startedBrowserHooks || typeof window === 'undefined') return;
  startedBrowserHooks = true;
  window.addEventListener('online', () => {
    if (boundTeamId) void flushTeam(boundTeamId);
  });
  window.addEventListener('offline', () => emit('offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && boundTeamId) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      void flushTeam(boundTeamId);
    }
  });
}

export async function enterTeamCloudSync(teamId: string): Promise<void> {
  ensureBrowserHooks();

  if (unsubStorage) {
    unsubStorage();
    unsubStorage = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  boundTeamId = teamId;
  StorageService.setTeamScope(teamId, { holdSeeds: cloudEnabled() });

  unsubStorage = StorageService.subscribe((key) => {
    if (!key || !boundTeamId) return;
    const bucket = KEY_TO_BUCKET[key];
    if (bucket) markDirty(boundTeamId, bucket);
  });

  if (!cloudEnabled()) {
    StorageService.setHoldSeeds(false);
    emit('local-only');
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    StorageService.setHoldSeeds(false);
    emit(dirtyFor(teamId).size > 0 ? 'pending' : 'offline');
    return;
  }

  emit('hydrating');
  try {
    const token = await authToken();
    if (!token) {
      StorageService.setHoldSeeds(false);
      emit('error', 'Not signed in.');
      return;
    }
    const api = new ApiAdapter(getApiBaseUrl());
    const remote = await api.hydrate(teamId, token);
    const dirty = dirtyFor(teamId);
    const localData = localHasSquadData();

    if (!remoteHasSquadData(remote) && localData) {
      markDirty(teamId, 'team');
      markDirty(teamId, 'players');
      markDirty(teamId, 'sessions');
      markDirty(teamId, 'entries');
      markDirty(teamId, 'metrics');
      markDirty(teamId, 'labels');
      markDirty(teamId, 'formula');
      markDirty(teamId, 'calculatedFields');
      markDirty(teamId, 'positions');
      markDirty(teamId, 'subTeams');
      markDirty(teamId, 'coachPositionBallots');
      StorageService.setHoldSeeds(false);
      await flushTeam(teamId);
      return;
    }

    if (remoteHasSquadData(remote) || remote.team) {
      let next: TeamSnapshot = ensureSquadArrays({
        ...StorageService.getSnapshot(),
        ...remote,
      });
      next = ensureSquadArrays(overlayDirtyLocal(next, dirty));
      // Always persist squad arrays (incl. []) before releasing holdSeeds.
      StorageService.applySnapshot(next, { migrate: true });
    } else {
      // Persist empties so getPlayers() does not seed sample Thunder FC.
      StorageService.applySnapshot(
        ensureSquadArrays({
          ...StorageService.getSnapshot(),
          players: [],
          sessions: [],
          entries: [],
        }),
        { migrate: false },
      );
    }

    StorageService.setHoldSeeds(false);
    if (dirty.size > 0) {
      emit('pending');
      await flushNow(teamId);
    } else {
      backoffIdx = 0;
      emit('synced');
    }
  } catch (err) {
    StorageService.setHoldSeeds(false);
    const message = err instanceof Error ? err.message : 'Hydrate failed';
    applySyncFailure(message, teamId);
    if (status === 'pending' || status === 'offline') {
      const wait = BACKOFF_MS[Math.min(backoffIdx, BACKOFF_MS.length - 1)];
      backoffIdx += 1;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (boundTeamId) void enterTeamCloudSync(boundTeamId);
      }, wait);
    }
  }
}

export function stopCloudSync(): void {
  if (unsubStorage) {
    unsubStorage();
    unsubStorage = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  boundTeamId = null;
}

/** Test helper — not used in production UI. */
export function __resetCloudSyncForTests(): void {
  stopCloudSync();
  __resetSyncLogForTests();
  emit('local-only');
  backoffIdx = 0;
  flushing = false;
}
