import { describe, expect, it } from 'vitest';
import {
  PUBLIC_ID_ALPHABET,
  PUBLIC_ID_LENGTH,
  assignPlayerPublicIds,
  displayPublicId,
  generateUniquePublicId,
  normalizePublicId,
  publicIdFromSeed,
} from './playerPublicId';

describe('playerPublicId', () => {
  it('normalizes case and strips separators', () => {
    expect(normalizePublicId('ab2-def')).toBe('AB2DEF');
    const seed = publicIdFromSeed('p1');
    expect(seed).toHaveLength(PUBLIC_ID_LENGTH);
    expect(normalizePublicId(seed.toLowerCase())).toBe(seed);
    expect(normalizePublicId(`${seed.slice(0, 3)}-${seed.slice(3)}`)).toBe(seed);
  });

  it('rejects ambiguous or wrong-length codes', () => {
    expect(normalizePublicId('O12345')).toBeUndefined();
    expect(normalizePublicId('ABC')).toBeUndefined();
    expect(normalizePublicId('')).toBeUndefined();
    expect(normalizePublicId(null)).toBeUndefined();
  });

  it('seeds are stable and alphabet-safe', () => {
    expect(publicIdFromSeed('p1')).toBe(publicIdFromSeed('p1'));
    expect(publicIdFromSeed('p1')).not.toBe(publicIdFromSeed('p2'));
    for (const ch of publicIdFromSeed('p1')) {
      expect(PUBLIC_ID_ALPHABET).toContain(ch);
    }
  });

  it('assigns missing ids and keeps valid ones', () => {
    const a = publicIdFromSeed('keep');
    const { rows, changed } = assignPlayerPublicIds([
      { id: 'keep', name: 'Ada', publicId: a.toLowerCase() },
      { id: 'new', name: 'Bea' },
      { id: 'dup', name: 'Cara', publicId: a },
    ]);
    expect(changed).toBe(true);
    expect(rows[0]?.publicId).toBe(a);
    expect(rows[1]?.publicId).toBe(publicIdFromSeed('new'));
    expect(rows[2]?.publicId).not.toBe(a);
    expect(new Set(rows.map((r) => r.publicId)).size).toBe(3);
  });

  it('is idempotent once ids are assigned', () => {
    const first = assignPlayerPublicIds([{ id: 'p1', name: 'Ada' }]);
    const second = assignPlayerPublicIds(first.rows);
    expect(second.changed).toBe(false);
    expect(second.rows[0]?.publicId).toBe(first.rows[0]?.publicId);
  });

  it('generates unique codes against a taken set', () => {
    const taken = new Set([publicIdFromSeed('p1')]);
    const next = generateUniquePublicId(taken);
    expect(next).not.toBe(publicIdFromSeed('p1'));
    expect(normalizePublicId(next) ?? next.length > PUBLIC_ID_LENGTH).toBeTruthy();
  });

  it('displays a dash when missing', () => {
    expect(displayPublicId({})).toBe('—');
    expect(displayPublicId({ publicId: publicIdFromSeed('p1') })).toBe(
      publicIdFromSeed('p1'),
    );
  });
});
