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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error('VITE_API_BASE_URL is not set.');
  const headers = await authHeader();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `API ${res.status}`);
  }
  return (await res.json()) as T;
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
