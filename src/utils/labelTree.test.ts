import { describe, expect, it } from 'vitest';
import type { LabelDefinition, MetricDefinition } from '../types';
import { ATTENDANCE_LABEL } from './formulaWeights';
import {
  allocateLabelId,
  childrenOf,
  deleteLabelBlockReason,
  isRootLabel,
  labelPathName,
  metricInLabelTree,
  metricScoresInLabelTree,
  metricsForCategoryScope,
  normalizeLabelForest,
  parentIdsOf,
  primaryParentIdOf,
  resolveTreeMembership,
  rootLabels,
  standingLabelIdForScope,
  toggleTreeMembership,
  treeIds,
} from './labelTree';

const speed: LabelDefinition = {
  id: 'speed',
  name: 'Speed',
  description: '',
  color: 'blue',
  badgeBg: '',
  badgeText: '',
};

const accel: LabelDefinition = {
  id: 'acceleration',
  name: 'Acceleration',
  description: '',
  color: 'blue',
  badgeBg: '',
  badgeText: '',
  parentLabelId: 'speed',
};

const top: LabelDefinition = {
  id: 'top_speed',
  name: 'Top Speed',
  description: '',
  color: 'blue',
  badgeBg: '',
  badgeText: '',
  parentLabelId: 'speed',
};

const fitness: LabelDefinition = {
  id: 'fitness',
  name: 'Fitness',
  description: '',
  color: 'rose',
  badgeBg: '',
  badgeText: '',
};

const offense: LabelDefinition = {
  id: 'offense',
  name: 'Offense',
  description: '',
  color: 'amber',
  badgeBg: '',
  badgeText: '',
};

const defense: LabelDefinition = {
  id: 'defense',
  name: 'Defense',
  description: '',
  color: 'cyan',
  badgeBg: '',
  badgeText: '',
};

const midfield: LabelDefinition = {
  id: 'midfield',
  name: 'Midfield',
  description: '',
  color: 'indigo',
  badgeBg: '',
  badgeText: '',
};

const endurance: LabelDefinition = {
  id: 'endurance',
  name: 'Endurance',
  description: '',
  color: 'amber',
  badgeBg: '',
  badgeText: '',
  parentLabelIds: ['offense', 'defense', 'midfield'],
  primaryParentLabelId: 'offense',
  parentLabelId: 'offense',
};

const forest = [ATTENDANCE_LABEL, speed, accel, top, fitness];
const sharedForest = [
  ATTENDANCE_LABEL,
  offense,
  defense,
  midfield,
  endurance,
  fitness,
];

function metric(
  id: string,
  labelIds: string[],
  primaryLabelId = labelIds[0],
): MetricDefinition {
  return {
    id,
    name: id,
    labelIds,
    primaryLabelId,
    type: 'time_seconds',
    unit: 's',
    higherIsBetter: false,
    aggregationMode: 'best',
  };
}

describe('label forest', () => {
  it('lists roots with Attendance first', () => {
    expect(rootLabels(forest).map((l) => l.id)).toEqual([
      'attendance',
      'speed',
      'fitness',
    ]);
  });

  it('lists children and tree ids', () => {
    expect(childrenOf(forest, 'speed').map((l) => l.id)).toEqual([
      'acceleration',
      'top_speed',
    ]);
    expect(treeIds(forest, 'speed')).toEqual([
      'speed',
      'acceleration',
      'top_speed',
    ]);
    expect(isRootLabel(speed)).toBe(true);
    expect(isRootLabel(accel)).toBe(false);
  });

  it('formats nested display names', () => {
    expect(labelPathName(forest, 'speed')).toBe('Speed');
    expect(labelPathName(forest, 'acceleration')).toBe('Speed / Acceleration');
    expect(labelPathName(sharedForest, 'endurance')).toBe(
      'Endurance · Offense, Defense, Midfield',
    );
  });

  it('allocates unique slugs', () => {
    expect(allocateLabelId('Speed', ['speed'])).toBe('speed_2');
    expect(allocateLabelId('Top Speed', [])).toBe('top_speed');
  });
});

describe('normalizeLabelForest', () => {
  it('strips missing, self, attendance, and grandchild parents', () => {
    const { labels, changed } = normalizeLabelForest([
      speed,
      { ...accel, parentLabelId: 'missing' },
      { id: 'loop', name: 'Loop', description: '', color: '', badgeBg: '', badgeText: '', parentLabelId: 'loop' },
      { ...ATTENDANCE_LABEL, parentLabelId: 'speed' },
      {
        id: 'too_deep',
        name: 'Deep',
        description: '',
        color: '',
        badgeBg: '',
        badgeText: '',
        parentLabelId: 'acceleration',
      },
    ]);
    expect(changed).toBe(true);
    expect(labels.find((l) => l.id === 'acceleration')?.parentLabelId).toBeUndefined();
    expect(labels.find((l) => l.id === 'loop')?.parentLabelId).toBeUndefined();
    expect(labels.find((l) => l.id === 'attendance')?.parentLabelId).toBeUndefined();
    expect(labels.find((l) => l.id === 'too_deep')?.parentLabelId).toBeUndefined();
  });

  it('keeps multiple valid root parents and a primary', () => {
    const { labels, changed } = normalizeLabelForest([
      offense,
      defense,
      midfield,
      {
        ...endurance,
        parentLabelIds: ['offense', 'defense', 'midfield', 'missing', 'endurance'],
        primaryParentLabelId: 'defense',
      },
    ]);
    expect(changed).toBe(true);
    const child = labels.find((l) => l.id === 'endurance');
    expect(parentIdsOf(child!)).toEqual(['offense', 'defense', 'midfield']);
    expect(primaryParentIdOf(child!)).toBe('defense');
    expect(child?.parentLabelId).toBe('defense');
  });
});

describe('resolveTreeMembership', () => {
  it('keeps one id per tree and prefers the subcategory', () => {
    const { labelIds, stripped } = resolveTreeMembership(
      ['speed', 'acceleration', 'fitness', 'top_speed'],
      forest,
    );
    expect(labelIds).toEqual(['acceleration', 'fitness']);
    expect(stripped.sort()).toEqual(['speed', 'top_speed']);
  });

  it('allows the same metric in two parent trees', () => {
    const { labelIds, stripped } = resolveTreeMembership(
      ['acceleration', 'fitness'],
      forest,
    );
    expect(labelIds).toEqual(['acceleration', 'fitness']);
    expect(stripped).toEqual([]);
  });
});

describe('toggleTreeMembership', () => {
  it('moves parent membership onto a subcategory without unchecking first', () => {
    expect(
      toggleTreeMembership(['speed'], 'acceleration', true, forest),
    ).toEqual(['acceleration']);
  });

  it('switches sibling subcategories and back to the parent', () => {
    expect(
      toggleTreeMembership(['acceleration'], 'top_speed', true, forest),
    ).toEqual(['top_speed']);
    expect(
      toggleTreeMembership(['top_speed'], 'speed', true, forest),
    ).toEqual(['speed']);
  });

  it('leaves other parent trees intact', () => {
    expect(
      toggleTreeMembership(['speed', 'fitness'], 'acceleration', true, forest),
    ).toEqual(['fitness', 'acceleration']);
  });

  it('unchecks the selected id', () => {
    expect(
      toggleTreeMembership(['acceleration', 'fitness'], 'acceleration', false, forest),
    ).toEqual(['fitness']);
  });

  it('checking a shared subcategory clears every parent tree it belongs to', () => {
    expect(
      toggleTreeMembership(
        ['offense', 'defense', 'fitness'],
        'endurance',
        true,
        sharedForest,
      ),
    ).toEqual(['fitness', 'endurance']);
  });
});

describe('membership / scoring in a tree', () => {
  const forty = metric('m_40m', ['acceleration'], 'acceleration');
  const dash = metric('m_dash', ['speed'], 'speed');
  const dual = metric('m_40m_fit', ['acceleration', 'fitness'], 'acceleration');

  it('tree membership includes children on the parent tab', () => {
    expect(metricInLabelTree(forty, 'speed', forest)).toBe(true);
    expect(metricInLabelTree(forty, 'acceleration', forest)).toBe(true);
    expect(metricInLabelTree(forty, 'top_speed', forest)).toBe(false);
    expect(metricInLabelTree(dash, 'speed', forest)).toBe(true);
  });

  it('parent standing includes child primaries; siblings do not', () => {
    expect(metricScoresInLabelTree(forty, 'speed', forest)).toBe(true);
    expect(metricScoresInLabelTree(forty, 'acceleration', forest)).toBe(true);
    expect(metricScoresInLabelTree(forty, 'top_speed', forest)).toBe(false);
    expect(metricScoresInLabelTree(forty, 'fitness', forest)).toBe(false);
    expect(metricScoresInLabelTree(dual, 'fitness', forest)).toBe(false);
    expect(metricScoresInLabelTree(dual, 'speed', forest)).toBe(true);
  });

  it('shared subcategory browse appears under every parent; standing only on primary', () => {
    const beep = metric('m_beep', ['endurance'], 'endurance');
    expect(metricInLabelTree(beep, 'offense', sharedForest)).toBe(true);
    expect(metricInLabelTree(beep, 'defense', sharedForest)).toBe(true);
    expect(metricInLabelTree(beep, 'midfield', sharedForest)).toBe(true);
    expect(metricInLabelTree(beep, 'fitness', sharedForest)).toBe(false);
    expect(metricScoresInLabelTree(beep, 'offense', sharedForest)).toBe(true);
    expect(metricScoresInLabelTree(beep, 'defense', sharedForest)).toBe(false);
    expect(metricScoresInLabelTree(beep, 'midfield', sharedForest)).toBe(false);
    expect(metricScoresInLabelTree(beep, 'endurance', sharedForest)).toBe(true);
  });

  it('scopes rank-by chips for All / Direct / subcategory', () => {
    const metrics = [forty, dash, dual];
    expect(
      metricsForCategoryScope(metrics, 'speed', 'all', forest).map((m) => m.id),
    ).toEqual(['m_40m', 'm_dash', 'm_40m_fit']);
    expect(
      metricsForCategoryScope(metrics, 'speed', 'direct', forest).map((m) => m.id),
    ).toEqual(['m_dash']);
    expect(
      metricsForCategoryScope(metrics, 'speed', 'acceleration', forest).map(
        (m) => m.id,
      ),
    ).toEqual(['m_40m', 'm_40m_fit']);
  });

  it('maps sub-chip to standing label id', () => {
    expect(standingLabelIdForScope('speed', 'all')).toBe('speed');
    expect(standingLabelIdForScope('speed', 'direct')).toBe('speed');
    expect(standingLabelIdForScope('speed', 'acceleration')).toBe('acceleration');
    expect(standingLabelIdForScope('all', 'acceleration')).toBe('all');
  });
});

describe('deleteLabelBlockReason', () => {
  it('blocks parents with children and in-use labels', () => {
    expect(deleteLabelBlockReason('speed', forest, [])).toMatch(/subcategor/i);
    expect(
      deleteLabelBlockReason('acceleration', forest, [
        metric('m_40m', ['acceleration']),
      ]),
    ).toMatch(/reassign/i);
    expect(deleteLabelBlockReason('fitness', forest, [])).toBeNull();
    expect(deleteLabelBlockReason('defense', sharedForest, [])).toBeNull();
  });
});
