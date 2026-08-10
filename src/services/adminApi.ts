import type {
  AppUser,
  Team,
  TeamMembership,
  TeamMembershipRole,
} from '../types';
import { getAuthState, refreshIdToken } from './firebase';
import { getApiBaseUrl } from './storage/connectionStatus';

async function authHeader(): Promise<HeadersInit> {
  let token = getAuthState().idToken;
  if (!token) token = await refreshIdToken();
  if (!token) throw new Error('Not signed in.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

const API_TIMEOUT_MS = 12_000;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error('VITE_API_BASE_URL is not set.');
  const headers = await authHeader();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { ...headers, ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error || `API ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `API timed out after ${API_TIMEOUT_MS / 1000}s (${base}). Is the server running?`,
      );
    }
    if (err instanceof TypeError) {
      throw new Error(
        `API unreachable at ${base}. Start the API or clear VITE_API_BASE_URL for local-only.`,
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export interface SessionMeResponse {
  user: AppUser;
  teams: Array<{
    team: Team;
    membership: TeamMembership | null;
  }>;
}

export async function fetchSessionMe(): Promise<SessionMeResponse> {
  return apiFetch<SessionMeResponse>('/v1/me');
}

export async function listTeams(): Promise<{ teams: Team[] }> {
  return apiFetch('/v1/teams');
}

export async function createTeam(
  team: Omit<Team, 'id' | 'updatedAt'> & { id?: string },
): Promise<Team> {
  return apiFetch('/v1/teams', {
    method: 'POST',
    body: JSON.stringify(team),
  });
}

export async function listMembers(
  teamId: string,
): Promise<{ members: TeamMembership[] }> {
  return apiFetch(`/v1/teams/${encodeURIComponent(teamId)}/members`);
}

export async function upsertMember(
  teamId: string,
  member: {
    email: string;
    role: TeamMembershipRole;
    coachDisplayName?: string;
  },
): Promise<TeamMembership> {
  return apiFetch(
    `/v1/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(member.email.toLowerCase())}`,
    {
      method: 'PUT',
      body: JSON.stringify(member),
    },
  );
}

export async function removeMember(
  teamId: string,
  email: string,
): Promise<void> {
  await apiFetch(
    `/v1/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(email.toLowerCase())}`,
    { method: 'DELETE' },
  );
}
