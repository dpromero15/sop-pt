import type { TeamSnapshot } from './types';

export class ApiAdapter {
  constructor(private baseUrl: string) {}

  private async request<T>(
    path: string,
    options: RequestInit & { token?: string | null } = {},
  ): Promise<T> {
    const { token, ...init } = options;
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async status(token: string) {
    return this.request<{
      ok: boolean;
      firestoreReachable: boolean;
      projectId: string | null;
    }>('/v1/status', { token });
  }

  async getTeam(teamId: string, token: string) {
    return this.request(`/v1/teams/${teamId}`, { token });
  }

  async putTeam(teamId: string, body: unknown, token: string) {
    return this.request(`/v1/teams/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      token,
    });
  }

  async putCollection(
    teamId: string,
    name: 'players' | 'sessions' | 'entries',
    items: unknown[],
    token: string,
  ) {
    return this.request(`/v1/teams/${teamId}/${name}`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
      token,
    });
  }

  async putConfig(
    teamId: string,
    name: 'metrics' | 'labels' | 'formula',
    data: unknown,
    token: string,
  ) {
    return this.request(`/v1/teams/${teamId}/config/${name}`, {
      method: 'PUT',
      body: JSON.stringify({ data }),
      token,
    });
  }

  async bootstrap(teamId: string, snapshot: TeamSnapshot, token: string) {
    return this.request(`/v1/teams/${teamId}/bootstrap`, {
      method: 'POST',
      body: JSON.stringify(snapshot),
      token,
    });
  }

  async hydrate(teamId: string, token: string): Promise<TeamSnapshot> {
    return this.request<TeamSnapshot>(`/v1/teams/${teamId}/snapshot`, { token });
  }
}
