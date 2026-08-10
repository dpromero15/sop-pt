import type { Coach } from '../types';
import { StorageService } from '../services/storage';

/**
 * Ensure a Coach record exists for the signed-in Google user and return it.
 * Matches by uid/email when possible; otherwise creates a linked coach.
 */
export function ensureSignedInCoach(opts: {
  uid: string | null;
  email: string | null;
  displayName: string | null;
  membershipCoachName?: string | null;
}): Coach | null {
  if (!opts.uid && !opts.email) return null;

  const coaches = StorageService.getCoaches();
  const email = opts.email?.toLowerCase() ?? '';

  const existing = coaches.find(
    (c) =>
      (opts.uid && c.uid === opts.uid) ||
      (email && c.email?.toLowerCase() === email),
  );
  if (existing) {
    const next: Coach = {
      ...existing,
      uid: opts.uid ?? existing.uid,
      email: opts.email ?? existing.email,
      name:
        opts.membershipCoachName?.trim() ||
        opts.displayName?.trim() ||
        existing.name,
    };
    if (
      next.uid !== existing.uid ||
      next.email !== existing.email ||
      next.name !== existing.name
    ) {
      StorageService.saveCoaches(
        coaches.map((c) => (c.id === existing.id ? next : c)),
      );
    }
    return next;
  }

  const name =
    opts.membershipCoachName?.trim() ||
    opts.displayName?.trim() ||
    opts.email?.split('@')[0] ||
    'Coach';

  const created = StorageService.addCoach({
    name,
    uid: opts.uid ?? undefined,
    email: opts.email ?? undefined,
  });
  return created;
}
