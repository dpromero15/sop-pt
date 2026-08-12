import type { NextFunction, Response } from 'express';
import type { Request } from 'express';
import { getAdmin, isAdminReady } from './firebaseAdmin.js';

export type TeamMembershipRole = 'viewer' | 'dataEntry' | 'teamAdmin';
export type SystemRole = 'none' | 'systemAdmin';

export interface AppUserDoc {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  systemRole: SystemRole;
  createdAt: string;
  lastLoginAt: string;
}

export interface TeamMembershipDoc {
  uid?: string;
  email: string;
  role: TeamMembershipRole;
  coachDisplayName?: string;
  createdAt: string;
  createdByUid: string;
}

export interface AuthedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    systemAdmin: boolean;
    appUser: AppUserDoc;
  };
  teamMembership?: TeamMembershipDoc | null;
}

const ROLE_RANK: Record<TeamMembershipRole | 'systemAdmin', number> = {
  viewer: 1,
  dataEntry: 2,
  teamAdmin: 3,
  systemAdmin: 4,
};

export function allowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function memberDocId(email: string): string {
  return normalizeEmail(email).replace(/[^a-z0-9@._+-]/gi, '_');
}

export function usersCol() {
  return getAdmin().firestore().collection('users');
}

export function teamRef(teamId: string) {
  return getAdmin().firestore().collection('teams').doc(teamId);
}

export function membersCol(teamId: string) {
  return teamRef(teamId).collection('members');
}

export async function upsertAppUser(input: {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
}): Promise<AppUserDoc> {
  const email = normalizeEmail(input.email);
  const ref = usersCol().doc(input.uid);
  const existing = await ref.get();
  const now = new Date().toISOString();
  const onAllowlist = allowlist().has(email);

  let systemRole: SystemRole = 'none';
  if (existing.exists) {
    const prev = existing.data() as AppUserDoc;
    systemRole = prev.systemRole === 'systemAdmin' || onAllowlist ? 'systemAdmin' : 'none';
  } else if (onAllowlist) {
    systemRole = 'systemAdmin';
  }

  const doc: AppUserDoc = {
    uid: input.uid,
    email,
    displayName: input.displayName ?? undefined,
    photoURL: input.photoURL ?? undefined,
    systemRole,
    createdAt: existing.exists
      ? ((existing.data() as AppUserDoc).createdAt ?? now)
      : now,
    lastLoginAt: now,
  };
  await ref.set(doc, { merge: true });
  return doc;
}

export async function getMembershipByEmail(
  teamId: string,
  email: string,
): Promise<TeamMembershipDoc | null> {
  const id = memberDocId(email);
  const snap = await membersCol(teamId).doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as TeamMembershipDoc;
}

export async function getMembershipForUser(
  teamId: string,
  uid: string,
  email?: string,
): Promise<TeamMembershipDoc | null> {
  if (email) {
    const byEmail = await getMembershipByEmail(teamId, email);
    if (byEmail) {
      if (!byEmail.uid) {
        await membersCol(teamId)
          .doc(memberDocId(email))
          .set({ uid }, { merge: true });
        return { ...byEmail, uid };
      }
      return byEmail;
    }
  }
  const q = await membersCol(teamId).where('uid', '==', uid).limit(1).get();
  if (q.empty) return null;
  return q.docs[0].data() as TeamMembershipDoc;
}

export function membershipAtLeast(
  role: TeamMembershipRole | 'systemAdmin',
  minimum: TeamMembershipRole,
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * API Gateway (x-google-backend) strips Authorization and forwards the verified
 * JWT payload as base64url(JSON) in X-Apigateway-Api-Userinfo. Local/dev still
 * uses Bearer ID tokens. Only the gateway SA can invoke Cloud Run, so forged
 * userinfo from the public internet cannot reach this process.
 */
function identityFromGatewayUserinfo(req: AuthedRequest): {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
} | null {
  const raw = req.header('x-apigateway-api-userinfo');
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as Record<string, unknown>;
    const uid =
      (typeof payload.user_id === 'string' && payload.user_id) ||
      (typeof payload.sub === 'string' && payload.sub) ||
      '';
    const email = typeof payload.email === 'string' ? payload.email : '';
    if (!uid || !email) return null;
    return {
      uid,
      email,
      displayName: typeof payload.name === 'string' ? payload.name : null,
      photoURL: typeof payload.picture === 'string' ? payload.picture : null,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!isAdminReady()) {
      res.status(503).json({ error: 'Firebase Admin is not configured on the API.' });
      return;
    }

    const fromGateway = identityFromGatewayUserinfo(req);
    let uid: string;
    let email: string;
    let displayName: string | null;
    let photoURL: string | null;

    if (fromGateway) {
      uid = fromGateway.uid;
      email = fromGateway.email;
      displayName = fromGateway.displayName;
      photoURL = fromGateway.photoURL;
    } else {
      const header = req.header('authorization') || '';
      const match = header.match(/^Bearer\s+(.+)$/i);
      if (!match) {
        res.status(401).json({ error: 'Missing Bearer token' });
        return;
      }

      const decoded = await getAdmin().auth().verifyIdToken(match[1]);
      if (!decoded.email) {
        res.status(403).json({ error: 'Authenticated user must have an email' });
        return;
      }
      uid = decoded.uid;
      email = decoded.email;
      displayName = typeof decoded.name === 'string' ? decoded.name : null;
      photoURL = typeof decoded.picture === 'string' ? decoded.picture : null;
    }

    const appUser = await upsertAppUser({
      uid,
      email,
      displayName,
      photoURL,
    });

    req.user = {
      uid,
      email,
      displayName: appUser.displayName,
      photoURL: appUser.photoURL,
      systemAdmin: appUser.systemRole === 'systemAdmin',
      appUser,
    };
    next();
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Unauthorized' });
  }
}

/** System Admin only. Safe after requireAuth or standalone. */
export async function requireSystemAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const ensure = () => {
    if (!req.user?.systemAdmin) {
      res.status(403).json({ error: 'System Admin access required' });
      return;
    }
    next();
  };

  if (req.user) {
    ensure();
    return;
  }
  await requireAuth(req, res, (err?: unknown) => {
    if (err) {
      next(err as Error);
      return;
    }
    ensure();
  });
}

/** @deprecated Use requireSystemAdmin */
export const requireAdmin = requireSystemAdmin;

export function requireTeamRole(minimum: TeamMembershipRole) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (req.user.systemAdmin) {
        req.teamMembership = null;
        next();
        return;
      }

      const teamId = req.params.teamId;
      if (!teamId) {
        res.status(400).json({ error: 'teamId required' });
        return;
      }

      const membership = await getMembershipForUser(
        teamId,
        req.user.uid,
        req.user.email,
      );
      if (!membership || !membershipAtLeast(membership.role, minimum)) {
        res.status(403).json({ error: `Requires team role ${minimum} or higher` });
        return;
      }
      req.teamMembership = membership;
      next();
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Authorization failed',
      });
    }
  };
}

export { memberDocId };
