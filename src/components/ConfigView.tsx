import React, { useState } from 'react';
import { 
  Sliders, 
  Tag, 
  Check, 
  RotateCcw, 
  Download, 
  Upload, 
  Sparkles, 
  Layers,
  Pencil,
  Calculator,
  Award,
} from 'lucide-react';
import { 
  LabelDefinition, 
  MetricDefinition, 
  ScoringFormulaConfig, 
  MetricType,
  MetricAggregationMode,
  CalculatedFieldDefinition,
} from '../types';
import { StorageService } from '../services/storage';
import { TeamManagementView } from './TeamManagementView';
import { AdminToolsView } from './AdminToolsView';
import { defaultAggregationMode } from '../utils/metricAggregation';

interface ConfigViewProps {
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
  formula: ScoringFormulaConfig;
  calculatedFields: CalculatedFieldDefinition[];
  onRefreshData: () => void;
}

const AGGREGATION_OPTIONS: { value: MetricAggregationMode; label: string }[] = [
  { value: 'sum', label: 'Season total (add all entries)' },
  { value: 'best', label: 'All-time best (min or max by direction)' },
  { value: 'latest', label: 'Latest entry only' },
];

export const ConfigView: React.FC<ConfigViewProps> = ({
  labels,
  metrics,
  formula,
  calculatedFields,
  onRefreshData
}) => {
  const [weightsMap, setWeightsMap] = useState<Record<string, { weightPercent: number; enabled: boolean }>>(() => {
    const map: Record<string, { weightPercent: number; enabled: boolean }> = {};
    formula.weights.forEach(w => {
      map[w.labelId] = { weightPercent: w.weightPercent, enabled: w.enabled };
    });
    // Ensure all labels exist in map
    labels.forEach(l => {
      if (!map[l.id]) {
        map[l.id] = { weightPercent: 10, enabled: true };
      }
    });
    return map;
  });

  // Modal / Form state for Adding Custom Label
  const [isAddLabelOpen, setIsAddLabelOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelDesc, setNewLabelDesc] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('emerald');

  // Modal / Form state for Adding / Editing Metric Definition
  const [isMetricModalOpen, setIsMetricModalOpen] = useState(false);
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);
  const [metricName, setMetricName] = useState('');
  const [metricLabelId, setMetricLabelId] = useState(labels[0]?.id || 'speed');
  const [metricType, setMetricType] = useState<MetricType>('count');
  const [metricUnit, setMetricUnit] = useState('reps');
  const [metricHigherIsBetter, setMetricHigherIsBetter] = useState(true);
  const [metricAggregation, setMetricAggregation] =
    useState<MetricAggregationMode>('latest');
  const [metricMin, setMetricMin] = useState('');
  const [metricMax, setMetricMax] = useState('');
  const [metricDesc, setMetricDesc] = useState('');

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const resetMetricForm = () => {
    setEditingMetricId(null);
    setMetricName('');
    setMetricLabelId(labels[0]?.id || 'speed');
    setMetricType('count');
    setMetricUnit('reps');
    setMetricHigherIsBetter(true);
    setMetricAggregation('best');
    setMetricMin('');
    setMetricMax('');
    setMetricDesc('');
  };

  const openAddMetric = () => {
    resetMetricForm();
    setIsMetricModalOpen(true);
  };

  const openEditMetric = (m: MetricDefinition) => {
    setEditingMetricId(m.id);
    setMetricName(m.name);
    setMetricLabelId(m.labelId);
    setMetricType(m.type);
    setMetricUnit(m.unit);
    setMetricHigherIsBetter(m.higherIsBetter);
    setMetricAggregation(
      m.aggregationMode ?? defaultAggregationMode(m),
    );
    setMetricMin(
      m.minExpectedValue !== undefined ? String(m.minExpectedValue) : '',
    );
    setMetricMax(
      m.maxExpectedValue !== undefined ? String(m.maxExpectedValue) : '',
    );
    setMetricDesc(m.description || '');
    setIsMetricModalOpen(true);
  };

  // Handle weight change
  const handleWeightChange = (labelId: string, val: number) => {
    setWeightsMap(prev => ({
      ...prev,
      [labelId]: { ...prev[labelId], weightPercent: val }
    }));
  };

  const handleToggleLabelEnabled = (labelId: string) => {
    setWeightsMap(prev => ({
      ...prev,
      [labelId]: { ...prev[labelId], enabled: !prev[labelId]?.enabled }
    }));
  };

  // Save Formula Config
  const handleSaveFormula = () => {
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
    showToast('✓ Total score formula weights saved successfully!');
  };

  // Formula Presets
  const handleApplyPreset = (presetType: 'balanced' | 'offense' | 'fitness') => {
    const updated: Record<string, { weightPercent: number; enabled: boolean }> = {};
    labels.forEach(l => {
      updated[l.id] = { weightPercent: 0, enabled: false };
    });

    if (presetType === 'balanced') {
      updated['attendance'] = { weightPercent: 20, enabled: true };
      updated['speed'] = { weightPercent: 15, enabled: true };
      updated['technical'] = { weightPercent: 20, enabled: true };
      updated['offense'] = { weightPercent: 15, enabled: true };
      updated['defense'] = { weightPercent: 15, enabled: true };
      updated['character'] = { weightPercent: 15, enabled: true };
    } else if (presetType === 'offense') {
      updated['attendance'] = { weightPercent: 10, enabled: true };
      updated['speed'] = { weightPercent: 20, enabled: true };
      updated['technical'] = { weightPercent: 25, enabled: true };
      updated['offense'] = { weightPercent: 35, enabled: true };
      updated['character'] = { weightPercent: 10, enabled: true };
    } else if (presetType === 'fitness') {
      updated['attendance'] = { weightPercent: 25, enabled: true };
      updated['speed'] = { weightPercent: 25, enabled: true };
      updated['agility'] = { weightPercent: 25, enabled: true };
      updated['fitness'] = { weightPercent: 25, enabled: true };
    }

    setWeightsMap(updated);
  };

  // Add Label
  const handleAddLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;

    StorageService.addLabel({
      name: newLabelName,
      description: newLabelDesc || 'Custom category label',
      color: newLabelColor,
      badgeBg: `bg-${newLabelColor}-500/15 text-${newLabelColor}-300 border-${newLabelColor}-500/30`,
      badgeText: `text-${newLabelColor}-300`
    });

    setNewLabelName('');
    setNewLabelDesc('');
    setIsAddLabelOpen(false);
    onRefreshData();
    showToast('✓ New category label added!');
  };

  // Add / update Metric Definition
  const handleSaveMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!metricName.trim()) return;

    const payload: Omit<MetricDefinition, 'id'> = {
      name: metricName.trim(),
      labelId: metricLabelId,
      type: metricType,
      unit: metricUnit.trim() || 'units',
      higherIsBetter: metricHigherIsBetter,
      aggregationMode: metricAggregation,
      description: metricDesc.trim() || undefined,
      minExpectedValue: metricMin !== '' ? Number(metricMin) : undefined,
      maxExpectedValue: metricMax !== '' ? Number(metricMax) : undefined,
    };

    if (editingMetricId) {
      StorageService.updateMetric({ id: editingMetricId, ...payload });
      showToast('✓ Metric definition updated!');
    } else {
      StorageService.addMetric(payload);
      showToast('✓ New custom metric registered!');
    }

    resetMetricForm();
    setIsMetricModalOpen(false);
    onRefreshData();
  };

  const handleToggleCalculatedField = (field: CalculatedFieldDefinition) => {
    StorageService.updateCalculatedField({
      ...field,
      enabled: !field.enabled,
    });
    onRefreshData();
    showToast(
      field.enabled
        ? `✓ ${field.name} disabled`
        : `✓ ${field.name} enabled for rankings`,
    );
  };

  // Export / Reset
  const handleExportJSON = () => {
    const backupJson = StorageService.exportFullBackupJSON();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Thunder_FC_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const ok = StorageService.importFullBackupJSON(content);
        if (ok) {
          onRefreshData();
          showToast('✓ Data backup restored successfully!');
        } else {
          alert('Invalid backup JSON format.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (confirm('Reset team data to initial sample squad ("Thunder FC U-16")?')) {
      StorageService.resetToSampleData();
      onRefreshData();
      showToast('✓ Reset to sample squad complete!');
    }
  };

  // Calculate total weight sum
  const activeWeightSum = Object.values(weightsMap).reduce((sum: number, item: { weightPercent: number; enabled: boolean }) => {
    return sum + (item.enabled ? item.weightPercent : 0);
  }, 0);

  return (
    <div className="space-y-6 pb-28">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-16 right-4 z-50 bg-rose-500 text-white font-extrabold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-rose-300 animate-bounce">
          <Check className="w-5 h-5" />
          <span>{toastMsg}</span>
        </div>
      )}

      <TeamManagementView onRefreshData={onRefreshData} />
      <AdminToolsView onRefreshData={onRefreshData} />

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <Sliders className="w-4 h-4" />
              <span>Coaching Customization</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Scoring Formula & Label Configurator
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Configure exact category label weightings to calculate total player score (e.g. Attendance + Offense + Defense + Speed).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveFormula}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-rose-500/20 transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Save Weights Formula</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: SCORING WEIGHTS CONFIGURATOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-rose-400" />
              <span>Category Label Weightings</span>
            </h3>
            <p className="text-xs text-slate-400">
              Active Weight Sum: <strong className={activeWeightSum === 100 ? 'text-emerald-400' : 'text-amber-400'}>{activeWeightSum}%</strong>
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Presets:</span>
            <button
              onClick={() => handleApplyPreset('balanced')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              Balanced
            </button>
            <button
              onClick={() => handleApplyPreset('offense')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              Attacking Focus
            </button>
            <button
              onClick={() => handleApplyPreset('fitness')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              Fitness Combine
            </button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {labels.map(lbl => {
            const item = weightsMap[lbl.id] || { weightPercent: 10, enabled: true };
            return (
              <div
                key={lbl.id}
                className={`bg-slate-950 border rounded-2xl p-4 space-y-2 transition-all ${
                  item.enabled ? 'border-slate-800' : 'border-slate-900 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => handleToggleLabelEnabled(lbl.id)}
                      className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 bg-slate-900 border-slate-700"
                    />
                    <span className="font-bold text-sm text-white">{lbl.name}</span>
                  </div>

                  <span className="text-sm font-extrabold text-rose-400">
                    {item.enabled ? `${item.weightPercent}%` : 'Disabled'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-1">{lbl.description}</p>

                {item.enabled && (
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={5}
                    value={item.weightPercent}
                    onChange={(e) => handleWeightChange(lbl.id, parseInt(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: CATEGORY LABELS & METRIC DEFINITIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Labels Manager */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-400" />
              <span>Category Labels ({labels.length})</span>
            </h3>

            <button
              onClick={() => setIsAddLabelOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold text-xs transition-all active:scale-95"
            >
              + Add Label
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {labels.map(lbl => (
              <div
                key={lbl.id}
                className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-white">{lbl.name}</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">{lbl.description}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lbl.badgeBg}`}>
                  {lbl.color}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Metric Definitions Manager */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Measured Metrics ({metrics.length})</span>
            </h3>

            <button
              onClick={openAddMetric}
              className="px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 font-semibold text-xs transition-all active:scale-95"
            >
              + Add Metric
            </button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {metrics.map(m => {
              const labelDef = labels.find(l => l.id === m.labelId);
              const mode = m.aggregationMode ?? defaultAggregationMode(m);
              return (
                <div
                  key={m.id}
                  className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-white">{m.name}</span>
                    <span className="text-slate-400 text-[11px] ml-2">({m.unit})</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">
                      Label: <strong className="text-blue-300">{labelDef?.name || m.labelId}</strong>
                      {' · '}
                      {m.higherIsBetter ? 'Higher better' : 'Lower better'}
                      {' · '}
                      <span className="text-amber-300/90">{mode}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                      {m.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditMetric(m)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Edit metric"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2b: CALCULATED FIELDS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-400" />
            <span>Calculated Fields</span>
          </h3>
          <p className="text-slate-400 text-xs mt-1">
            Pre-built derived stats (average, per-match rate, percentile). Enable only what you need — disabled fields are not computed.
          </p>
        </div>

        <div className="space-y-2">
          {calculatedFields.map((field) => {
            const base = metrics.find((m) => m.id === field.baseMetricId);
            return (
              <div
                key={field.id}
                className={`bg-slate-950 border rounded-xl p-3 flex items-center justify-between gap-3 text-xs ${
                  field.enabled ? 'border-cyan-500/30' : 'border-slate-800/80'
                }`}
              >
                <div>
                  <span className="font-bold text-white">{field.name}</span>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    {field.kind} · base:{' '}
                    <strong className="text-cyan-300">
                      {base?.name || field.baseMetricId}
                    </strong>
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <span className="text-slate-400 text-[10px] font-semibold uppercase">
                    {field.enabled ? 'On' : 'Off'}
                  </span>
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    onChange={() => handleToggleCalculatedField(field)}
                    className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 bg-slate-900 border-slate-700"
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: BACKUP, EXPORT & RESET */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Download className="w-4 h-4 text-purple-400" />
          <span>iOS Lift-and-Shift Data Transfer & Backup</span>
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Export Full Team Backup JSON</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 cursor-pointer transition-all active:scale-95">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Restore Backup JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>

          <button
            onClick={handleResetData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 font-semibold text-xs border border-slate-700 transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Sample Team Data</span>
          </button>
        </div>
      </div>

      {/* MODAL: ADD LABEL */}
      {isAddLabelOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 text-white">
            <h3 className="text-lg font-bold">Add Custom Category Label</h3>
            <form onSubmit={handleAddLabel} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Label Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Leadership & Mindset"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Communication, energy, sportsmanship..."
                  value={newLabelDesc}
                  onChange={(e) => setNewLabelDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddLabelOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-extrabold"
                >
                  Save Label
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT METRIC */}
      {isMetricModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold">
              {editingMetricId ? 'Edit Measured Metric' : 'Register Custom Measured Metric'}
            </h3>
            <form onSubmit={handleSaveMetric} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Metric Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 20m Acceleration Sprint"
                  value={metricName}
                  onChange={(e) => setMetricName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tied Category Label *</label>
                <select
                  value={metricLabelId}
                  onChange={(e) => setMetricLabelId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {labels.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Type</label>
                  <select
                    value={metricType}
                    onChange={(e) => setMetricType(e.target.value as MetricType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    disabled={editingMetricId === 'm_attendance'}
                  >
                    <option value="time_seconds">Time (seconds)</option>
                    <option value="count">Count (reps/goals)</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="rating_10">Rating (1-10)</option>
                    <option value="attendance">Attendance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Unit Display</label>
                  <input
                    type="text"
                    placeholder="s, reps, goals..."
                    value={metricUnit}
                    onChange={(e) => setMetricUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Direction</label>
                <select
                  value={metricHigherIsBetter ? 'higher' : 'lower'}
                  onChange={(e) => setMetricHigherIsBetter(e.target.value === 'higher')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="higher">Higher value is better (e.g. Juggling count, Goals)</option>
                  <option value="lower">Lower value is better (e.g. Sprint time in seconds)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">How to use (aggregation)</label>
                <select
                  value={metricAggregation}
                  onChange={(e) =>
                    setMetricAggregation(e.target.value as MetricAggregationMode)
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {AGGREGATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Min expected</label>
                  <input
                    type="number"
                    step="any"
                    value={metricMin}
                    onChange={(e) => setMetricMin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Max expected</label>
                  <input
                    type="number"
                    step="any"
                    value={metricMax}
                    onChange={(e) => setMetricMax(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="optional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={metricDesc}
                  onChange={(e) => setMetricDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Optional notes for coaches"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMetricModalOpen(false);
                    resetMetricForm();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-500 text-white font-extrabold"
                >
                  {editingMetricId ? 'Save Changes' : 'Save Metric'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
