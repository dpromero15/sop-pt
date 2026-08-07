import { getAuthState, isFirebaseConfigured } from '../firebase';
import { ApiAdapter } from './apiAdapter';
import type { ConnectionStatus, StorageMode } from './types';

const FORCE_LOCAL_KEY = 'stm_force_local_v1';

export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';
}

export function isForceLocal(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(FORCE_LOCAL_KEY) === 'true';
}

export function setForceLocal(value: boolean) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(FORCE_LOCAL_KEY, value ? 'true' : 'false');
}

export async function checkConnectionStatus(): Promise<ConnectionStatus> {
  const apiConfigured = Boolean(getApiBaseUrl());
  const authConfigured = isFirebaseConfigured();
  const auth = getAuthState();
  const forceLocal = isForceLocal();
  const lastCheckedAt = new Date().toISOString();

  if (!apiConfigured) {
    return {
      mode: 'local-fallback',
      apiConfigured: false,
      apiHealthy: false,
      firestoreReachable: null,
      authConfigured,
      signedIn: auth.signedIn,
      userEmail: auth.email,
      forceLocal,
      lastCheckedAt,
      message: 'API base URL not configured (VITE_API_BASE_URL). Using local JSON blobs.',
    };
  }

  const api = new ApiAdapter(getApiBaseUrl());
  const apiHealthy = await api.health();

  if (!apiHealthy) {
    return {
      mode: 'local-fallback',
      apiConfigured: true,
      apiHealthy: false,
      firestoreReachable: null,
      authConfigured,
      signedIn: auth.signedIn,
      userEmail: auth.email,
      forceLocal,
      lastCheckedAt,
      message: 'API health check failed. Using local JSON blobs.',
    };
  }

  if (forceLocal) {
    return {
      mode: 'local-fallback',
      apiConfigured: true,
      apiHealthy: true,
      firestoreReachable: null,
      authConfigured,
      signedIn: auth.signedIn,
      userEmail: auth.email,
      forceLocal: true,
      lastCheckedAt,
      message: 'Forced local-only mode.',
    };
  }

  if (!auth.signedIn || !auth.idToken) {
    return {
      mode: 'local-fallback',
      apiConfigured: true,
      apiHealthy: true,
      firestoreReachable: null,
      authConfigured,
      signedIn: false,
      userEmail: null,
      forceLocal,
      lastCheckedAt,
      message: 'Sign in as admin to use cloud storage.',
    };
  }

  try {
    const status = await api.status(auth.idToken);
    const mode: StorageMode = status.firestoreReachable ? 'cloud' : 'local-fallback';
    return {
      mode,
      apiConfigured: true,
      apiHealthy: true,
      firestoreReachable: status.firestoreReachable,
      authConfigured,
      signedIn: true,
      userEmail: auth.email,
      forceLocal,
      lastCheckedAt,
      message: status.firestoreReachable
        ? 'Connected to Cloud Run + Firestore.'
        : 'API up but Firestore unreachable. Using local fallback.',
    };
  } catch (err) {
    return {
      mode: 'local-fallback',
      apiConfigured: true,
      apiHealthy: true,
      firestoreReachable: false,
      authConfigured,
      signedIn: true,
      userEmail: auth.email,
      forceLocal,
      lastCheckedAt,
      message: err instanceof Error ? err.message : 'Status check failed.',
    };
  }
}
