/** Crockford-like alphabet — no 0/O/1/I/L so codes stay readable on paper. */
export const PUBLIC_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const PUBLIC_ID_LENGTH = 6;

export function normalizePublicId(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  const cleaned = String(raw)
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
  if (cleaned.length !== PUBLIC_ID_LENGTH) return undefined;
  for (let i = 0; i < cleaned.length; i++) {
    if (!PUBLIC_ID_ALPHABET.includes(cleaned[i]!)) return undefined;
  }
  return cleaned;
}

export function displayPublicId(player: { publicId?: string }): string {
  return normalizePublicId(player.publicId) ?? '—';
}

/** Stable 6-char code from a seed (internal player id). Used for sample data + backfill. */
export function publicIdFromSeed(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = '';
  for (let i = 0; i < PUBLIC_ID_LENGTH; i++) {
    h ^= h >>> 13;
    h = Math.imul(h, 1274126177);
    out += PUBLIC_ID_ALPHABET[(h >>> 0) % PUBLIC_ID_ALPHABET.length];
  }
  return out;
}

export function generatePublicId(): string {
  const bytes = new Uint8Array(PUBLIC_ID_LENGTH);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < PUBLIC_ID_LENGTH; i++) {
    out += PUBLIC_ID_ALPHABET[bytes[i]! % PUBLIC_ID_ALPHABET.length];
  }
  return out;
}

export function generateUniquePublicId(taken: Set<string>): string {
  for (let i = 0; i < 64; i++) {
    const id = generatePublicId();
    if (!taken.has(id)) return id;
  }
  for (let extra = 1; extra <= PUBLIC_ID_LENGTH; extra++) {
    const id = (generatePublicId() + generatePublicId()).slice(0, PUBLIC_ID_LENGTH + extra);
    if (!taken.has(id)) return id;
  }
  return `X${Date.now().toString(36).toUpperCase()}`;
}

type PlayerLike = Record<string, unknown>;

/**
 * Ensure every player row has a unique normalized `publicId`.
 * Prefers an existing valid code, then a seed from internal `id`, then random.
 */
export function assignPlayerPublicIds<T extends PlayerLike>(
  rows: T[],
): { rows: Array<T & { publicId: string }>; changed: boolean } {
  const taken = new Set<string>();
  let changed = false;
  const next = rows.map((row) => {
    if (!row || typeof row !== 'object') {
      return row as T & { publicId: string };
    }
    const existing = normalizePublicId(
      typeof row.publicId === 'string' ? row.publicId : undefined,
    );
    if (existing && !taken.has(existing)) {
      taken.add(existing);
      if (row.publicId === existing) {
        return row as T & { publicId: string };
      }
      changed = true;
      return { ...row, publicId: existing };
    }
    const seed =
      typeof row.id === 'string' && row.id.trim()
        ? publicIdFromSeed(row.id)
        : '';
    const publicId =
      seed && !taken.has(seed) ? seed : generateUniquePublicId(taken);
    taken.add(publicId);
    changed = true;
    return { ...row, publicId };
  });
  return { rows: next, changed };
}
