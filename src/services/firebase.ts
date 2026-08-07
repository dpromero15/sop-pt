import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';

export interface AuthState {
  signedIn: boolean;
  email: string | null;
  uid: string | null;
  idToken: string | null;
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
      current = {
        signedIn: true,
        email: user.email,
        uid: user.uid,
        idToken,
        user,
      };
    } else {
      current = {
        signedIn: false,
        email: null,
        uid: null,
        idToken: null,
        user: null,
      };
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
