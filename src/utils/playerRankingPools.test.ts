import { describe, expect, it } from 'vitest';
import {
  assignDefaultPlayerRankingPools,
  defaultRankingPoolForPosition,
} from './playerRankingPools';

describe('player ranking pools', () => {
  it('maps the requested position groups to their default pools', () => {
    expect(defaultRankingPoolForPosition('LB')).toBe('wingbacks');
    expect(defaultRankingPoolForPosition('RB')).toBe('wingbacks');
    expect(defaultRankingPoolForPosition('CB')).toBe('center-defense');
    expect(defaultRankingPoolForPosition('LCB')).toBe('center-defense');
    expect(defaultRankingPoolForPosition('RCB')).toBe('center-defense');
    expect(defaultRankingPoolForPosition('CDM')).toBe('center-defense');
    expect(defaultRankingPoolForPosition('CAM')).toBe('central-midfield');
    expect(defaultRankingPoolForPosition('CM')).toBe('central-midfield');
    expect(defaultRankingPoolForPosition('ST')).toBe('central-midfield');
    expect(defaultRankingPoolForPosition('LW')).toBe('forwards');
    expect(defaultRankingPoolForPosition('RW')).toBe('forwards');
    expect(defaultRankingPoolForPosition('GK')).toBe('goalkeepers');
  });

  it('backfills missing pools and preserves a coach override', () => {
    const result = assignDefaultPlayerRankingPools([
      { id: 'a', position: 'LB' },
      { id: 'b', position: 'CB', rankingPool: 'forwards' },
    ]);
    expect(result.changed).toBe(true);
    expect(result.rows).toEqual([
      { id: 'a', position: 'LB', rankingPool: 'wingbacks' },
      { id: 'b', position: 'CB', rankingPool: 'forwards' },
    ]);
  });
});
