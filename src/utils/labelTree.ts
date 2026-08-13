import type { LabelDefinition, MetricDefinition } from '../types';

const ATTENDANCE_ID = 'attendance';

function metricLabelIds(
  metric: Pick<MetricDefinition, 'labelIds' | 'primaryLabelId'> & {
    labelId?: string;
  },
): string[] {
  if (Array.isArray(metric.labelIds) && metric.labelIds.length > 0) {
    return metric.labelIds;
  }
  if (typeof metric.labelId === 'string' && metric.labelId.trim()) {
    return [metric.labelId.trim()];
  }
  return [];
}

export type LabelTreePick = Pick<LabelDefinition, 'id' | 'parentLabelId' | 'system'>;

/** True when the label is a top-level category (no parent). */
export function isRootLabel(label: LabelTreePick): boolean {
  return !label.parentLabelId;
}

/** True when the label is a subcategory. */
export function isSubcategory(label: LabelTreePick): boolean {
  return Boolean(label.parentLabelId);
}

/** Direct children of a parent (depth 1 only). */
export function childrenOf(labels: LabelDefinition[], parentId: string): LabelDefinition[] {
  return labels.filter((l) => l.parentLabelId === parentId);
}

/** Parent id plus every direct child id. */
export function treeIds(labels: LabelTreePick[], parentId: string): string[] {
  return [
    parentId,
    ...labels.filter((l) => l.parentLabelId === parentId).map((l) => l.id),
  ];
}

/** Root categories, Attendance first. */
export function rootLabels(labels: LabelDefinition[]): LabelDefinition[] {
  const roots = labels.filter((l) => isRootLabel(l));
  const withoutAtt = roots.filter((l) => l.id !== ATTENDANCE_ID);
  const attendance = roots.find((l) => l.id === ATTENDANCE_ID);
  return attendance ? [attendance, ...withoutAtt] : withoutAtt;
}

/** Display path: `Speed` or `Speed / Acceleration`. */
export function labelPathName(
  labels: Pick<LabelDefinition, 'id' | 'name' | 'parentLabelId'>[],
  labelId: string,
): string {
  const label = labels.find((l) => l.id === labelId);
  if (!label) return labelId;
  if (!label.parentLabelId) return label.name;
  const parent = labels.find((l) => l.id === label.parentLabelId);
  return parent ? `${parent.name} / ${label.name}` : label.name;
}

/** Slug a name, then suffix `_2`, `_3`… if the id already exists. */
export function allocateLabelId(name: string, existingIds: Iterable<string>): string {
  const used = new Set(existingIds);
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `lbl_${Date.now()}`;
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

/**
 * Drop invalid `parentLabelId` (missing parent, self, attendance, grandchild).
 * Does not invent new labels.
 */
export function normalizeLabelForest<T extends LabelTreePick>(
  labels: T[],
): { labels: T[]; changed: boolean } {
  const byId = new Map(labels.map((l) => [l.id, l]));
  let changed = false;
  const next = labels.map((label) => {
    const parentId = label.parentLabelId?.trim();
    if (!parentId) {
      if (label.parentLabelId) {
        changed = true;
        const { parentLabelId: _drop, ...rest } = label;
        return rest as T;
      }
      return label;
    }

    const invalid =
      parentId === label.id ||
      parentId === ATTENDANCE_ID ||
      label.id === ATTENDANCE_ID ||
      !byId.has(parentId);

    if (invalid) {
      changed = true;
      const { parentLabelId: _drop, ...rest } = label;
      return rest as T;
    }

    const parent = byId.get(parentId);
    if (parent?.parentLabelId) {
      changed = true;
      const { parentLabelId: _drop, ...rest } = label;
      return rest as T;
    }

    if (label.parentLabelId !== parentId) {
      changed = true;
      return { ...label, parentLabelId: parentId };
    }
    return label;
  });

  return { labels: next, changed };
}

/**
 * Within each parent tree, keep at most one membership.
 * Prefer the most specific id (subcategory over parent / sibling).
 */
export function resolveTreeMembership(
  labelIds: string[],
  labels: LabelTreePick[],
): { labelIds: string[]; stripped: string[] } {
  const { labels: forest } = normalizeLabelForest(labels);
  const byId = new Map(forest.map((l) => [l.id, l]));
  const known = new Set(forest.map((l) => l.id));
  const stripped: string[] = [];
  const kept: string[] = [];
  const seen = new Set<string>();

  const unique = Array.from(
    new Set(labelIds.map((id) => id.trim()).filter(Boolean)),
  ).filter((id) => {
    if (known.has(id)) return true;
    stripped.push(id);
    return false;
  });

  const rootOf = (id: string): string => {
    const label = byId.get(id);
    return label?.parentLabelId || id;
  };

  const specificity = (id: string): number =>
    byId.get(id)?.parentLabelId ? 1 : 0;

  const byRoot = new Map<string, string[]>();
  for (const id of unique) {
    const root = rootOf(id);
    const list = byRoot.get(root) ?? [];
    list.push(id);
    byRoot.set(root, list);
  }

  for (const group of byRoot.values()) {
    if (group.length === 1) {
      if (!seen.has(group[0])) {
        kept.push(group[0]);
        seen.add(group[0]);
      }
      continue;
    }
    group.sort((a, b) => specificity(b) - specificity(a));
    const winner = group[0];
    if (!seen.has(winner)) {
      kept.push(winner);
      seen.add(winner);
    }
    for (const id of group.slice(1)) {
      stripped.push(id);
    }
  }

  return { labelIds: kept, stripped };
}

/** Membership appears under this exact label (not the whole tree). */
export function metricInExactLabel(
  metric: Pick<MetricDefinition, 'labelIds' | 'primaryLabelId'> & {
    labelId?: string;
  },
  labelId: string,
): boolean {
  return metricLabelIds(metric).includes(labelId);
}

/** Membership appears under this label or, if it is a parent, any child. */
export function metricInLabelTree(
  metric: Pick<MetricDefinition, 'labelIds' | 'primaryLabelId'> & {
    labelId?: string;
  },
  labelId: string,
  labels: LabelTreePick[],
): boolean {
  const ids = new Set(metricLabelIds(metric));
  const label = labels.find((l) => l.id === labelId);
  if (!label || label.parentLabelId) {
    return ids.has(labelId);
  }
  return treeIds(labels, labelId).some((id) => ids.has(id));
}

/**
 * Formula standing: primary is this label, or (when this is a parent)
 * primary is one of its children.
 */
export function metricScoresInLabelTree(
  metric: Pick<MetricDefinition, 'labelIds' | 'primaryLabelId'> & {
    labelId?: string;
  },
  labelId: string,
  labels: LabelTreePick[],
): boolean {
  const primaryLabelId = metric.primaryLabelId || metricLabelIds(metric)[0];
  if (primaryLabelId === labelId) return true;
  const label = labels.find((l) => l.id === labelId);
  if (!label || label.parentLabelId) return false;
  return labels.some(
    (l) => l.id === primaryLabelId && l.parentLabelId === labelId,
  );
}

export type CategorySubScope = 'all' | 'direct' | string;

/**
 * Metrics shown for a Rankings category tab + optional sub-chip.
 * `subScope` of a child id filters to that subcategory only.
 */
export function metricsForCategoryScope(
  metrics: MetricDefinition[],
  selectedLabelId: string | 'all',
  subScope: CategorySubScope,
  labels: LabelTreePick[],
): MetricDefinition[] {
  if (selectedLabelId === 'all') return metrics;
  if (subScope === 'direct') {
    return metrics.filter((m) => metricInExactLabel(m, selectedLabelId));
  }
  if (subScope !== 'all') {
    return metrics.filter((m) => metricInExactLabel(m, subScope));
  }
  return metrics.filter((m) =>
    metricInLabelTree(m, selectedLabelId, labels),
  );
}

/** Label id used for category standing given the active sub-chip. */
export function standingLabelIdForScope(
  selectedLabelId: string | 'all',
  subScope: CategorySubScope,
): string | 'all' {
  if (selectedLabelId === 'all') return 'all';
  if (subScope !== 'all' && subScope !== 'direct') return subScope;
  return selectedLabelId;
}

export function canParentHaveChildren(label: LabelTreePick): boolean {
  return isRootLabel(label) && label.id !== ATTENDANCE_ID && !label.system;
}

export function deleteLabelBlockReason(
  id: string,
  labels: LabelTreePick[],
  metrics: Pick<MetricDefinition, 'labelIds' | 'primaryLabelId'>[],
): string | null {
  const label = labels.find((l) => l.id === id);
  if (!label) return null;
  if (label.system || label.id === ATTENDANCE_ID) {
    return 'System labels cannot be deleted.';
  }
  if (labels.some((l) => l.parentLabelId === id)) {
    return 'Remove subcategories first.';
  }
  if (metrics.some((m) => metricInExactLabel(m, id))) {
    return 'Reassign or remove metrics that use this label before deleting it.';
  }
  return null;
}
