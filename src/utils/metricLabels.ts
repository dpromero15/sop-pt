import type { MetricDefinition } from '../types';
import {
  resolveTreeMembership,
  type LabelTreePick,
} from './labelTree';

/** Legacy single-label shape still present in older blobs / tests. */
export type MetricLabelInput = Partial<
  Pick<MetricDefinition, 'labelIds' | 'primaryLabelId'>
> & {
  labelId?: string;
  type?: MetricDefinition['type'];
  id?: string;
};

/**
 * Normalize category membership: non-empty `labelIds` + `primaryLabelId` ∈ ids.
 * Accepts legacy `labelId` and coerces Attendance to attendance-only.
 */
export function normalizeMetricLabels<T extends MetricLabelInput>(
  metric: T,
  labels?: LabelTreePick[],
): T & Pick<MetricDefinition, 'labelIds' | 'primaryLabelId'> {
  const isAttendance =
    metric.type === 'attendance' || metric.id === 'm_attendance';

  if (isAttendance) {
    return {
      ...metric,
      labelIds: ['attendance'],
      primaryLabelId: 'attendance',
    };
  }

  const fromLegacy =
    typeof metric.labelId === 'string' && metric.labelId.trim()
      ? [metric.labelId.trim()]
      : [];
  const rawIds = Array.isArray(metric.labelIds)
    ? metric.labelIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  let labelIds = Array.from(new Set(rawIds.length > 0 ? rawIds : fromLegacy));

  if (labels && labelIds.length > 0) {
    labelIds = resolveTreeMembership(labelIds, labels).labelIds;
  }

  // Never invent a missing category id (e.g. 'speed') — fall back to Attendance.
  const fallback = labelIds[0] || 'attendance';
  if (labelIds.length === 0) {
    labelIds.push(fallback);
  }

  let primaryLabelId =
    typeof metric.primaryLabelId === 'string' && metric.primaryLabelId.trim()
      ? metric.primaryLabelId.trim()
      : fallback;
  if (!labelIds.includes(primaryLabelId)) {
    primaryLabelId = labelIds[0];
  }

  return {
    ...metric,
    labelIds,
    primaryLabelId,
  };
}

/** True when the metric should appear under this category (membership). */
export function metricInCategory(
  metric: Pick<MetricDefinition, 'labelIds' | 'primaryLabelId'> & {
    labelId?: string;
  },
  labelId: string,
): boolean {
  const { labelIds } = normalizeMetricLabels(metric);
  return labelIds.includes(labelId);
}

/** True when the metric contributes to this category's formula standing. */
export function metricScoresInCategory(
  metric: Pick<MetricDefinition, 'labelIds' | 'primaryLabelId'> & {
    labelId?: string;
  },
  labelId: string,
): boolean {
  const { primaryLabelId } = normalizeMetricLabels(metric);
  return primaryLabelId === labelId;
}

/** Primary category id (formula / metric detail lookup). */
export function metricPrimaryLabelId(
  metric: Pick<MetricDefinition, 'labelIds' | 'primaryLabelId'> & {
    labelId?: string;
  },
): string {
  return normalizeMetricLabels(metric).primaryLabelId;
}

/** Build membership payload for create/update forms. */
export function metricLabelPayload(
  labelIds: string[],
  primaryLabelId: string,
  options?: { attendance?: boolean; labels?: LabelTreePick[] },
): Pick<MetricDefinition, 'labelIds' | 'primaryLabelId'> {
  if (options?.attendance) {
    return { labelIds: ['attendance'], primaryLabelId: 'attendance' };
  }
  const ids = options?.labels
    ? resolveTreeMembership(labelIds, options.labels).labelIds
    : Array.from(new Set(labelIds.map((id) => id.trim()).filter(Boolean)));
  const primary =
    primaryLabelId.trim() && ids.includes(primaryLabelId.trim())
      ? primaryLabelId.trim()
      : ids[0] || 'attendance';
  const nextIds = ids.length > 0 ? ids : [primary];
  if (!nextIds.includes(primary)) nextIds.unshift(primary);
  return { labelIds: nextIds, primaryLabelId: primary };
}
