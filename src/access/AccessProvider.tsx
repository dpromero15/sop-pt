import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  AccessAction,
  AppRole,
  AppUser,
  EffectiveAccess,
  Team,
  TeamMembership,
} from '../types';
import {
  fetchSessionMe,
  type SessionMeResponse,
} from '../services/adminApi';
import {
  adminSignOut,
  getAuthState,
  initFirebase,
  isFirebaseConfigured,
  subscribeToAuth,
  type AuthState,
} from '../services/firebase';
import { getApiBaseUrl } from '../services/storage/connectionStatus';
import {
  can as canRole,
  resolveEffectiveAccess,
  roleLabel,
} from '../utils/roles';

interface AccessContextValue {
  authConfigured: boolean;
  authReady: boolean;
  auth: AuthState;
  appUser: AppUser | null;
  teams: SessionMeResponse['teams'];
  activeTeamId: string | null;
  setActiveTeamId: (id: string | null) => void;
  access: EffectiveAccess;
  /** Local-only mode (Firebase unset): full access for offline/dev. */
  localOpenMode: boolean;
  can: (action: AccessAction) => boolean;
  roleLabel: string;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AccessContext = createContext<AccessContextValue | null>(null);

const ACTIVE_TEAM_KEY = 'stm_active_team_id_v1';

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const authConfigured = isFirebaseConfigured();
  const [authReady, setAuthReady] = useState(!authConfigured);
  const [auth, setAuth] = useState<AuthState>(() => getAuthState());
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [teams, setTeams] = useState<SessionMeResponse['teams']>([]);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_TEAM_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!authConfigured) {
      setAuthReady(true);
      return;
    }
    initFirebase();
    const unsub = subscribeToAuth((state) => {
      setAuth(state);
      setAuthReady(true);
    });
    return unsub;
  }, [authConfigured]);

  const refreshSession = useCallback(async () => {
    if (!authConfigured || !auth.signedIn) {
      setAppUser(null);
      setTeams([]);
      return;
    }
    if (!getApiBaseUrl()) {
      // Signed in but no API — treat allowlist client-side for chrome only
      const email = auth.email?.toLowerCase() ?? '';
      const initial =
        (import.meta.env.VITE_INITIAL_ADMIN_EMAIL as string | undefined)
          ?.trim()
          .toLowerCase() ?? '';
      setAppUser({
        uid: auth.uid ?? '',
        email,
        displayName: auth.displayName ?? undefined,
        photoURL: auth.photoURL ?? undefined,
        systemRole:
          initial && email === initial ? 'systemAdmin' : 'none',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });
      setTeams([]);
      return;
    }
    try {
      const me = await fetchSessionMe();
      setAppUser(me.user);
      setTeams(me.teams);
      if (
        me.teams.length > 0 &&
        (!activeTeamId ||
          !me.teams.some((t) => (t.team as Team).id === activeTeamId))
      ) {
        const firstId = (me.teams[0].team as Team).id;
        setActiveTeamIdState(firstId);
        try {
          localStorage.setItem(ACTIVE_TEAM_KEY, firstId);
        } catch {
          /* ignore */
        }
      }
    } catch {
      setAppUser(null);
      setTeams([]);
    }
  }, [authConfigured, auth.signedIn, auth.email, auth.uid, auth.displayName, auth.photoURL, activeTeamId]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const setActiveTeamId = (id: string | null) => {
    setActiveTeamIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_TEAM_KEY, id);
      else localStorage.removeItem(ACTIVE_TEAM_KEY);
    } catch {
      /* ignore */
    }
  };

  const membership: TeamMembership | null = useMemo(() => {
    if (!activeTeamId) return null;
    const row = teams.find((t) => (t.team as Team).id === activeTeamId);
    return (row?.membership as TeamMembership) ?? null;
  }, [teams, activeTeamId]);

  const localOpenMode = !authConfigured;

  const access = useMemo((): EffectiveAccess => {
    if (localOpenMode) {
      return {
        role: 'systemAdmin',
        systemRole: 'systemAdmin',
        teamId: activeTeamId,
        membershipRole: null,
      };
    }
    return resolveEffectiveAccess({
      systemRole: appUser?.systemRole ?? 'none',
      membershipRole: membership?.role ?? null,
      teamId: activeTeamId,
    });
  }, [localOpenMode, appUser, membership, activeTeamId]);

  const value: AccessContextValue = {
    authConfigured,
    authReady,
    auth,
    appUser,
    teams,
    activeTeamId,
    setActiveTeamId,
    access,
    localOpenMode,
    can: (action: AccessAction) => canRole(access.role, action),
    roleLabel: roleLabel(access.role),
    refreshSession,
    signOut: async () => {
      await adminSignOut();
      setAppUser(null);
      setTeams([]);
    },
  };

  return (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  );
};

export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    throw new Error('useAccess must be used within AccessProvider');
  }
  return ctx;
}

export function useOptionalAccess(): AccessContextValue | null {
  return useContext(AccessContext);
}

/** Effective role for gating when AccessProvider may be missing in tests. */
export function effectiveRoleOrLocal(
  access: AccessContextValue | null,
): AppRole {
  if (!access) return 'systemAdmin';
  return access.access.role;
}
