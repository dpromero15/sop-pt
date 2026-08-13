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

export type LabelTreePick = Pick<
  LabelDefinition,
  'id' | 'parentLabelId' | 'parentLabelIds' | 'primaryParentLabelId' | 'system'
>;

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

/** Parent ids for a label (supports legacy `parentLabelId`). */
export function parentIdsOf(label: LabelTreePick): string[] {
  const fromArray = Array.isArray(label.parentLabelIds)
    ? uniqueIds(label.parentLabelIds)
    : [];
  if (fromArray.length > 0) return fromArray;
  const legacy = label.parentLabelId?.trim();
  return legacy ? [legacy] : [];
}

/** Primary parent for formula standing (first parent if unset). */
export function primaryParentIdOf(label: LabelTreePick): string | undefined {
  const ids = parentIdsOf(label);
  if (ids.length === 0) return undefined;
  const primary = label.primaryParentLabelId?.trim();
  if (primary && ids.includes(primary)) return primary;
  const legacy = label.parentLabelId?.trim();
  if (legacy && ids.includes(legacy)) return legacy;
  return ids[0];
}

/** True when the label is a top-level category (no parent). */
export function isRootLabel(label: LabelTreePick): boolean {
  return parentIdsOf(label).length === 0;
}

/** True when the label is a subcategory. */
export function isSubcategory(label: LabelTreePick): boolean {
  return parentIdsOf(label).length > 0;
}

/** Direct children of a parent (depth 1 only; includes shared children). */
export function childrenOf(labels: LabelDefinition[], parentId: string): LabelDefinition[] {
  return labels.filter((l) => parentIdsOf(l).includes(parentId));
}

/** Parent id plus every direct child id. */
export function treeIds(labels: LabelTreePick[], parentId: string): string[] {
  return [
    parentId,
    ...labels.filter((l) => parentIdsOf(l).includes(parentId)).map((l) => l.id),
  ];
}

/** Every tree a label participates in (shared children union all parents). */
export function membershipTreeIds(labels: LabelTreePick[], id: string): string[] {
  const label = labels.find((l) => l.id === id);
  if (!label) return [id];
  const roots = parentIdsOf(label);
  if (roots.length === 0) return treeIds(labels, id);
  const ids = new Set<string>();
  for (const root of roots) {
    for (const tid of treeIds(labels, root)) ids.add(tid);
  }
  return Array.from(ids);
}

/** Root categories, Attendance first. */
export function rootLabels(labels: LabelDefinition[]): LabelDefinition[] {
  const roots = labels.filter((l) => isRootLabel(l));
  const withoutAtt = roots.filter((l) => l.id !== ATTENDANCE_ID);
  const attendance = roots.find((l) => l.id === ATTENDANCE_ID);
  return attendance ? [attendance, ...withoutAtt] : withoutAtt;
}

/** Display path: `Speed`, `Speed / Acceleration`, or `Endurance · Offense, Defense`. */
export function labelPathName(
  labels: Pick<
    LabelDefinition,
    'id' | 'name' | 'parentLabelId' | 'parentLabelIds' | 'primaryParentLabelId'
  >[],
  labelId: string,
): string {
  const label = labels.find((l) => l.id === labelId);
  if (!label) return labelId;
  const parentIds = parentIdsOf(label);
  if (parentIds.length === 0) return label.name;
  const names = parentIds.map(
    (id) => labels.find((l) => l.id === id)?.name || id,
  );
  const primaryId = primaryParentIdOf(label);
  const primaryName = primaryId
    ? labels.find((l) => l.id === primaryId)?.name || primaryId
    : names[0];
  if (parentIds.length === 1) {
    return `${primaryName} / ${label.name}`;
  }
  const rest = names.filter((n) => n !== primaryName);
  return `${label.name} · ${[primaryName, ...rest].join(', ')}`;
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

function dropParentFields<T extends LabelTreePick>(label: T): T {
  const {
    parentLabelId: _a,
    parentLabelIds: _b,
    primaryParentLabelId: _c,
    ...rest
  } = label;
  return rest as T;
}

function sameIdList(a: string[] | undefined, b: string[]): boolean {
  const left = a ?? [];
  return left.length === b.length && left.every((id, i) => id === b[i]);
}

/**
 * Drop invalid parents (missing, self, attendance, grandchild).
 * Writes `parentLabelIds` + `primaryParentLabelId` and mirrors `parentLabelId`.
 * Does not invent new labels.
 */
export function normalizeLabelForest<T extends LabelTreePick>(
  labels: T[],
): { labels: T[]; changed: boolean } {
  const byId = new Map(labels.map((l) => [l.id, l]));
  let changed = false;
  const next = labels.map((label) => {
    if (label.id === ATTENDANCE_ID) {
      if (parentIdsOf(label).length > 0 || label.parentLabelId || label.primaryParentLabelId) {
        changed = true;
        return dropParentFields(label);
      }
      return label;
    }

    const valid: string[] = [];
    const seen = new Set<string>();
    for (const parentId of parentIdsOf(label)) {
      if (seen.has(parentId)) continue;
      seen.add(parentId);
      if (parentId === label.id || parentId === ATTENDANCE_ID) continue;
      const parent = byId.get(parentId);
      if (!parent || parent.id === ATTENDANCE_ID) continue;
      if (parentIdsOf(parent).length > 0) continue;
      valid.push(parentId);
    }

    if (valid.length === 0) {
      if (
        label.parentLabelId ||
        (label.parentLabelIds && label.parentLabelIds.length > 0) ||
        label.primaryParentLabelId
      ) {
        changed = true;
        return dropParentFields(label);
      }
      return label;
    }

    const requestedPrimary = label.primaryParentLabelId?.trim();
    const requestedLegacy = label.parentLabelId?.trim();
    const primary =
      (requestedPrimary && valid.includes(requestedPrimary)
        ? requestedPrimary
        : undefined) ||
      (requestedLegacy && valid.includes(requestedLegacy)
        ? requestedLegacy
        : undefined) ||
      valid[0];

    if (
      sameIdList(label.parentLabelIds, valid) &&
      label.primaryParentLabelId === primary &&
      label.parentLabelId === primary
    ) {
      return label;
    }

    changed = true;
    return {
      ...label,
      parentLabelIds: valid,
      primaryParentLabelId: primary,
      parentLabelId: primary,
    };
  });

  return { labels: next, changed };
}

/**
 * Check or uncheck a label in the metric category picker.
 * Checking an id replaces parent/sibling membership in the same tree.
 */
export function toggleTreeMembership(
  selectedIds: string[],
  id: string,
  checked: boolean,
  labels: LabelTreePick[],
): string[] {
  let next = selectedIds.filter((x) => x !== id);
  if (checked) {
    const trees = membershipTreeIds(labels, id);
    next = next.filter((x) => !trees.includes(x));
    next.push(id);
  }
  return resolveTreeMembership(next, labels).labelIds;
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

  const rootsOf = (id: string): string[] => {
    const label = byId.get(id);
    if (!label) return [id];
    const parents = parentIdsOf(label);
    return parents.length > 0 ? parents : [id];
  };

  const specificity = (id: string): number => {
    const label = byId.get(id);
    return label && parentIdsOf(label).length > 0 ? 1 : 0;
  };

  const byRoot = new Map<string, string[]>();
  for (const id of unique) {
    for (const root of rootsOf(id)) {
      const list = byRoot.get(root) ?? [];
      list.push(id);
      byRoot.set(root, list);
    }
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
  if (!label || isSubcategory(label)) {
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
  if (!label || isSubcategory(label)) return false;
  return labels.some(
    (l) => l.id === primaryLabelId && primaryParentIdOf(l) === labelId,
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
  const exclusiveKids = labels.filter((l) => {
    const parents = parentIdsOf(l);
    return parents.length === 1 && parents[0] === id;
  });
  if (exclusiveKids.length > 0) {
    return 'Remove subcategories first.';
  }
  if (metrics.some((m) => metricInExactLabel(m, id))) {
    return 'Reassign or remove metrics that use this label before deleting it.';
  }
  return null;
}
