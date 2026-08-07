import type { NextFunction, Request, Response } from 'express';
import { getAdmin, isAdminReady } from './firebaseAdmin.js';

export interface AuthedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    admin: boolean;
  };
}

function allowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (!isAdminReady()) {
      res.status(503).json({ error: 'Firebase Admin is not configured on the API.' });
      return;
    }

    const header = req.header('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ error: 'Missing Bearer token' });
      return;
    }

    const decoded = await getAdmin().auth().verifyIdToken(match[1]);
    const email = decoded.email?.toLowerCase();
    const isClaimAdmin = decoded.admin === true;
    const isAllowlisted = email ? allowlist().has(email) : false;

    if (!isClaimAdmin && !isAllowlisted) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      admin: true,
    };
    next();
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Unauthorized' });
  }
}
