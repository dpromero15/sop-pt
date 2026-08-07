import { describe, expect, it } from 'vitest';
import {
  PLAYER_CSV_HEADERS,
  buildPlayerCsvTemplate,
  parseAndValidatePlayerCsv,
} from './playerCsv';

describe('playerCsv', () => {
  it('builds a template with headers and one example row', () => {
    const template = buildPlayerCsvTemplate();
    const lines = template.trim().split('\n');
    expect(lines[0]).toBe(PLAYER_CSV_HEADERS.join(','));
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('Alex Example');
  });

  it('parses valid rows with defaults', () => {
    const csv = [
      PLAYER_CSV_HEADERS.join(','),
      'Jamie Doe,7,ST,,,',
      'Sam Lee,11,CM,Left,16,,Captain',
    ].join('\n');

    const result = parseAndValidatePlayerCsv(csv, new Set());
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.ok).toHaveLength(2);
    expect(result.ok[0]).toMatchObject({
      name: 'Jamie Doe',
      jerseyNumber: 7,
      position: 'ST',
      preferredFoot: 'Right',
      status: 'active',
    });
    expect(result.ok[1]).toMatchObject({
      name: 'Sam Lee',
      jerseyNumber: 11,
      position: 'CM',
      preferredFoot: 'Left',
      age: 16,
      notes: 'Captain',
      status: 'active',
    });
  });

  it('skips duplicate jersey numbers and invalid positions', () => {
    const csv = [
      PLAYER_CSV_HEADERS.join(','),
      'Taken Number,10,CM',
      'Bad Pos,12,XX',
      'Good Player,13,GK',
    ].join('\n');

    const result = parseAndValidatePlayerCsv(csv, new Set([10]));
    expect(result.ok).toHaveLength(1);
    expect(result.ok[0].name).toBe('Good Player');
    expect(result.skipped).toBe(2);
    expect(result.errors.some((e) => e.includes('duplicate jersey'))).toBe(true);
    expect(result.errors.some((e) => e.includes('invalid position'))).toBe(true);
  });

  it('requires name, jerseyNumber, and position headers', () => {
    const result = parseAndValidatePlayerCsv('foo,bar\n1,2', new Set());
    expect(result.ok).toHaveLength(0);
    expect(result.errors[0]).toMatch(/must include name/i);
  });
});
