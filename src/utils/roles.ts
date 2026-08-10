import type {
  AccessAction,
  AppRole,
  EffectiveAccess,
  TeamMembershipRole,
} from '../types';

const ROLE_RANK: Record<AppRole, number> = {
  none: 0,
  viewer: 1,
  dataEntry: 2,
  teamAdmin: 3,
  systemAdmin: 4,
};

/** Map team membership role to AppRole. */
export function membershipToAppRole(role: TeamMembershipRole): AppRole {
  return role;
}

export function maxRole(a: AppRole, b: AppRole): AppRole {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

export function roleAtLeast(role: AppRole, minimum: AppRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * Resolve effective role for the active team.
 * System Admin always wins globally.
 */
export function resolveEffectiveAccess(opts: {
  systemRole: 'none' | 'systemAdmin';
  membershipRole?: TeamMembershipRole | null;
  teamId?: string | null;
}): EffectiveAccess {
  if (opts.systemRole === 'systemAdmin') {
    return {
      role: 'systemAdmin',
      systemRole: 'systemAdmin',
      teamId: opts.teamId ?? null,
      membershipRole: opts.membershipRole ?? null,
    };
  }
  const membershipRole = opts.membershipRole ?? null;
  const role: AppRole = membershipRole
    ? membershipToAppRole(membershipRole)
    : 'none';
  return {
    role,
    systemRole: 'none',
    teamId: opts.teamId ?? null,
    membershipRole,
  };
}

/** Capability matrix — keep in sync with plan / #75. */
export function can(role: AppRole, action: AccessAction): boolean {
  switch (action) {
    case 'view':
      return roleAtLeast(role, 'viewer');
    case 'dataEntry':
      return roleAtLeast(role, 'dataEntry');
    case 'coachesRating':
    case 'adjustedBumps':
      return roleAtLeast(role, 'dataEntry');
    case 'rosterWrite':
      return roleAtLeast(role, 'teamAdmin');
    case 'profileNotes':
      return roleAtLeast(role, 'dataEntry');
    case 'configWrite':
      return roleAtLeast(role, 'teamAdmin');
    case 'adminPage':
      return roleAtLeast(role, 'teamAdmin');
    case 'manageAllTeams':
    case 'promoteSystemAdmin':
    case 'cloudSync':
      return role === 'systemAdmin';
    case 'manageTeamMembers':
      return roleAtLeast(role, 'teamAdmin');
    default:
      return false;
  }
}

export function roleLabel(role: AppRole): string {
  switch (role) {
    case 'systemAdmin':
      return 'System Admin';
    case 'teamAdmin':
      return 'Team Admin';
    case 'dataEntry':
      return 'Data Entry';
    case 'viewer':
      return 'Viewer';
    default:
      return 'No access';
  }
}

export function initialAdminEmail(): string {
  return (
    (import.meta.env.VITE_INITIAL_ADMIN_EMAIL as string | undefined)?.trim() ||
    ''
  );
}
