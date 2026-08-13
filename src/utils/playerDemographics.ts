import type { PlayerGrade } from '../types';

export const PLAYER_GRADES: readonly PlayerGrade[] = [9, 10, 11, 12];

export const PLAYER_GRADE_LABEL: Record<PlayerGrade, string> = {
  9: 'Freshman',
  10: 'Sophomore',
  11: 'Junior',
  12: 'Senior',
};

export function isPlayerGrade(value: unknown): value is PlayerGrade {
  return value === 9 || value === 10 || value === 11 || value === 12;
}

export function parsePlayerGrade(raw: unknown): PlayerGrade | undefined {
  if (raw === '' || raw == null) return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || !isPlayerGrade(n)) return undefined;
  return n;
}

export function parseBirthYear(
  raw: unknown,
  asOfYear = new Date().getFullYear(),
): number | undefined {
  if (raw === '' || raw == null) return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n)) return undefined;
  const min = asOfYear - 50;
  const max = asOfYear - 5;
  if (n < min || n > max) return undefined;
  return n;
}

export function birthYearFromAge(
  age: number,
  asOfYear = new Date().getFullYear(),
): number {
  return asOfYear - Math.round(age);
}

export function ageFromBirthYear(
  birthYear: number,
  asOfYear = new Date().getFullYear(),
): number {
  return asOfYear - birthYear;
}

export function formatPlayerGrade(grade: PlayerGrade): string {
  return `${grade} · ${PLAYER_GRADE_LABEL[grade]}`;
}

/**
 * Map legacy `age` → `birthYear` and drop `age`. Idempotent.
 * Invalid grade / birthYear values are stripped.
 */
export function migratePlayerDemographics<T extends Record<string, unknown>>(
  row: T,
  asOfYear = new Date().getFullYear(),
): { player: T; changed: boolean } {
  const next: Record<string, unknown> = { ...row };
  let changed = false;

  if ('grade' in next) {
    const grade = parsePlayerGrade(next.grade);
    if (grade === undefined) {
      if (next.grade != null && next.grade !== '') {
        delete next.grade;
        changed = true;
      }
    } else if (next.grade !== grade) {
      next.grade = grade;
      changed = true;
    }
  }

  const existingBirth = parseBirthYear(next.birthYear, asOfYear);
  if (
    existingBirth !== undefined &&
    next.birthYear !== existingBirth
  ) {
    next.birthYear = existingBirth;
    changed = true;
  } else if (
    existingBirth === undefined &&
    next.birthYear != null &&
    next.birthYear !== ''
  ) {
    delete next.birthYear;
    changed = true;
  }

  if ('age' in next) {
    if (existingBirth === undefined) {
      const ageRaw = next.age;
      const age =
        typeof ageRaw === 'number' ? ageRaw : Number(String(ageRaw ?? '').trim());
      if (Number.isFinite(age) && age >= 1 && age <= 99) {
        next.birthYear = birthYearFromAge(age, asOfYear);
      }
    }
    delete next.age;
    changed = true;
  }

  return { player: next as T, changed };
}
