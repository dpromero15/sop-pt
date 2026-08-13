import { describe, expect, it } from 'vitest';
import {
  isPastSoftDeleteRetention,
  isSoftDeleted,
  isValidDeletedAt,
  SOFT_DELETE_RETENTION_MS,
  withoutDeletedAt,
} from './softDelete';

describe('softDelete helpers', () => {
  it('treats missing deletedAt as live', () => {
    expect(isSoftDeleted({})).toBe(false);
    expect(isSoftDeleted({ deletedAt: '2026-01-01T00:00:00.000Z' })).toBe(true);
  });

  it('rejects invalid deletedAt timestamps', () => {
    expect(isValidDeletedAt('nope')).toBe(false);
    expect(isValidDeletedAt('2026-08-01T12:00:00.000Z')).toBe(true);
  });

  it('purges only after the 90-day window', () => {
    const deletedAt = '2026-01-01T00:00:00.000Z';
    const start = Date.parse(deletedAt);
    expect(isPastSoftDeleteRetention(deletedAt, start + SOFT_DELETE_RETENTION_MS - 1)).toBe(
      false,
    );
    expect(isPastSoftDeleteRetention(deletedAt, start + SOFT_DELETE_RETENTION_MS)).toBe(
      true,
    );
  });

  it('strips deletedAt on restore', () => {
    expect(
      withoutDeletedAt({ id: 'p1', deletedAt: '2026-01-01T00:00:00.000Z' }),
    ).toEqual({ id: 'p1' });
  });
});
