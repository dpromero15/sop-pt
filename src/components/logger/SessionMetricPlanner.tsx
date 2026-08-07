import React from 'react';
import { Lock, Plus, X } from 'lucide-react';
import type { MetricDefinition, SessionType } from '../../types';
import {
  ATTENDANCE_METRIC_ID,
  MATCH_DEFAULT_METRIC_IDS,
  ensureAttendanceFirst,
} from '../../utils/sessionMetrics';

interface SessionMetricPlannerProps {
  metrics: MetricDefinition[];
  metricIds: string[];
  sessionType: SessionType;
  onChange: (metricIds: string[]) => void;
}

export const SessionMetricPlanner: React.FC<SessionMetricPlannerProps> = ({
  metrics,
  metricIds,
  sessionType,
  onChange,
}) => {
  const ordered = ensureAttendanceFirst(metricIds);
  const selected = new Set(ordered);
  const available = metrics.filter(
    (m) => m.type !== 'attendance' && !selected.has(m.id),
  );

  const removeMetric = (id: string) => {
    if (id === ATTENDANCE_METRIC_ID) return;
    onChange(ensureAttendanceFirst(ordered.filter((m) => m !== id)));
  };

  const addMetric = (id: string) => {
    onChange(ensureAttendanceFirst([...ordered, id]));
  };

  const applyMatchPack = () => {
    onChange(ensureAttendanceFirst([...MATCH_DEFAULT_METRIC_IDS]));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Session metrics
        </p>
        {sessionType === 'match' && (
          <button
            type="button"
            onClick={applyMatchPack}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            Apply game pack
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {ordered.map((id) => {
          const metric = metrics.find((m) => m.id === id);
          const isAttendance = id === ATTENDANCE_METRIC_ID;
          return (
            <span
              key={id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                isAttendance
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-200'
              }`}
            >
              {isAttendance && <Lock className="h-3 w-3" />}
              {metric?.name ?? id}
              {!isAttendance && (
                <button
                  type="button"
                  onClick={() => removeMetric(id)}
                  className="rounded-full p-0.5 hover:bg-slate-700"
                  aria-label={`Remove ${metric?.name ?? id}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          );
        })}
      </div>

      {available.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Add metric</p>
          <div className="flex flex-wrap gap-2">
            {available.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => addMetric(m.id)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300"
              >
                <Plus className="h-3.5 w-3.5" />
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
