/** Soft-deleted players/sessions stay in storage until this window elapses. */
export const SOFT_DELETE_RETENTION_DAYS = 90;
export const SOFT_DELETE_RETENTION_MS =
  SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function isSoftDeleted(record: { deletedAt?: string }): boolean {
  return Boolean(record.deletedAt);
}

export function isValidDeletedAt(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function isPastSoftDeleteRetention(
  deletedAt: string | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!isValidDeletedAt(deletedAt)) return false;
  return nowMs - Date.parse(deletedAt) >= SOFT_DELETE_RETENTION_MS;
}

export function withoutDeletedAt<T extends { deletedAt?: string }>(
  record: T,
): Omit<T, 'deletedAt'> {
  const { deletedAt: _removed, ...rest } = record;
  return rest;
}
