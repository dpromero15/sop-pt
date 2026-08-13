import { describe, expect, it } from 'vitest';
import { normalizeComplianceRequirement } from './normalizeCompliance';

describe('normalizeComplianceRequirement', () => {
  it('defaults missing blocksPractice to false', () => {
    const legacy = {
      id: 'r1',
      name: 'Fee',
      kind: 'fee' as const,
      blocksPlay: false,
      sortOrder: 1,
    };
    const normalized = normalizeComplianceRequirement(
      legacy as Parameters<typeof normalizeComplianceRequirement>[0],
    );
    expect(normalized.blocksPractice).toBe(false);
  });

  it('preserves disciplinary kind', () => {
    const normalized = normalizeComplianceRequirement({
      id: 'r2',
      name: 'Red card',
      kind: 'disciplinary',
      blocksPlay: true,
      blocksPractice: false,
      sortOrder: 2,
    });
    expect(normalized.kind).toBe('disciplinary');
  });

  it('defaults missing blocksEquipment to false', () => {
    const normalized = normalizeComplianceRequirement({
      id: 'r3',
      name: 'Policy',
      kind: 'paperwork',
      blocksPlay: true,
      blocksPractice: false,
      sortOrder: 3,
    });
    expect(normalized.blocksEquipment).toBe(false);
  });
});
