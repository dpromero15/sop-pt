export type SyncFailureKind = 'transient' | 'auth' | 'fatal';

/**
 * Classify a sync/hydrate error so the chip can retry network blips
 * without looking like a hard failure.
 */
export function classifySyncFailure(message: string): SyncFailureKind {
  const m = message.toLowerCase();
  if (
    m.includes('not signed in') ||
    /api 401\b/.test(m) ||
    /api 403\b/.test(m)
  ) {
    return 'auth';
  }
  if (
    m.includes('unreachable') ||
    m.includes('timed out') ||
    m.includes('timeout') ||
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network error') ||
    m.includes('abort') ||
    m.includes('load failed') ||
    /api 429\b/.test(m) ||
    /api 5\d\d\b/.test(m)
  ) {
    return 'transient';
  }
  return 'fatal';
}

export function isTransientSyncFailure(message: string): boolean {
  return classifySyncFailure(message) === 'transient';
}
