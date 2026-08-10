import { describe, expect, it } from 'vitest';
import {
  can,
  maxRole,
  resolveEffectiveAccess,
  roleAtLeast,
  roleLabel,
} from './roles';

describe('roles', () => {
  it('ranks roles', () => {
    expect(roleAtLeast('teamAdmin', 'dataEntry')).toBe(true);
    expect(roleAtLeast('viewer', 'dataEntry')).toBe(false);
    expect(maxRole('viewer', 'teamAdmin')).toBe('teamAdmin');
  });

  it('resolves system admin over membership', () => {
    const access = resolveEffectiveAccess({
      systemRole: 'systemAdmin',
      membershipRole: 'viewer',
      teamId: 't1',
    });
    expect(access.role).toBe('systemAdmin');
  });

  it('resolves membership role', () => {
    const access = resolveEffectiveAccess({
      systemRole: 'none',
      membershipRole: 'dataEntry',
      teamId: 't1',
    });
    expect(access.role).toBe('dataEntry');
  });

  it('enforces capability matrix', () => {
    expect(can('viewer', 'view')).toBe(true);
    expect(can('viewer', 'dataEntry')).toBe(false);
    expect(can('dataEntry', 'adjustedBumps')).toBe(true);
    expect(can('dataEntry', 'configWrite')).toBe(false);
    expect(can('teamAdmin', 'configWrite')).toBe(true);
    expect(can('teamAdmin', 'cloudSync')).toBe(false);
    expect(can('systemAdmin', 'cloudSync')).toBe(true);
    expect(can('none', 'view')).toBe(false);
  });

  it('labels roles', () => {
    expect(roleLabel('systemAdmin')).toContain('System');
  });
});
