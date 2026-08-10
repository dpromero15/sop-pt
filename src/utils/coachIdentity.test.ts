import { describe, expect, it } from 'vitest';
import { LocalJsonAdapter } from '../services/storage/localJsonAdapter';
import { StorageService } from '../services/storage';
import { ensureSignedInCoach } from './coachIdentity';

describe('ensureSignedInCoach', () => {
  it('creates a coach linked to uid/email', () => {
    StorageService.saveCoaches([]);
    const coach = ensureSignedInCoach({
      uid: 'uid_1',
      email: 'coach@example.com',
      displayName: 'Alex Coach',
    });
    expect(coach).not.toBeNull();
    expect(coach!.name).toBe('Alex Coach');
    expect(coach!.uid).toBe('uid_1');
    expect(coach!.email).toBe('coach@example.com');

    const again = ensureSignedInCoach({
      uid: 'uid_1',
      email: 'coach@example.com',
      displayName: 'Alex Coach',
    });
    expect(again!.id).toBe(coach!.id);
  });

  it('prefers membership coach display name', () => {
    StorageService.saveCoaches([]);
    const coach = ensureSignedInCoach({
      uid: 'uid_2',
      email: 'b@example.com',
      displayName: 'Google Name',
      membershipCoachName: 'Rivera',
    });
    expect(coach!.name).toBe('Rivera');
  });
});

describe('LocalJsonAdapter coaches uid', () => {
  it('stores uid/email on addCoach', () => {
    const adapter = new LocalJsonAdapter();
    const c = adapter.addCoach({
      name: 'Patel',
      uid: 'u9',
      email: 'p@ex.com',
    });
    expect(adapter.getCoaches().find((x) => x.id === c.id)?.uid).toBe('u9');
  });
});
