import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type Unsubscribe,
  type User,
} from 'firebase/auth';

export interface AuthState {
  signedIn: boolean;
  email: string | null;
  uid: string | null;
  idToken: string | null;
  displayName: string | null;
  photoURL: string | null;
  user: User | null;
}

type AuthListener = (state: AuthState) => void;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let current: AuthState = {
  signedIn: false,
  email: null,
  uid: null,
  idToken: null,
  displayName: null,
  photoURL: null,
  user: null,
};
const listeners = new Set<AuthListener>();
let initialized = false;
/** True when the current session is a local QA simulated Google user. */
let simulatedSession = false;
let unsubscribeAuth: Unsubscribe | null = null;

function readConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  };
}

function envFlagTrue(value: unknown): boolean {
  const v = String(value ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Local QA only: simulate Google sign-in without OAuth.
 *
 * Hard requirements (all must be true):
 * - Vite **dev server** (`import.meta.env.DEV`)
 * - Not a production build (`!import.meta.env.PROD`)
 * - Explicit `VITE_DEV_SIMULATE_AUTH=true` in `.env.local`
 *
 * Never set that flag in `.env.firebase`, Hosting CI secrets, or `vite build`.
 * Production bundles evaluate this to false and the landing UI is compile-stripped.
 */
export function isDevAuthSimulationEnabled(): boolean {
  if (import.meta.env.PROD) return false;
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.MODE === 'production' || import.meta.env.MODE === 'firebase') {
    return false;
  }
  return envFlagTrue(import.meta.env.VITE_DEV_SIMULATE_AUTH);
}

export function isSimulatedAuthSession(): boolean {
  return simulatedSession;
}

/**
 * Local debug / mock auth path (`npm run dev` + `VITE_DEV_SIMULATE_AUTH`).
 * When true: no real Firebase Auth, System Admin + mock teams, never call the API
 * for `/v1/me`. Production and Hosting builds always return false.
 */
export function isLocalDebugMockAuth(): boolean {
  return isDevAuthSimulationEnabled();
}

/** Auth gate can open: real Firebase config and/or local simulate flag. */
export function isAuthReadyForApp(): boolean {
  return isFirebaseConfigured() || isDevAuthSimulationEnabled();
}

export function isFirebaseConfigured(): boolean {
  const c = readConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
}

function notify() {
  listeners.forEach((fn) => fn(current));
}

function toAuthState(user: User | null, idToken: string | null): AuthState {
  if (!user) {
    return {
      signedIn: false,
      email: null,
      uid: null,
      idToken: null,
      displayName: null,
      photoURL: null,
      user: null,
    };
  }
  return {
    signedIn: true,
    email: user.email,
    uid: user.uid,
    idToken,
    displayName: user.displayName,
    photoURL: user.photoURL,
    user,
  };
}

function simulatedIdentity(): {
  email: string;
  displayName: string;
  uid: string;
} {
  const email =
    (
      (import.meta.env.VITE_DEV_SIMULATE_EMAIL as string | undefined) ||
      (import.meta.env.VITE_INITIAL_ADMIN_EMAIL as string | undefined) ||
      'dev.coach@sop.local'
    )
      .trim()
      .toLowerCase() || 'dev.coach@sop.local';
  const displayName =
    (import.meta.env.VITE_DEV_SIMULATE_NAME as string | undefined)?.trim() ||
    'Dev Coach';
  return { email, displayName, uid: `dev-sim-${email}` };
}

/** Clear Firebase + workspace leftovers that block local QA simulate flow. */
export async function resetDevAuthState(): Promise<void> {
  simulatedSession = false;
  current = toAuthState(null, null);
  try {
    sessionStorage.removeItem('stm_workspace_ready_v1');
  } catch {
    /* ignore */
  }
  if (auth) {
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
  }
  notify();
}

export function initFirebase(): boolean {
  const sim = isDevAuthSimulationEnabled();
  const configured = isFirebaseConfigured();

  // Local simulate mode: never touch real Auth. Initializing getAuth() loads an
  // https://*.firebaseapp.com iframe that cannot talk to http://localhost
  // (protocol mismatch + noisy CONFIGURATION_NOT_FOUND in the console).
  if (sim) {
    initialized = true;
    return true;
  }

  if (!configured) {
    initialized = true;
    return false;
  }

  const c = readConfig();
  const options = {
    apiKey: c.apiKey!,
    authDomain: c.authDomain!,
    projectId: c.projectId!,
    appId: c.appId!,
  };

  try {
    // HMR-safe: Vite can re-run this module while the DEFAULT app already exists.
    app = getApps().length > 0 ? getApp() : initializeApp(options);
    auth = getAuth(app);
  } catch (err) {
    console.error('[sop-pt] Firebase init failed', err);
    initialized = true;
    return false;
  }

  if (unsubscribeAuth) {
    unsubscribeAuth();
    unsubscribeAuth = null;
  }

  unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    if (simulatedSession) {
      return;
    }
    if (user) {
      const idToken = await user.getIdToken();
      current = toAuthState(user, idToken);
    } else {
      current = toAuthState(null, null);
    }
    notify();
  });

  initialized = true;
  return true;
}

export function getAuthState(): AuthState {
  return current;
}

export function subscribeToAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

/** Fake Google session for local QA (`VITE_DEV_SIMULATE_AUTH=true` + `npm run dev`). */
export async function simulateGoogleSignIn(): Promise<void> {
  if (import.meta.env.PROD || !import.meta.env.DEV) {
    throw new Error('Auth simulation is not available outside local development.');
  }
  if (!isDevAuthSimulationEnabled()) {
    throw new Error(
      'Dev auth simulation is off. Set VITE_DEV_SIMULATE_AUTH=true in .env.local and restart Vite.',
    );
  }
  initFirebase();
  // Clear any real Google persistence first.
  if (auth) {
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
  }
  try {
    sessionStorage.removeItem('stm_workspace_ready_v1');
  } catch {
    /* ignore */
  }
  const id = simulatedIdentity();
  simulatedSession = true;
  current = {
    signedIn: true,
    email: id.email,
    uid: id.uid,
    idToken: 'dev-simulated-token',
    displayName: id.displayName,
    photoURL: null,
    user: null,
  };
  notify();
}

export async function signInWithGoogle(): Promise<void> {
  // Simulate flag wins locally — never open the Firebase Auth popup on http localhost.
  if (isDevAuthSimulationEnabled()) {
    await simulateGoogleSignIn();
    return;
  }
  if (!auth) {
    if (!initFirebase()) throw new Error('Firebase Auth is not configured.');
  }
  if (!auth) {
    throw new Error('Firebase Auth is not configured.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}

/** @deprecated Prefer signInWithGoogle — email/password is no longer offered in the UI. */
export async function adminSignIn(email: string, password: string): Promise<void> {
  if (!auth) {
    if (!initFirebase()) throw new Error('Firebase Auth is not configured.');
  }
  await signInWithEmailAndPassword(auth!, email, password);
}

export async function adminSignOut(): Promise<void> {
  if (simulatedSession) {
    simulatedSession = false;
    current = toAuthState(null, null);
    notify();
    return;
  }
  if (!auth) return;
  await signOut(auth);
}

export async function refreshIdToken(): Promise<string | null> {
  if (simulatedSession) return current.idToken;
  if (!current.user) return null;
  const token = await current.user.getIdToken(true);
  current = { ...current, idToken: token };
  return token;
}

export function getFirebaseApp(): FirebaseApp | null {
  return app;
}
