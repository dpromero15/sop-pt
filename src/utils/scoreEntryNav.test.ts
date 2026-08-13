import { describe, expect, it } from 'vitest';
import { nextEligiblePlayerDown, scoreCellKey } from './scoreEntryNav';

describe('nextEligiblePlayerDown', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const allEligible = () => true;
  const skipC = (id: string) => id !== 'c';

  it('returns the next player in roster order', () => {
    expect(nextEligiblePlayerDown(ids, 'a', allEligible)).toBe('b');
    expect(nextEligiblePlayerDown(ids, 'b', allEligible)).toBe('c');
  });

  it('skips ineligible players', () => {
    expect(nextEligiblePlayerDown(ids, 'b', skipC)).toBe('d');
  });

  it('returns null on the last eligible player', () => {
    expect(nextEligiblePlayerDown(ids, 'd', allEligible)).toBeNull();
    expect(nextEligiblePlayerDown(ids, 'c', skipC)).toBe('d');
    expect(nextEligiblePlayerDown(ids, 'd', skipC)).toBeNull();
  });

  it('returns null when current player is unknown', () => {
    expect(nextEligiblePlayerDown(ids, 'z', allEligible)).toBeNull();
  });
});

describe('scoreCellKey', () => {
  it('joins player and metric ids', () => {
    expect(scoreCellKey('p1', 'm_goals')).toBe('p1:m_goals');
  });
});
