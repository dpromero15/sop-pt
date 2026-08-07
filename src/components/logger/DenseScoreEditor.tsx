import React, { useMemo, useState } from 'react';
import type {
  AttendanceStatus,
  MetricDefinition,
  MetricEntry,
  Player,
} from '../../types';
import { StorageService } from '../../services/storage';
import {
  ATTENDANCE_METRIC_ID,
  attendanceStatusLabel,
  attendanceStatusToValue,
  attendanceValueToStatus,
  isScoreEligible,
} from '../../utils/sessionMetrics';

interface DenseScoreEditorProps {
  sessionId: string;
  players: Player[];
  metrics: MetricDefinition[];
  entries: MetricEntry[];
  attendanceMap: Record<string, AttendanceStatus>;
  includeAttendanceColumn?: boolean;
  onRefreshData: () => void;
}

function formatRaw(metric: MetricDefinition, value: number): string {
  switch (metric.type) {
    case 'time_seconds':
      return `${value.toFixed(2)}${metric.unit}`;
    case 'percentage':
      return `${value}%`;
    case 'rating_10':
      return `${value}/10`;
    case 'count':
      return `${value} ${metric.unit}`.trim();
    default:
      return String(value);
  }
}

function findEntry(
  entries: MetricEntry[],
  sessionId: string,
  playerId: string,
  metricId: string,
): MetricEntry | undefined {
  return entries.find(
    (e) =>
      e.sessionId === sessionId &&
      e.playerId === playerId &&
      e.metricId === metricId,
  );
}

function stepForMetric(metric: MetricDefinition): string {
  if (metric.type === 'time_seconds') return '0.01';
  if (metric.type === 'rating_10') return '0.5';
  return '1';
}

export const DenseScoreEditor: React.FC<DenseScoreEditorProps> = ({
  sessionId,
  players,
  metrics,
  entries,
  attendanceMap,
  includeAttendanceColumn = true,
  onRefreshData,
}) => {
  const scoreMetrics = useMemo(
    () => metrics.filter((m) => m.id !== ATTENDANCE_METRIC_ID && m.type !== 'attendance'),
    [metrics],
  );

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber),
    [players],
  );

  // Local draft text so clearing mid-edit does not thrash storage until blur/commit.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const cellKey = (playerId: string, metricId: string) => `${playerId}:${metricId}`;

  const displayValue = (playerId: string, metricId: string): string => {
    const key = cellKey(playerId, metricId);
    if (Object.prototype.hasOwnProperty.call(drafts, key)) {
      return drafts[key];
    }
    const entry = findEntry(entries, sessionId, playerId, metricId);
    return entry != null ? String(entry.value) : '';
  };

  const persistScore = (
    playerId: string,
    metric: MetricDefinition,
    rawText: string,
  ) => {
    const key = cellKey(playerId, metric.id);
    const trimmed = rawText.trim();
    const existing = findEntry(entries, sessionId, playerId, metric.id);

    if (trimmed === '') {
      if (existing) {
        StorageService.deleteEntry(existing.id);
        onRefreshData();
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    const n = parseFloat(trimmed);
    if (Number.isNaN(n)) return;

    let value = n;
    if (metric.type === 'percentage') {
      value = Math.min(100, Math.max(0, n));
    } else if (metric.type === 'rating_10') {
      value = Math.min(10, Math.max(0, n));
    } else if (metric.type === 'count') {
      value = Math.max(0, n);
    } else if (metric.minExpectedValue != null || metric.maxExpectedValue != null) {
      const min = metric.minExpectedValue ?? Number.NEGATIVE_INFINITY;
      const max = metric.maxExpectedValue ?? Number.POSITIVE_INFINITY;
      value = Math.min(max, Math.max(min, n));
    }

    StorageService.addOrUpdateEntry({
      sessionId,
      playerId,
      metricId: metric.id,
      value,
      rawValue: formatRaw(metric, value),
    });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    onRefreshData();
  };

  const persistAttendance = (playerId: string, status: AttendanceStatus) => {
    StorageService.addOrUpdateEntry({
      sessionId,
      playerId,
      metricId: ATTENDANCE_METRIC_ID,
      value: attendanceStatusToValue(status),
      rawValue: attendanceStatusLabel(status),
    });
    onRefreshData();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
      <div className="border-b border-slate-800 px-4 py-3">
        <p className="text-sm font-semibold text-slate-100">Dense score editor</p>
        <p className="text-xs text-slate-500">
          Edit cells directly. Blank clears a score. Absent / excused players are
          view-only for metrics.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-950/95 px-3 py-2 font-semibold">
                Player
              </th>
              {includeAttendanceColumn && (
                <th className="px-2 py-2 font-semibold whitespace-nowrap">Attendance</th>
              )}
              {scoreMetrics.map((m) => (
                <th key={m.id} className="px-2 py-2 font-semibold whitespace-nowrap">
                  {m.name}
                  <span className="ml-1 font-normal text-slate-600">{m.unit}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player) => {
              const status =
                attendanceMap[player.id] ??
                (() => {
                  const att = findEntry(
                    entries,
                    sessionId,
                    player.id,
                    ATTENDANCE_METRIC_ID,
                  );
                  return att
                    ? attendanceValueToStatus(att.value)
                    : ('present' as AttendanceStatus);
                })();
              const eligible = isScoreEligible(status);

              return (
                <tr
                  key={player.id}
                  className={`border-b border-slate-800/80 ${
                    eligible ? 'hover:bg-slate-950/40' : 'opacity-55'
                  }`}
                >
                  <td className="sticky left-0 z-10 bg-slate-900/95 px-3 py-1.5 whitespace-nowrap">
                    <span className="mr-2 text-xs tabular-nums text-slate-500">
                      #{player.jerseyNumber}
                    </span>
                    <span
                      className={`font-medium ${
                        eligible ? 'text-slate-100' : 'text-slate-500'
                      }`}
                    >
                      {player.name}
                    </span>
                  </td>

                  {includeAttendanceColumn && (
                    <td className="px-2 py-1.5">
                      <select
                        value={status}
                        onChange={(e) =>
                          persistAttendance(
                            player.id,
                            e.target.value as AttendanceStatus,
                          )
                        }
                        className="w-full min-w-[6.5rem] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                      >
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="absent">Absent</option>
                        <option value="excused">Excused</option>
                      </select>
                    </td>
                  )}

                  {scoreMetrics.map((metric) => {
                    const key = cellKey(player.id, metric.id);
                    const editable = eligible;

                    return (
                      <td key={metric.id} className="px-2 py-1.5">
                        <input
                          type="number"
                          inputMode="decimal"
                          step={stepForMetric(metric)}
                          disabled={!editable}
                          value={displayValue(player.id, metric.id)}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            if (!editable) return;
                            persistScore(player.id, metric, e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder={editable ? '—' : ''}
                          className={`w-full min-w-[4.5rem] rounded-lg border px-2 py-1.5 text-center tabular-nums ${
                            editable
                              ? 'border-slate-700 bg-slate-950 text-slate-100'
                              : 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600'
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {scoreMetrics.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-amber-300">
          No scoring metrics on this session. Add some in Plan.
        </p>
      )}
    </div>
  );
};
