import { describe, expect, it } from 'vitest';
import {
  assignMetricPrimary,
  metricInCategory,
  metricLabelPayload,
  metricPrimaryLabelId,
  metricScoresInCategory,
  normalizeMetricLabels,
} from './metricLabels';

describe('normalizeMetricLabels', () => {
  it('maps legacy labelId to labelIds + primary', () => {
    const next = normalizeMetricLabels({
      id: 'm_40m',
      labelId: 'speed',
      type: 'time_seconds',
    });
    expect(next.labelIds).toEqual(['speed']);
    expect(next.primaryLabelId).toBe('speed');
  });

  it('strips parent when the same tree already has a subcategory', () => {
    const next = normalizeMetricLabels(
      {
        labelIds: ['speed', 'acceleration', 'fitness'],
        primaryLabelId: 'speed',
        type: 'time_seconds',
      },
      [
        { id: 'speed' },
        { id: 'acceleration', parentLabelId: 'speed' },
        { id: 'fitness' },
      ],
    );
    expect(next.labelIds).toEqual(['acceleration', 'fitness']);
    expect(next.primaryLabelId).toBe('acceleration');
  });

  it('keeps multi membership and clamps primary', () => {
    const next = normalizeMetricLabels({
      labelIds: ['speed', 'fitness'],
      primaryLabelId: 'offense',
      type: 'count',
    });
    expect(next.labelIds).toEqual(['speed', 'fitness']);
    expect(next.primaryLabelId).toBe('speed');
  });

  it('locks attendance to attendance-only', () => {
    const next = normalizeMetricLabels({
      id: 'm_attendance',
      type: 'attendance',
      labelIds: ['speed', 'attendance'],
      primaryLabelId: 'speed',
    });
    expect(next.labelIds).toEqual(['attendance']);
    expect(next.primaryLabelId).toBe('attendance');
  });

  it('drops leftover Attendance when a non-attendance metric has another category', () => {
    const next = normalizeMetricLabels({
      type: 'count',
      labelIds: ['attendance', 'character'],
      primaryLabelId: 'character',
    });
    expect(next.labelIds).toEqual(['character']);
    expect(next.primaryLabelId).toBe('character');
  });

  it('moves primary off Attendance onto the remaining category', () => {
    const next = normalizeMetricLabels({
      type: 'rating_10',
      labelIds: ['attendance', 'character'],
      primaryLabelId: 'attendance',
    });
    expect(next.labelIds).toEqual(['character']);
    expect(next.primaryLabelId).toBe('character');
  });
});

describe('membership helpers', () => {
  const metric = {
    labelIds: ['speed', 'fitness'],
    primaryLabelId: 'speed',
  };

  it('metricInCategory uses membership', () => {
    expect(metricInCategory(metric, 'speed')).toBe(true);
    expect(metricInCategory(metric, 'fitness')).toBe(true);
    expect(metricInCategory(metric, 'offense')).toBe(false);
  });

  it('metricScoresInCategory uses primary only', () => {
    expect(metricScoresInCategory(metric, 'speed')).toBe(true);
    expect(metricScoresInCategory(metric, 'fitness')).toBe(false);
  });

  it('metricPrimaryLabelId returns primary', () => {
    expect(metricPrimaryLabelId(metric)).toBe('speed');
  });
});

describe('metricLabelPayload', () => {
  it('builds membership with primary', () => {
    expect(metricLabelPayload(['fitness', 'speed'], 'speed')).toEqual({
      labelIds: ['fitness', 'speed'],
      primaryLabelId: 'speed',
    });
  });

  it('forces attendance lock', () => {
    expect(
      metricLabelPayload(['speed'], 'speed', { attendance: true }),
    ).toEqual({
      labelIds: ['attendance'],
      primaryLabelId: 'attendance',
    });
  });

  it('falls back to attendance when membership is empty', () => {
    expect(normalizeMetricLabels({ type: 'count' })).toMatchObject({
      labelIds: ['attendance'],
      primaryLabelId: 'attendance',
    });
    expect(metricLabelPayload([], '')).toEqual({
      labelIds: ['attendance'],
      primaryLabelId: 'attendance',
    });
  });

  it('strips Attendance from payload when another category is present', () => {
    expect(
      metricLabelPayload(['attendance', 'character'], 'character'),
    ).toEqual({
      labelIds: ['character'],
      primaryLabelId: 'character',
    });
  });
});

describe('assignMetricPrimary', () => {
  it('moves off the old primary and keeps other extras', () => {
    expect(
      assignMetricPrimary(['attendance', 'character'], 'attendance', 'character'),
    ).toEqual({
      labelIds: ['character'],
      primaryLabelId: 'character',
    });
    expect(
      assignMetricPrimary(['speed', 'fitness'], 'speed', 'character'),
    ).toEqual({
      labelIds: ['fitness', 'character'],
      primaryLabelId: 'character',
    });
  });

  it('adds the new primary when it was not already a member', () => {
    expect(assignMetricPrimary(['attendance'], 'attendance', 'character')).toEqual(
      {
        labelIds: ['character'],
        primaryLabelId: 'character',
      },
    );
  });
});
