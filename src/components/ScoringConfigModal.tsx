import React, { useState } from 'react';
import { X, Sliders, Lock } from 'lucide-react';
import { LabelDefinition, ScoringFormulaConfig } from '../types';
import { StorageService } from '../services/storage';
import { flushNow } from '../services/storage/cloudSync';
import {
  DEFAULT_ATTENDANCE_WEIGHT_PERCENT,
  visibleRankingLabels,
} from '../utils/formulaWeights';

interface ScoringConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  labels: LabelDefinition[];
  formula: ScoringFormulaConfig;
  onRefreshData: () => void;
}

export const ScoringConfigModal: React.FC<ScoringConfigModalProps> = ({
  isOpen,
  onClose,
  labels,
  formula,
  onRefreshData
}) => {
  if (!isOpen) return null;

  const isAttendance = (labelId: string) => labelId === 'attendance';

  const weightLabels = visibleRankingLabels(labels);

  const [weightsMap, setWeightsMap] = useState<Record<string, { weightPercent: number; enabled: boolean }>>(() => {
    const map: Record<string, { weightPercent: number; enabled: boolean }> = {};
    formula.weights.forEach(w => {
      map[w.labelId] = {
        weightPercent: w.weightPercent,
        enabled: isAttendance(w.labelId) ? true : w.enabled,
      };
    });
    weightLabels.forEach(l => {
      if (!map[l.id]) {
        map[l.id] = {
          weightPercent: isAttendance(l.id) ? DEFAULT_ATTENDANCE_WEIGHT_PERCENT : 10,
          enabled: true,
        };
      }
    });
    if (!map.attendance) {
      map.attendance = {
        weightPercent: DEFAULT_ATTENDANCE_WEIGHT_PERCENT,
        enabled: true,
      };
    }
    return map;
  });

  const handleWeightChange = (labelId: string, val: number) => {
    setWeightsMap(prev => ({
      ...prev,
      [labelId]: { ...prev[labelId], weightPercent: val }
    }));
  };

  const handleToggleEnabled = (labelId: string) => {
    if (isAttendance(labelId)) return;
    setWeightsMap(prev => ({
      ...prev,
      [labelId]: { ...prev[labelId], enabled: !prev[labelId]?.enabled }
    }));
  };

  const handleSave = () => {
    const allowed = new Set(weightLabels.map((l) => l.id));
    const updatedWeights = Object.entries(weightsMap)
      .filter(([labelId]) => allowed.has(labelId))
      .map(([labelId, item]: [string, { weightPercent: number; enabled: boolean }]) => ({
      labelId,
      weightPercent: item.weightPercent,
      enabled: isAttendance(labelId) ? true : item.enabled,
    }));

    StorageService.saveFormula({
      ...formula,
      weights: updatedWeights
    });
    void flushNow();
    onRefreshData();
    onClose();
  };

  const activeSum = Object.values(weightsMap).reduce((acc: number, curr: { weightPercent: number; enabled: boolean }) => acc + (curr.enabled ? curr.weightPercent : 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold">Total Score Formula Config</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Adjust category weightings to change how Total Player Scores are calculated across the team. Attendance stays on as a system default.
        </p>

        <div className="space-y-3">
          {weightLabels.map(lbl => {
            const item = weightsMap[lbl.id] || {
              weightPercent: isAttendance(lbl.id) ? DEFAULT_ATTENDANCE_WEIGHT_PERCENT : 10,
              enabled: true,
            };
            const locked = isAttendance(lbl.id);
            return (
              <div
                key={lbl.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => handleToggleEnabled(lbl.id)}
                      disabled={locked}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <span className="font-bold text-white">{lbl.name}</span>
                    {locked && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">
                        <Lock className="w-2.5 h-2.5" />
                        Always on
                      </span>
                    )}
                  </div>

                  <span className="font-extrabold text-emerald-400">
                    {item.enabled ? `${item.weightPercent}%` : 'Disabled'}
                  </span>
                </div>

                {item.enabled && (
                  <input
                    type="range"
                    min={locked ? 5 : 0}
                    max={50}
                    step={5}
                    value={item.weightPercent}
                    onChange={(e) => handleWeightChange(lbl.id, parseInt(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs">
          <span className="text-slate-400">
            Total Weight: <strong className="text-emerald-400 font-bold">{activeSum}%</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20"
            >
              Save & sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
