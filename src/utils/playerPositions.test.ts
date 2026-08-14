import { describe, expect, it } from 'vitest';
import {
  DEF_POSITIONS,
  FWD_POSITIONS,
  MID_POSITIONS,
  PLAYER_POSITION_CODES,
  formatPlayerPosition,
  isPlayerPosition,
} from './playerPositions';

describe('playerPositions', () => {
  it('labels include classic tactical numbers', () => {
    expect(formatPlayerPosition('GK')).toBe('GK (1)');
    expect(formatPlayerPosition('ST')).toBe('ST (9)');
    expect(formatPlayerPosition('F9')).toBe('False 9 (9)');
    expect(formatPlayerPosition('WB')).toBe('WB (2/3)');
    expect(formatPlayerPosition('CDM')).toBe('CDM (6)');
    expect(formatPlayerPosition('CAM')).toBe('CAM (10)');
  });

  it('accepts new wing-back and false-nine codes', () => {
    expect(isPlayerPosition('WB')).toBe(true);
    expect(isPlayerPosition('LWB')).toBe(true);
    expect(isPlayerPosition('RWB')).toBe(true);
    expect(isPlayerPosition('F9')).toBe(true);
    expect(isPlayerPosition('XX')).toBe(false);
  });

  it('groups defenders / mids / forwards for roster filters', () => {
    expect(DEF_POSITIONS).toEqual(
      expect.arrayContaining(['CB', 'LB', 'RB', 'WB', 'LWB', 'RWB']),
    );
    expect(MID_POSITIONS).toEqual(
      expect.arrayContaining(['CDM', 'CM', 'CAM', 'LM', 'RM']),
    );
    expect(FWD_POSITIONS).toEqual(
      expect.arrayContaining(['LW', 'RW', 'ST', 'CF', 'SS', 'F9']),
    );
    expect(PLAYER_POSITION_CODES).toContain('WB');
    expect(PLAYER_POSITION_CODES).toContain('F9');
  });
});
