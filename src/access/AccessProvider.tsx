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
  isAuthReadyForApp,
  isDevAuthSimulationEnabled,
  subscribeToAuth,
  type AuthState,
} from '../services/firebase';
import { getApiBaseUrl } from '../services/storage/connectionStatus';
import {
  can as canRole,
  resolveEffectiveAccess,
  roleLabel,
} from '../utils/roles';

function buildDevSimTeams(uid: string, email: string): SessionMeResponse['teams'] {
  const now = new Date().toISOString();
  const mk = (
    id: string,
    name: string,
    ageGroup: string,
  ): SessionMeResponse['teams'][number] => ({
    team: {
      id,
      name,
      shortName: ageGroup,
      ageGroup,
      season: '2025-26',
      clubName: 'Systems of Play Academy',
      homeVenue: 'SOP Pitch',
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      timezone: 'America/Denver',
      updatedAt: now,
    } as Team,
    membership: {
      uid,
      email,
      role: 'teamAdmin',
      createdAt: now,
      createdByUid: uid,
    } as TeamMembership,
  });
  return [
    mk('dev-team-u13', 'SOP Academy U13', 'U13'),
    mk('dev-team-u15', 'SOP Academy U15', 'U15'),
  ];
}

interface AccessContextValue {
  authConfigured: boolean;
  authReady: boolean;
  auth: AuthState;
  appUser: AppUser | null;
  teams: SessionMeResponse['teams'];
  activeTeamId: string | null;
  setActiveTeamId: (id: string | null) => void;
  /** True after the user explicitly picks a team (or admin workspace) this session. */
  workspaceReady: boolean;
  enterWorkspace: (teamId: string | null) => void;
  clearWorkspace: () => void;
  access: EffectiveAccess;
  /** True when Firebase web config is missing. */
  localOpenMode: boolean;
  can: (action: AccessAction) => boolean;
  roleLabel: string;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AccessContext = createContext<AccessContextValue | null>(null);

const ACTIVE_TEAM_KEY = 'stm_active_team_id_v1';
const WORKSPACE_READY_KEY = 'stm_workspace_ready_v1';

function readWorkspaceReady(): boolean {
  try {
    return sessionStorage.getItem(WORKSPACE_READY_KEY) === '1';
  } catch {
    return false;
  }
}

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const authConfigured = isAuthReadyForApp();
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
  const [workspaceReady, setWorkspaceReady] = useState(readWorkspaceReady);

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

    // Dev simulate mode (local `npm run dev` only): System Admin + mock teams.
    if (import.meta.env.DEV && isDevAuthSimulationEnabled()) {
      const email = auth.email?.toLowerCase() ?? '';
      setAppUser({
        uid: auth.uid ?? '',
        email,
        displayName: auth.displayName ?? undefined,
        photoURL: auth.photoURL ?? undefined,
        systemRole: 'systemAdmin',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });
      setTeams(buildDevSimTeams(auth.uid ?? 'dev', email));
      return;
    }

    if (!getApiBaseUrl()) {
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
        systemRole: initial && email === initial ? 'systemAdmin' : 'none',
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
      // Keep remembered team if still valid; do not auto-enter workspace.
      if (
        activeTeamId &&
        !me.teams.some((t) => (t.team as Team).id === activeTeamId)
      ) {
        setActiveTeamIdState(null);
        try {
          localStorage.removeItem(ACTIVE_TEAM_KEY);
        } catch {
          /* ignore */
        }
      }
    } catch {
      setAppUser(null);
      setTeams([]);
    }
  }, [
    authConfigured,
    auth.signedIn,
    auth.email,
    auth.uid,
    auth.displayName,
    auth.photoURL,
    activeTeamId,
  ]);

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

  const enterWorkspace = (teamId: string | null) => {
    setActiveTeamId(teamId);
    setWorkspaceReady(true);
    try {
      sessionStorage.setItem(WORKSPACE_READY_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const clearWorkspace = () => {
    setWorkspaceReady(false);
    try {
      sessionStorage.removeItem(WORKSPACE_READY_KEY);
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
    return resolveEffectiveAccess({
      systemRole: appUser?.systemRole ?? 'none',
      membershipRole: membership?.role ?? null,
      teamId: activeTeamId,
    });
  }, [appUser, membership, activeTeamId]);

  const value: AccessContextValue = {
    authConfigured,
    authReady,
    auth,
    appUser,
    teams,
    activeTeamId,
    setActiveTeamId,
    workspaceReady,
    enterWorkspace,
    clearWorkspace,
    access,
    localOpenMode,
    can: (action: AccessAction) => canRole(access.role, action),
    roleLabel: roleLabel(access.role),
    refreshSession,
    signOut: async () => {
      await adminSignOut();
      setAppUser(null);
      setTeams([]);
      clearWorkspace();
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
