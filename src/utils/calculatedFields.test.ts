import { describe, expect, it } from 'vitest';
import {
  calculatedFieldsForCategory,
  computeCalculatedFieldValue,
  computeAllCalculatedValues,
} from './calculatedFields';
import type {
  CalculatedFieldDefinition,
  MetricDefinition,
  MetricEntry,
  Player,
} from '../types';

const dash: MetricDefinition = {
  id: 'm_40m_dash',
  name: '40 Meter Dash',
  labelId: 'speed',
  type: 'time_seconds',
  unit: 's',
  higherIsBetter: false,
  aggregationMode: 'best',
};

const goals: MetricDefinition = {
  id: 'm_goals',
  name: 'Goals',
  labelId: 'offense',
  type: 'count',
  unit: 'goals',
  higherIsBetter: true,
  aggregationMode: 'sum',
};

const avgField: CalculatedFieldDefinition = {
  id: 'cf_40m_avg',
  name: '40m Average',
  kind: 'average',
  baseMetricId: 'm_40m_dash',
  enabled: true,
  higherIsBetter: false,
  unit: 's',
};

const disabledAvg: CalculatedFieldDefinition = {
  ...avgField,
  enabled: false,
};

const perMatch: CalculatedFieldDefinition = {
  id: 'cf_goals_per_match',
  name: 'Goals per Match',
  kind: 'per_session',
  baseMetricId: 'm_goals',
  enabled: true,
  higherIsBetter: true,
  unit: 'goals/match',
};

describe('computeCalculatedFieldValue', () => {
  it('returns null when disabled', () => {
    expect(
      computeCalculatedFieldValue(
        disabledAvg,
        [
          {
            id: 'e1',
            sessionId: 's1',
            playerId: 'p1',
            metricId: 'm_40m_dash',
            value: 5,
            timestamp: '2026-01-01T00:00:00Z',
          },
        ],
        dash,
      ),
    ).toBeNull();
  });

  it('computes average when enabled', () => {
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_40m_dash',
        value: 5,
        timestamp: '2026-01-01T00:00:00Z',
      },
      {
        id: 'e2',
        sessionId: 's2',
        playerId: 'p1',
        metricId: 'm_40m_dash',
        value: 6,
        timestamp: '2026-01-08T00:00:00Z',
      },
    ];
    expect(computeCalculatedFieldValue(avgField, entries, dash)).toBe(5.5);
  });

  it('computes per-session rate', () => {
    const entries: MetricEntry[] = [
      {
        id: 'e1',
        sessionId: 's1',
        playerId: 'p1',
        metricId: 'm_goals',
        value: 2,
        timestamp: '2026-01-01T00:00:00Z',
      },
      {
        id: 'e2',
        sessionId: 's2',
        playerId: 'p1',
        metricId: 'm_goals',
        value: 1,
        timestamp: '2026-01-08T00:00:00Z',
      },
    ];
    expect(computeCalculatedFieldValue(perMatch, entries, goals)).toBe(1.5);
  });
});

describe('computeAllCalculatedValues', () => {
  it('skips disabled fields entirely', () => {
    const players: Player[] = [
      {
        id: 'p1',
        name: 'A',
        jerseyNumber: 1,
        position: 'ST',
        preferredFoot: 'Right',
        joinedDate: '2026-01-01',
        status: 'active',
      },
    ];
    const map = computeAllCalculatedValues(
      players,
      [],
      [dash],
      [disabledAvg],
    );
    expect(map.get('p1')).toEqual({});
  });
});

describe('calculatedFieldsForCategory', () => {
  it('scopes by base metric label', () => {
    const fields = [avgField, perMatch];
    expect(
      calculatedFieldsForCategory(fields, [dash, goals], 'speed').map(
        (f) => f.id,
      ),
    ).toEqual(['cf_40m_avg']);
  });
});
