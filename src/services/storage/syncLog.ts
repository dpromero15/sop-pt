export type SyncLogLevel = 'info' | 'warn' | 'error';

export interface SyncLogEvent {
  id: string;
  at: string;
  level: SyncLogLevel;
  message: string;
  status?: string;
  buckets?: string[];
  teamId?: string | null;
}

const LOG_KEY = 'stm_sync_log_v1';
const LOG_MAX = 80;

type Listener = (events: SyncLogEvent[]) => void;

let events: SyncLogEvent[] = [];
let loaded = false;
const listeners = new Set<Listener>();

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = storage()?.getItem(LOG_KEY);
    if (!raw) {
      events = [];
      return;
    }
    const parsed = JSON.parse(raw) as SyncLogEvent[];
    events = Array.isArray(parsed) ? parsed.slice(-LOG_MAX) : [];
  } catch {
    events = [];
  }
}

function persist(): void {
  try {
    storage()?.setItem(LOG_KEY, JSON.stringify(events));
  } catch {
    /* quota / private mode */
  }
}

export function getSyncLog(): SyncLogEvent[] {
  load();
  return events;
}

export function subscribeSyncLog(listener: Listener): () => void {
  load();
  listeners.add(listener);
  listener(events);
  return () => listeners.delete(listener);
}

export function appendSyncLog(
  level: SyncLogLevel,
  message: string,
  extra?: Partial<Omit<SyncLogEvent, 'id' | 'at' | 'level' | 'message'>>,
): SyncLogEvent {
  load();
  const event: SyncLogEvent = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    level,
    message,
    ...extra,
  };
  events = [...events, event].slice(-LOG_MAX);
  persist();
  listeners.forEach((fn) => fn(events));
  return event;
}

export function clearSyncLog(): void {
  events = [];
  loaded = true;
  try {
    storage()?.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(events));
}

/** Test helper. */
export function __resetSyncLogForTests(): void {
  events = [];
  loaded = false;
  listeners.clear();
}
