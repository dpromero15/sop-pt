/** Rankings empty-state meme photo (not used as every player default). */
export const CUCURELLA_CAT_PHOTO_URL = '/cucurella-cat.jpg';

/**
 * Default player avatars — black-outline soccer cats (incl. Cucurella silhouette).
 * Assigned by seed so the roster is not identical.
 */
export const DEFAULT_AVATAR_POOL = [
  '/avatars/cucurella-outline.svg',
  '/avatars/striker-cat.svg',
  '/avatars/keeper-cat.svg',
  '/avatars/captain-cat.svg',
  '/avatars/wing-cat.svg',
  '/avatars/defender-cat.svg',
  '/avatars/midfield-cat.svg',
  '/avatars/bench-cat.svg',
] as const;

function hashSeed(seed: string | number): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.abs(Math.trunc(seed));
  }
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Stable pick from the soccer-cat outline pool (jersey #, player id, roster index, …). */
export function defaultAvatarFor(seed: string | number): string {
  const i = hashSeed(seed) % DEFAULT_AVATAR_POOL.length;
  return DEFAULT_AVATAR_POOL[i];
}
