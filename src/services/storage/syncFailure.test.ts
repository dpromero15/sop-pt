import { describe, expect, it } from 'vitest';
import { classifySyncFailure, isTransientSyncFailure } from './syncFailure';

describe('classifySyncFailure', () => {
  it('treats gateway blips and timeouts as transient', () => {
    expect(
      classifySyncFailure('API unreachable at https://sop-pt-gateway.example.'),
    ).toBe('transient');
    expect(classifySyncFailure('API timed out after 12s (https://x).')).toBe(
      'transient',
    );
    expect(classifySyncFailure('Failed to fetch')).toBe('transient');
    expect(classifySyncFailure('API 503: unavailable')).toBe('transient');
    expect(classifySyncFailure('API 429: rate limit')).toBe('transient');
    expect(isTransientSyncFailure('TypeError: Load failed')).toBe(true);
  });

  it('treats sign-in and permission failures as auth', () => {
    expect(classifySyncFailure('Not signed in.')).toBe('auth');
    expect(classifySyncFailure('API 401: unauthorized')).toBe('auth');
    expect(classifySyncFailure('API 403: forbidden')).toBe('auth');
  });

  it('treats other 4xx as fatal', () => {
    expect(classifySyncFailure('API 400: bad request')).toBe('fatal');
    expect(classifySyncFailure('API 404: missing')).toBe('fatal');
  });
});
