import { describe, expect, it, afterEach } from 'vitest';
import {
  DEF_POSITIONS,
  FWD_POSITIONS,
  MID_POSITIONS,
  PLAYER_POSITION_CODES,
  assignDefaultPlayerPositions,
  ensureCatalogCoversCodes,
  formatPlayerPosition,
  formatPlayerPositions,
  isPlayerPosition,
  normalizePlayerPositions,
  playerHasPosition,
  playerPositionCodes,
  setActivePositionCatalog,
} from './playerPositions';

afterEach(() => {
  setActivePositionCatalog(null);
});

describe('playerPositions', () => {
  it('labels include classic tactical numbers, with LCB/RCB instead of CB 4/5', () => {
    expect(formatPlayerPosition('GK')).toBe('GK (1)');
    expect(formatPlayerPosition('ST')).toBe('ST (9)');
    expect(formatPlayerPosition('F9')).toBe('False 9 (9)');
    expect(formatPlayerPosition('WB')).toBe('WB (2/3)');
    expect(formatPlayerPosition('CDM')).toBe('CDM (6)');
    expect(formatPlayerPosition('CAM')).toBe('CAM (10)');
    expect(formatPlayerPosition('RCB')).toBe('RCB (4)');
    expect(formatPlayerPosition('LCB')).toBe('LCB (5)');
    expect(formatPlayerPosition('CB')).toBe('CB (4/5)');
  });

  it('accepts wing-back, false-nine, and split center-back codes', () => {
    expect(isPlayerPosition('WB')).toBe(true);
    expect(isPlayerPosition('LWB')).toBe(true);
    expect(isPlayerPosition('RWB')).toBe(true);
    expect(isPlayerPosition('F9')).toBe(true);
    expect(isPlayerPosition('LCB')).toBe(true);
    expect(isPlayerPosition('RCB')).toBe(true);
    expect(isPlayerPosition('CB')).toBe(true);
    expect(isPlayerPosition('XX')).toBe(false);
  });

  it('groups defenders / mids / forwards for roster filters', () => {
    expect(DEF_POSITIONS).toEqual(
      expect.arrayContaining(['LCB', 'RCB', 'LB', 'RB', 'WB', 'LWB', 'RWB']),
    );
    expect(DEF_POSITIONS).not.toContain('CB');
    expect(MID_POSITIONS).toEqual(
      expect.arrayContaining(['CDM', 'CM', 'CAM', 'LM', 'RM']),
    );
    expect(FWD_POSITIONS).toEqual(
      expect.arrayContaining(['LW', 'RW', 'ST', 'CF', 'SS', 'F9']),
    );
    expect(PLAYER_POSITION_CODES).toContain('LCB');
    expect(PLAYER_POSITION_CODES).toContain('RCB');
    expect(PLAYER_POSITION_CODES).not.toContain('CB');
    expect(PLAYER_POSITION_CODES).toContain('F9');
  });

  it('normalizes a custom catalog and keeps leftover CB if still on the roster', () => {
    const catalog = normalizePlayerPositions([
      { code: 'lcb', name: 'LCB', tacticalNumber: 5, line: 'def', rankingPool: 'center-defense', sortOrder: 2 },
      { code: 'rcb', name: 'RCB', tacticalNumber: 4, line: 'def', rankingPool: 'center-defense', sortOrder: 1 },
    ]);
    expect(catalog.map((p) => p.code)).toEqual(['RCB', 'LCB']);
    const withLegacy = ensureCatalogCoversCodes(catalog, ['CB', 'lcb']);
    expect(withLegacy.find((p) => p.code === 'CB')).toMatchObject({
      name: 'CB',
      tacticalNumber: 4,
      tacticalNumberSecondary: 5,
    });
    expect(formatPlayerPosition('RCB', withLegacy)).toBe('RCB (4)');
  });

  it('falls back to defaults when the stored catalog is empty', () => {
    const catalog = normalizePlayerPositions([]);
    expect(catalog.some((p) => p.code === 'LCB')).toBe(true);
    expect(catalog.some((p) => p.code === 'RCB')).toBe(true);
    expect(catalog.some((p) => p.code === 'CB')).toBe(false);
  });

  it('treats extra assigned roles as playable positions', () => {
    const player = {
      position: 'RW',
      positions: ['RW', 'ST', 'rw'],
    };
    expect(playerPositionCodes(player)).toEqual(['RW', 'ST']);
    expect(playerHasPosition(player, 'ST')).toBe(true);
    expect(playerHasPosition(player, 'LCB')).toBe(false);
    expect(formatPlayerPositions(player)).toContain('RW');
    expect(formatPlayerPositions(player)).toContain('ST');
  });

  it('backfills positions[] from primary without dropping extras', () => {
    const { rows, changed } = assignDefaultPlayerPositions([
      { id: 'p1', position: 'ST' },
      { id: 'p2', position: 'RW', positions: ['RW', 'ST'] },
    ]);
    expect(changed).toBe(true);
    expect(rows[0]).toMatchObject({ position: 'ST', positions: ['ST'] });
    expect(rows[1]).toMatchObject({ position: 'RW', positions: ['RW', 'ST'] });
    const again = assignDefaultPlayerPositions(rows);
    expect(again.changed).toBe(false);
  });
});
