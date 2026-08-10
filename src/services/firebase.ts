import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
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

function readConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  };
}

export function isFirebaseConfigured(): boolean {
  const c = readConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
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

export function initFirebase(): boolean {
  if (initialized) return isFirebaseConfigured();
  initialized = true;
  if (!isFirebaseConfigured()) return false;

  const c = readConfig();
  app = initializeApp({
    apiKey: c.apiKey!,
    authDomain: c.authDomain!,
    projectId: c.projectId!,
    appId: c.appId!,
  });
  auth = getAuth(app);

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const idToken = await user.getIdToken();
      current = toAuthState(user, idToken);
    } else {
      current = toAuthState(null, null);
    }
    listeners.forEach((fn) => fn(current));
  });

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

export async function signInWithGoogle(): Promise<void> {
  if (!auth) {
    if (!initFirebase()) throw new Error('Firebase Auth is not configured.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth!, provider);
}

/** @deprecated Prefer signInWithGoogle; kept for legacy Admin tools. */
export async function adminSignIn(email: string, password: string): Promise<void> {
  if (!auth) {
    if (!initFirebase()) throw new Error('Firebase Auth is not configured.');
  }
  await signInWithEmailAndPassword(auth!, email, password);
}

export async function adminSignOut(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export async function refreshIdToken(): Promise<string | null> {
  if (!current.user) return null;
  const token = await current.user.getIdToken(true);
  current = { ...current, idToken: token };
  return token;
}

export function getFirebaseApp(): FirebaseApp | null {
  return app;
}
