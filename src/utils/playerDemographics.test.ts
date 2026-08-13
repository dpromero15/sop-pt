import { describe, expect, it } from 'vitest';
import {
  ageFromBirthYear,
  birthYearFromAge,
  formatPlayerGrade,
  migratePlayerDemographics,
  parseBirthYear,
  parsePlayerGrade,
} from './playerDemographics';

describe('playerDemographics', () => {
  it('converts age ↔ birth year for a fixed as-of year', () => {
    expect(birthYearFromAge(15, 2026)).toBe(2011);
    expect(ageFromBirthYear(2011, 2026)).toBe(15);
  });

  it('parses valid grades and birth years', () => {
    expect(parsePlayerGrade('11')).toBe(11);
    expect(parsePlayerGrade(8)).toBeUndefined();
    expect(parseBirthYear(2010, 2026)).toBe(2010);
    expect(parseBirthYear(2025, 2026)).toBeUndefined();
    expect(parseBirthYear(1800, 2026)).toBeUndefined();
  });

  it('formats grade with class year', () => {
    expect(formatPlayerGrade(11)).toBe('11 · Junior');
  });

  it('migrates age to birthYear and drops age', () => {
    const { player, changed } = migratePlayerDemographics(
      { id: 'p1', name: 'Ada', age: 16 },
      2026,
    );
    expect(changed).toBe(true);
    expect(player).toEqual({ id: 'p1', name: 'Ada', birthYear: 2010 });
  });

  it('keeps existing birthYear and still drops age', () => {
    const { player } = migratePlayerDemographics(
      { id: 'p1', birthYear: 2009, age: 15 },
      2026,
    );
    expect(player).toEqual({ id: 'p1', birthYear: 2009 });
  });

  it('is idempotent when already migrated', () => {
    const once = migratePlayerDemographics(
      { id: 'p1', birthYear: 2010, grade: 11 },
      2026,
    );
    expect(once.changed).toBe(false);
    const twice = migratePlayerDemographics(once.player, 2026);
    expect(twice.changed).toBe(false);
    expect(twice.player).toEqual({ id: 'p1', birthYear: 2010, grade: 11 });
  });

  it('strips invalid grade', () => {
    const { player, changed } = migratePlayerDemographics(
      { id: 'p1', grade: 8 },
      2026,
    );
    expect(changed).toBe(true);
    expect(player).toEqual({ id: 'p1' });
  });
});
