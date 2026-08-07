import React, { useState } from 'react';
import { X, Sliders, Check, RotateCcw } from 'lucide-react';
import { LabelDefinition, ScoringFormulaConfig } from '../types';
import { StorageService } from '../services/storage';

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

  const [weightsMap, setWeightsMap] = useState<Record<string, { weightPercent: number; enabled: boolean }>>(() => {
    const map: Record<string, { weightPercent: number; enabled: boolean }> = {};
    formula.weights.forEach(w => {
      map[w.labelId] = { weightPercent: w.weightPercent, enabled: w.enabled };
    });
    labels.forEach(l => {
      if (!map[l.id]) {
        map[l.id] = { weightPercent: 10, enabled: true };
      }
    });
    return map;
  });

  const handleWeightChange = (labelId: string, val: number) => {
    setWeightsMap(prev => ({
      ...prev,
      [labelId]: { ...prev[labelId], weightPercent: val }
    }));
  };

  const handleToggleEnabled = (labelId: string) => {
    setWeightsMap(prev => ({
      ...prev,
      [labelId]: { ...prev[labelId], enabled: !prev[labelId]?.enabled }
    }));
  };

  const handleSave = () => {
    const updatedWeights = Object.entries(weightsMap).map(([labelId, item]: [string, { weightPercent: number; enabled: boolean }]) => ({
      labelId,
      weightPercent: item.weightPercent,
      enabled: item.enabled
    }));

    StorageService.saveFormula({
      ...formula,
      weights: updatedWeights
    });

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
          Adjust category weightings to change how Total Player Scores are calculated across the team.
        </p>

        <div className="space-y-3">
          {labels.map(lbl => {
            const item = weightsMap[lbl.id] || { weightPercent: 10, enabled: true };
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
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                    />
                    <span className="font-bold text-white">{lbl.name}</span>
                  </div>

                  <span className="font-extrabold text-emerald-400">
                    {item.enabled ? `${item.weightPercent}%` : 'Disabled'}
                  </span>
                </div>

                {item.enabled && (
                  <input
                    type="range"
                    min={0}
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
              Apply Formula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
