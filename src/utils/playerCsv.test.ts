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
      'Jamie Doe,7,ST,,,,',
      'Sam Lee,11,CM,Left,2010,11,,Captain',
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
      birthYear: 2010,
      grade: 11,
      notes: 'Captain',
      status: 'active',
    });
  });

  it('accepts a legacy age column as birthYear', () => {
    const csv = ['name,jerseyNumber,position,age', 'Pat,8,ST,15'].join('\n');
    const result = parseAndValidatePlayerCsv(csv, new Set());
    expect(result.ok).toHaveLength(1);
    expect(result.ok[0].birthYear).toBe(new Date().getFullYear() - 15);
    expect(result.ok[0].grade).toBeUndefined();
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

  it('accepts split center-back codes LCB and RCB', () => {
    const csv = [
      PLAYER_CSV_HEADERS.join(','),
      'Left Center,5,LCB',
      'Right Center,4,RCB',
    ].join('\n');
    const result = parseAndValidatePlayerCsv(csv, new Set());
    expect(result.ok).toHaveLength(2);
    expect(result.ok.map((p) => p.position)).toEqual(['LCB', 'RCB']);
  });

  it('imports extra roles from the positions column', () => {
    const csv = [
      'name,jerseyNumber,position,positions',
      'Lucas Silva,7,RW,ST;LCB',
    ].join('\n');
    const result = parseAndValidatePlayerCsv(csv, new Set());
    expect(result.errors).toEqual([]);
    expect(result.ok[0]).toMatchObject({
      name: 'Lucas Silva',
      position: 'RW',
      positions: ['RW', 'ST', 'LCB'],
    });
  });

  it('requires name, jerseyNumber, and position headers', () => {
    const result = parseAndValidatePlayerCsv('foo,bar\n1,2', new Set());
    expect(result.ok).toHaveLength(0);
    expect(result.errors[0]).toMatch(/must include name/i);
  });

  it('accepts a valid publicId and auto-assigns on duplicates', () => {
    const csv = [
      PLAYER_CSV_HEADERS.join(','),
      'Jamie Doe,7,ST,,,,,,AB2DEF',
      'Sam Lee,11,CM,,,,,,AB2DEF',
    ].join('\n');
    const result = parseAndValidatePlayerCsv(csv, new Set());
    expect(result.ok).toHaveLength(2);
    expect(result.ok[0]?.publicId).toBe('AB2DEF');
    expect(result.ok[1]?.publicId).toBeUndefined();
    expect(result.errors.some((e) => e.includes('duplicate publicId'))).toBe(
      true,
    );
  });

  it('accepts wing-back and false-nine codes', () => {
    const csv = [
      PLAYER_CSV_HEADERS.join(','),
      'Wing Back,2,WB',
      'False Nine,9,F9',
    ].join('\n');
    const result = parseAndValidatePlayerCsv(csv, new Set());
    expect(result.errors).toEqual([]);
    expect(result.ok).toMatchObject([
      { name: 'Wing Back', position: 'WB' },
      { name: 'False Nine', position: 'F9' },
    ]);
  });

  it('parses subTeams names against the catalog', () => {
    const csv = [
      PLAYER_CSV_HEADERS.join(','),
      ['Pat', '8', 'ST', '', '', '', '', '', '', 'central-midfield', '', 'Varsity;JV'].join(','),
    ].join('\n');
    const result = parseAndValidatePlayerCsv(csv, new Set(), new Set(), [
      {
        id: 'st_varsity',
        name: 'Varsity',
        shortName: 'V',
        color: 'emerald',
        sortOrder: 0,
      },
      {
        id: 'st_jv',
        name: 'JV',
        shortName: 'JV',
        color: 'blue',
        sortOrder: 1,
      },
    ]);
    expect(result.ok[0].squadIds).toEqual(['st_varsity', 'st_jv']);
  });
});
