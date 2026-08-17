import React, { useEffect, useState } from 'react';
import { 
  Sliders, 
  Tag, 
  Check, 
  RotateCcw, 
  Download, 
  Upload, 
  Layers,
  Pencil,
  Award,
  Trash2,
  Lock,
} from 'lucide-react';
import { 
  LabelDefinition, 
  MetricDefinition, 
  ScoringFormulaConfig, 
  MetricType,
  MetricAggregationMode,
  AdjustedBumpConfig,
  ComplianceRequirement,
  EquipmentGroup,
  EquipmentItem,
  RankingBoundariesConfig,
  Player,
  PositionDefinition,
  SubTeam,
} from '../types';
import { StorageService } from '../services/storage';
import { flushNow } from '../services/storage/cloudSync';
import { SaveAndSyncButton } from './SaveAndSyncButton';
import { TeamManagementView } from './TeamManagementView';
import { ComplianceConfigPanel } from './ComplianceConfigPanel';
import { EquipmentConfigPanel } from './EquipmentConfigPanel';
import { RankingBoundariesPanel } from './RankingBoundariesPanel';
import { PositionsConfigPanel } from './PositionsConfigPanel';
import { SubTeamsConfigPanel } from './SubTeamsConfigPanel';
import { defaultAggregationMode } from '../utils/metricAggregation';
import { assignMetricPrimary, metricLabelPayload } from '../utils/metricLabels';
import {
  DEFAULT_ATTENDANCE_WEIGHT_PERCENT,
  visibleRankingLabels,
} from '../utils/formulaWeights';
import {
  canParentHaveChildren,
  childrenOf,
  isSubcategory,
  labelPathName,
  parentIdsOf,
  primaryParentIdOf,
  rootLabels,
  toggleTreeMembership,
} from '../utils/labelTree';

interface ConfigViewProps {
  labels: LabelDefinition[];
  metrics: MetricDefinition[];
  formula: ScoringFormulaConfig;
  bumpBudget: AdjustedBumpConfig;
  complianceRequirements: ComplianceRequirement[];
  equipmentGroups: EquipmentGroup[];
  equipmentItems: EquipmentItem[];
  rankingBoundaries: RankingBoundariesConfig;
  positions: PositionDefinition[];
  subTeams: SubTeam[];
  players: Player[];
  onRefreshData: () => void;
}

const AGGREGATION_OPTIONS: { value: MetricAggregationMode; label: string }[] = [
  { value: 'sum', label: 'Season total (add all entries)' },
  { value: 'best', label: 'All-time best (min or max by direction)' },
  { value: 'average', label: 'Average of all entries' },
  { value: 'latest', label: 'Latest entry only' },
];

export const ConfigView: React.FC<ConfigViewProps> = ({
  labels,
  metrics,
  formula,
  bumpBudget,
  complianceRequirements,
  equipmentGroups,
  equipmentItems,
  rankingBoundaries,
  positions,
  subTeams,
  players,
  onRefreshData
}) => {
  const [weightsMap, setWeightsMap] = useState<Record<string, { weightPercent: number; enabled: boolean }>>(() => {
    const map: Record<string, { weightPercent: number; enabled: boolean }> = {};
    formula.weights.forEach(w => {
      map[w.labelId] = {
        weightPercent: w.weightPercent,
        enabled: w.labelId === 'attendance' ? true : w.enabled,
      };
    });
    labels.forEach(l => {
      if (!map[l.id]) {
        map[l.id] = {
          weightPercent: l.id === 'attendance' ? DEFAULT_ATTENDANCE_WEIGHT_PERCENT : 10,
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

  // Formula sliders: Attendance first, then parent categories only.
  const weightLabels = visibleRankingLabels(labels);

  // Keep weightsMap in sync when labels change (add/remove/clear)
  useEffect(() => {
    setWeightsMap((prev) => {
      const next: Record<string, { weightPercent: number; enabled: boolean }> = {};
      const formulaById = new Map<string, { weightPercent: number; enabled: boolean }>(
        formula.weights.map((w) => [
          w.labelId,
          { weightPercent: w.weightPercent, enabled: w.enabled },
        ]),
      );
      const ensureId = (id: string) => {
        const fromFormula = formulaById.get(id);
        next[id] =
          prev[id] ??
          (fromFormula
            ? {
                weightPercent: fromFormula.weightPercent,
                enabled: id === 'attendance' ? true : fromFormula.enabled,
              }
            : {
                weightPercent:
                  id === 'attendance' ? DEFAULT_ATTENDANCE_WEIGHT_PERCENT : 10,
                enabled: true,
              });
        if (id === 'attendance') {
          next[id] = { ...next[id], enabled: true };
        }
      };
      ensureId('attendance');
      visibleRankingLabels(labels).forEach((l) => ensureId(l.id));
      return next;
    });
  }, [labels, formula.weights]);

  // Modal / Form state for Adding / Editing Custom Label
  const [isAddLabelOpen, setIsAddLabelOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelDefinition | null>(null);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelDesc, setNewLabelDesc] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('emerald');
  const [newLabelParentIds, setNewLabelParentIds] = useState<string[]>([]);
  const [newLabelPrimaryParentId, setNewLabelPrimaryParentId] = useState('');
  const [labelFormIsSubcategory, setLabelFormIsSubcategory] = useState(false);

  // Modal / Form state for Adding / Editing Metric Definition
  const [isMetricModalOpen, setIsMetricModalOpen] = useState(false);
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);
  const [metricName, setMetricName] = useState('');
  const [metricLabelIds, setMetricLabelIds] = useState<string[]>([
    labels.find((l) => l.id !== 'attendance')?.id || labels[0]?.id || 'attendance',
  ]);
  const [metricPrimaryLabelId, setMetricPrimaryLabelId] = useState(
    labels.find((l) => l.id !== 'attendance')?.id || labels[0]?.id || 'attendance',
  );
  const [metricType, setMetricType] = useState<MetricType>('count');
  const [metricUnit, setMetricUnit] = useState('reps');
  const [metricHigherIsBetter, setMetricHigherIsBetter] = useState(true);
  const [metricAggregation, setMetricAggregation] =
    useState<MetricAggregationMode>('latest');
  const [metricMin, setMetricMin] = useState('');
  const [metricMax, setMetricMax] = useState('');
  const [metricDesc, setMetricDesc] = useState('');
  const [metricIncludeInAdjusted, setMetricIncludeInAdjusted] = useState(true);
  const [metricTreatNoScoreAsZero, setMetricTreatNoScoreAsZero] = useState(true);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [plusBudgetDraft, setPlusBudgetDraft] = useState(String(bumpBudget.plusBudget));
  const [minusBudgetDraft, setMinusBudgetDraft] = useState(String(bumpBudget.minusBudget));

  useEffect(() => {
    setPlusBudgetDraft(String(bumpBudget.plusBudget));
    setMinusBudgetDraft(String(bumpBudget.minusBudget));
  }, [bumpBudget.plusBudget, bumpBudget.minusBudget]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSaveBumpBudget = () => {
    const plus = Math.max(0, Math.floor(Number(plusBudgetDraft) || 0));
    const minus = Math.max(0, Math.floor(Number(minusBudgetDraft) || 0));
    StorageService.saveBumpBudget({ plusBudget: plus, minusBudget: minus });
    void flushNow();
    onRefreshData();
    showToast('✓ Adjusted bump budget saved');
  };

  const resetMetricForm = () => {
    setEditingMetricId(null);
    setMetricName('');
    const defaultLabel =
      labels.find((l) => l.id !== 'attendance')?.id || labels[0]?.id || 'attendance';
    setMetricLabelIds([defaultLabel]);
    setMetricPrimaryLabelId(defaultLabel);
    setMetricType('count');
    setMetricUnit('reps');
    setMetricHigherIsBetter(true);
    setMetricAggregation('best');
    setMetricMin('');
    setMetricMax('');
    setMetricDesc('');
    setMetricIncludeInAdjusted(true);
    setMetricTreatNoScoreAsZero(true);
  };

  const openAddMetric = () => {
    resetMetricForm();
    setIsMetricModalOpen(true);
  };

  const openEditMetric = (m: MetricDefinition) => {
    setEditingMetricId(m.id);
    setMetricName(m.name);
    const ids =
      m.labelIds?.length > 0
        ? m.labelIds
        : [m.primaryLabelId || 'attendance'];
    setMetricLabelIds(ids);
    setMetricPrimaryLabelId(
      ids.includes(m.primaryLabelId) ? m.primaryLabelId : ids[0],
    );
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
    setMetricIncludeInAdjusted(m.includeInAdjustedTotal !== false);
    setMetricTreatNoScoreAsZero(m.treatNoScoreAsZero !== false);
    setIsMetricModalOpen(true);
  };

  const isSystemLabel = (lbl: LabelDefinition) =>
    Boolean(lbl.system) || lbl.id === 'attendance';

  /** Attendance stays on in the formula; coaches can still change its %. */
  const isWeightToggleLocked = (lbl: LabelDefinition) => isSystemLabel(lbl);

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
    const allowed = new Set(weightLabels.map((l) => l.id));
    const updatedWeights = Object.entries(weightsMap)
      .filter(([labelId]) => allowed.has(labelId))
      .map(([labelId, item]: [string, { weightPercent: number; enabled: boolean }]) => ({
      labelId,
      weightPercent: item.weightPercent,
      enabled: labelId === 'attendance' ? true : item.enabled,
    }));

    StorageService.saveFormula({
      ...formula,
      weights: updatedWeights
    });
    void flushNow();
    onRefreshData();
    showToast('✓ Formula saved — syncing to cloud');
  };

  // Formula Presets — only touch categories that currently exist.
  const handleApplyPreset = (presetType: 'balanced' | 'offense' | 'fitness') => {
    const updated: Record<string, { weightPercent: number; enabled: boolean }> = {};
    weightLabels.forEach(l => {
      updated[l.id] = { weightPercent: 0, enabled: false };
    });

    const setIfPresent = (id: string, weightPercent: number) => {
      if (id in updated) {
        updated[id] = { weightPercent, enabled: true };
      }
    };

    if (presetType === 'balanced') {
      setIfPresent('attendance', 20);
      setIfPresent('speed', 15);
      setIfPresent('technical', 20);
      setIfPresent('offense', 15);
      setIfPresent('defense', 15);
      setIfPresent('character', 15);
    } else if (presetType === 'offense') {
      setIfPresent('attendance', 10);
      setIfPresent('speed', 20);
      setIfPresent('technical', 25);
      setIfPresent('offense', 35);
      setIfPresent('character', 10);
    } else if (presetType === 'fitness') {
      setIfPresent('attendance', 25);
      setIfPresent('speed', 25);
      setIfPresent('agility', 25);
      setIfPresent('fitness', 25);
    }

    // System categories stay enabled; preset may still update their %.
    weightLabels.forEach((l) => {
      if (isWeightToggleLocked(l) && updated[l.id]) {
        updated[l.id] = { ...updated[l.id], enabled: true };
      }
    });

    setWeightsMap(updated);
  };

  const openEditLabel = (lbl: LabelDefinition) => {
    setEditingLabel(lbl);
    setNewLabelName(lbl.name);
    setNewLabelDesc(lbl.description);
    setNewLabelColor(lbl.color);
    setNewLabelParentIds(parentIdsOf(lbl));
    setNewLabelPrimaryParentId(primaryParentIdOf(lbl) ?? '');
    setLabelFormIsSubcategory(isSubcategory(lbl));
    setIsAddLabelOpen(true);
  };

  const closeLabelModal = () => {
    setIsAddLabelOpen(false);
    setEditingLabel(null);
    setNewLabelName('');
    setNewLabelDesc('');
    setNewLabelColor('emerald');
    setNewLabelParentIds([]);
    setNewLabelPrimaryParentId('');
    setLabelFormIsSubcategory(false);
  };

  const openAddParentLabel = () => {
    setEditingLabel(null);
    setNewLabelParentIds([]);
    setNewLabelPrimaryParentId('');
    setLabelFormIsSubcategory(false);
    setNewLabelName('');
    setNewLabelDesc('');
    setNewLabelColor('emerald');
    setIsAddLabelOpen(true);
  };

  const openAddSubcategory = (parent: LabelDefinition) => {
    setEditingLabel(null);
    setNewLabelParentIds([parent.id]);
    setNewLabelPrimaryParentId(parent.id);
    setLabelFormIsSubcategory(true);
    setNewLabelName('');
    setNewLabelDesc('');
    setNewLabelColor(parent.color);
    setIsAddLabelOpen(true);
  };

  const toggleLabelParent = (id: string, checked: boolean) => {
    setNewLabelParentIds((prev) => {
      const next = checked
        ? [...prev.filter((x) => x !== id), id]
        : prev.filter((x) => x !== id);
      if (!next.includes(newLabelPrimaryParentId) && next.length > 0) {
        setNewLabelPrimaryParentId(next[0]);
      }
      return next;
    });
  };

  const toggleMetricLabel = (id: string, checked: boolean) => {
    setMetricLabelIds((prev) => {
      const resolved = toggleTreeMembership(prev, id, checked, labels).filter(
        (labelId) => labelId !== 'attendance',
      );
      if (!resolved.includes(metricPrimaryLabelId) && resolved.length > 0) {
        setMetricPrimaryLabelId(resolved[0]);
      }
      return resolved;
    });
  };

  // Add / update Label
  const handleSaveLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;

    if (labelFormIsSubcategory && newLabelParentIds.length === 0) {
      alert('Pick at least one parent category.');
      return;
    }
    const parentPayload = labelFormIsSubcategory
      ? {
          parentLabelIds: newLabelParentIds,
          primaryParentLabelId: newLabelParentIds.includes(
            newLabelPrimaryParentId,
          )
            ? newLabelPrimaryParentId
            : newLabelParentIds[0],
        }
      : {};

    if (editingLabel) {
      StorageService.updateLabel({
        ...editingLabel,
        name: newLabelName.trim(),
        description: newLabelDesc.trim() || editingLabel.description,
        ...parentPayload,
      });
      closeLabelModal();
      void flushNow();
      onRefreshData();
      showToast('✓ Category label updated!');
      return;
    }

    let created;
    try {
      created = StorageService.addLabel({
        name: newLabelName,
        description: newLabelDesc || 'Custom category label',
        color: newLabelColor,
        badgeBg: `bg-${newLabelColor}-500/15 text-${newLabelColor}-300 border-${newLabelColor}-500/30`,
        badgeText: `text-${newLabelColor}-300`,
        ...parentPayload,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not add label.');
      return;
    }

    if (!isSubcategory(created)) {
      setWeightsMap((prev) => ({
        ...prev,
        [created.id]: prev[created.id] ?? { weightPercent: 10, enabled: true },
      }));
    }

    closeLabelModal();
    void flushNow();
    onRefreshData();
    showToast(
      isSubcategory(created)
        ? '✓ Subcategory added!'
        : '✓ New category label added!',
    );
  };

  const handleDeleteLabel = (lbl: LabelDefinition) => {
    if (lbl.system) return;
    const kids = childrenOf(labels, lbl.id);
    const exclusiveCount = kids.filter((c) => parentIdsOf(c).length === 1).length;
    const confirmMsg = exclusiveCount
      ? `Remove category "${lbl.name}"? Remove its ${exclusiveCount} subcategor${exclusiveCount === 1 ? 'y' : 'ies'} first.`
      : kids.length > 0
        ? `Remove category "${lbl.name}"? Shared subcategories will stay under their other parents.`
        : `Remove category label "${lbl.name}"? Metrics using it must be reassigned first.`;
    if (!confirm(confirmMsg)) {
      return;
    }
    try {
      StorageService.deleteLabel(lbl.id);
      setWeightsMap((prev) => {
        const next = { ...prev };
        delete next[lbl.id];
        return next;
      });
      void flushNow();
      onRefreshData();
      showToast('✓ Category label removed!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete label.');
    }
  };

  const handleClearNonSystemLabels = () => {
    if (
      !confirm(
        'Clear all non-system category labels? System labels (e.g. Attendance) are kept. Formula weights for removed labels will be stripped.',
      )
    ) {
      return;
    }
    StorageService.clearNonSystemLabels();
    const remaining = StorageService.getLabels();
    const formulaNow = StorageService.getFormula();
    const map: Record<string, { weightPercent: number; enabled: boolean }> = {};
    remaining.forEach((l) => {
      const w = formulaNow.weights.find((fw) => fw.labelId === l.id);
      map[l.id] = w
        ? { weightPercent: w.weightPercent, enabled: w.enabled }
        : { weightPercent: 10, enabled: true };
    });
    setWeightsMap(map);
    void flushNow();
    onRefreshData();
    showToast('✓ Non-system labels cleared!');
  };

  const handleClearNonSystemMetrics = () => {
    if (
      !confirm(
        'Clear all non-attendance metrics? Session attendance is kept; session metric plans will be scrubbed.',
      )
    ) {
      return;
    }
    StorageService.clearNonSystemMetrics();
    void flushNow();
    onRefreshData();
    showToast('✓ Non-system metrics cleared!');
  };

  // Add / update Metric Definition
  const handleSaveMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!metricName.trim()) return;

    const isAttendanceMetric =
      metricType === 'attendance' || editingMetricId === 'm_attendance';
    if (!isAttendanceMetric && metricLabelIds.length === 0) return;

    const labelsPayload = metricLabelPayload(
      metricLabelIds,
      metricPrimaryLabelId,
      { attendance: isAttendanceMetric, labels },
    );
    const payload: Omit<MetricDefinition, 'id'> = {
      name: metricName.trim(),
      ...labelsPayload,
      type: metricType,
      unit: metricUnit.trim() || 'units',
      higherIsBetter: metricHigherIsBetter,
      aggregationMode: metricAggregation,
      description: metricDesc.trim() || undefined,
      minExpectedValue: metricMin !== '' ? Number(metricMin) : undefined,
      maxExpectedValue: metricMax !== '' ? Number(metricMax) : undefined,
      ...(isAttendanceMetric
        ? {}
        : {
            includeInAdjustedTotal: metricIncludeInAdjusted,
            treatNoScoreAsZero: metricTreatNoScoreAsZero,
          }),
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
    void flushNow();
    onRefreshData();
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

      <ComplianceConfigPanel
        requirements={complianceRequirements}
        onRefreshData={onRefreshData}
      />
      <EquipmentConfigPanel
        groups={equipmentGroups}
        items={equipmentItems}
        players={players}
        onRefreshData={onRefreshData}
      />
      <PositionsConfigPanel
        positions={positions}
        players={players}
        onRefreshData={onRefreshData}
      />
      <SubTeamsConfigPanel
        subTeams={subTeams}
        players={players}
        onRefreshData={onRefreshData}
      />
      <RankingBoundariesPanel
        boundaries={rankingBoundaries}
        labels={labels}
        metrics={metrics}
        onRefreshData={onRefreshData}
      />

      {/* Adjusted ±1 bump budget */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-cyan-400" />
            <span>Adjusted ±1 Bump Budget</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Team-level budgets for Rankings → Adjusted Rank. Bumps are attributed
            to the selected coach. Sum of positive bumps cannot exceed plus
            budget; abs sum of negatives cannot exceed minus budget.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Plus budget
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={plusBudgetDraft}
              onChange={(e) => setPlusBudgetDraft(e.target.value)}
              className="w-28 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Minus budget
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={minusBudgetDraft}
              onChange={(e) => setMinusBudgetDraft(e.target.value)}
              className="w-28 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveBumpBudget}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold"
          >
            <Check className="w-3.5 h-3.5" />
            Save budget
          </button>
        </div>
      </div>

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
              Configure exact category label weightings to calculate total player score (e.g. Attendance + Offense + Defense + Speed). Attendance stays on as a system default; set its % to control how much reliability counts.
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
          {weightLabels.map(lbl => {
            const item = weightsMap[lbl.id] || {
              weightPercent:
                lbl.id === 'attendance' ? DEFAULT_ATTENDANCE_WEIGHT_PERCENT : 10,
              enabled: true,
            };
            const toggleLocked = isWeightToggleLocked(lbl);
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
                      onChange={() => !toggleLocked && handleToggleLabelEnabled(lbl.id)}
                      disabled={toggleLocked}
                      className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 bg-slate-900 border-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <span className="font-bold text-sm text-white">{lbl.name}</span>
                    {toggleLocked && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">
                        <Lock className="w-2.5 h-2.5" />
                        Always on
                      </span>
                    )}
                  </div>

                  <span className="text-sm font-extrabold text-rose-400">
                    {item.enabled ? `${item.weightPercent}%` : 'Disabled'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-1">{lbl.description}</p>

                {item.enabled && (
                  <input
                    type="range"
                    min={toggleLocked ? 5 : 0}
                    max={50}
                    step={5}
                    value={item.weightPercent}
                    onChange={(e) =>
                      handleWeightChange(lbl.id, parseInt(e.target.value))
                    }
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-xs text-slate-500">
            Sliders stay local until you save. Save also flushes JIT so other devices pick up the formula.
          </p>
          <button
            type="button"
            onClick={handleSaveFormula}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-rose-500/20 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Save Weights Formula</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: CATEGORY LABELS & METRIC DEFINITIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Labels Manager */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-400" />
              <span>Category Labels ({labels.length})</span>
            </h3>

            <div className="flex items-center gap-1.5">
              <SaveAndSyncButton compact />
              <button
                type="button"
                onClick={handleClearNonSystemLabels}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 font-semibold text-xs transition-all active:scale-95"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={openAddParentLabel}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold text-xs transition-all active:scale-95"
              >
                + Add Label
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {rootLabels(labels).map((root) => {
              const kids = childrenOf(labels, root.id);
              return (
                <div key={root.id} className="space-y-1.5">
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{root.name}</span>
                        {root.system && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            <Lock className="w-2.5 h-2.5" />
                            System
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        {root.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${root.badgeBg}`}>
                        {root.color}
                      </span>
                      {canParentHaveChildren(root) && (
                        <button
                          type="button"
                          onClick={() => openAddSubcategory(root)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold"
                          title="Add subcategory"
                        >
                          + Sub
                        </button>
                      )}
                      {!root.system && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditLabel(root)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            title="Edit label"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLabel(root)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                            title="Remove label"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {kids.map((child) => {
                    const otherParents = parentIdsOf(child)
                      .filter((id) => id !== root.id)
                      .map((id) => labels.find((l) => l.id === id)?.name || id);
                    return (
                    <div
                      key={child.id}
                      className="ml-5 bg-slate-950/70 border border-slate-800/60 rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-200">
                          {child.name}
                        </span>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          {otherParents.length > 0
                            ? `Also ${otherParents.join(', ')}${
                                primaryParentIdOf(child) === root.id
                                  ? ' · primary here'
                                  : ` · primary ${
                                      labels.find(
                                        (l) => l.id === primaryParentIdOf(child),
                                      )?.name || ''
                                    }`
                              }`
                            : child.description || 'Subcategory'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditLabel(child)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Edit subcategory"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLabel(child)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                          title="Remove subcategory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Metric Definitions Manager */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Measured Metrics ({metrics.length})</span>
            </h3>

            <div className="flex items-center gap-1.5">
              <SaveAndSyncButton compact />
              <button
                type="button"
                onClick={handleClearNonSystemMetrics}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 font-semibold text-xs transition-all active:scale-95"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={openAddMetric}
                className="px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 font-semibold text-xs transition-all active:scale-95"
              >
                + Add Metric
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {metrics.map(m => {
              const primaryName = labelPathName(labels, m.primaryLabelId);
              const secondaryNames = (m.labelIds || [])
                .filter((id) => id !== m.primaryLabelId)
                .map((id) => labelPathName(labels, id));
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
                      Primary:{' '}
                      <strong className="text-blue-300">
                        {primaryName}
                      </strong>
                      {secondaryNames.length > 0 && (
                        <>
                          {' · Also: '}
                          <span className="text-slate-300">
                            {secondaryNames.join(', ')}
                          </span>
                        </>
                      )}
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

      {/* MODAL: ADD / EDIT LABEL */}
      {isAddLabelOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[min(92dvh,100%)] flex flex-col overflow-hidden shadow-2xl text-white">
            <div className="shrink-0 px-5 pt-5 pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold">
                {editingLabel
                  ? labelFormIsSubcategory
                    ? 'Edit subcategory'
                    : 'Edit Category Label'
                  : labelFormIsSubcategory
                    ? 'Add subcategory'
                    : 'Add Custom Category Label'}
              </h3>
            </div>
            <form
              onSubmit={handleSaveLabel}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-3 text-xs sm:text-sm">
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

              {labelFormIsSubcategory && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Parent categories *
                  </label>
                  <div className="flex flex-wrap gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-3">
                    {rootLabels(labels)
                      .filter((l) => canParentHaveChildren(l))
                      .map((root) => {
                        const checked = newLabelParentIds.includes(root.id);
                        return (
                          <label
                            key={root.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                              checked
                                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                                : 'border-slate-700 text-slate-400 hover:border-slate-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() =>
                                toggleLabelParent(root.id, !checked)
                              }
                            />
                            {root.name}
                          </label>
                        );
                      })}
                  </div>
                  {newLabelParentIds.length > 1 && (
                    <>
                      <label className="block text-slate-400 font-semibold mb-1 mt-3">
                        Primary parent (formula standing) *
                      </label>
                      <select
                        value={
                          newLabelParentIds.includes(newLabelPrimaryParentId)
                            ? newLabelPrimaryParentId
                            : newLabelParentIds[0]
                        }
                        onChange={(e) =>
                          setNewLabelPrimaryParentId(e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                      >
                        {newLabelParentIds.map((id) => (
                          <option key={id} value={id}>
                            {labels.find((l) => l.id === id)?.name || id}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1">
                    A subcategory can sit under several parents (e.g. Endurance
                    on Offense, Defense, and Midfield). Only the primary parent
                    counts that folder in overall rank.
                  </p>
                </div>
              )}
              </div>

              <div className="shrink-0 flex justify-end gap-2 px-5 py-3 border-t border-slate-800 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={closeLabelModal}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-extrabold"
                >
                  {editingLabel ? 'Save Changes' : 'Save Label'}
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
                <label className="block text-slate-400 font-semibold mb-1">
                  Categories *
                </label>
                {metricType === 'attendance' ||
                editingMetricId === 'm_attendance' ? (
                  <p className="text-[11px] text-slate-400 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                    Attendance is locked to the Attendance category.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2 bg-slate-950 border border-slate-800 rounded-xl p-3">
                      {rootLabels(labels)
                        .filter((l) => l.id !== 'attendance')
                        .map((root) => {
                          const kids = childrenOf(labels, root.id);
                          const rootChecked = metricLabelIds.includes(root.id);
                          return (
                            <div key={root.id} className="space-y-1.5">
                              <label
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                                  rootChecked
                                    ? 'border-blue-500/50 bg-blue-500/15 text-blue-200'
                                    : 'border-slate-700 text-slate-400 hover:border-slate-500'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={rootChecked}
                                  onChange={() =>
                                    toggleMetricLabel(root.id, !rootChecked)
                                  }
                                />
                                {root.name}
                              </label>
                              {kids.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pl-4">
                                  {kids.map((child) => {
                                    const checked = metricLabelIds.includes(
                                      child.id,
                                    );
                                    return (
                                      <label
                                        key={child.id}
                                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                                          checked
                                            ? 'border-blue-500/50 bg-blue-500/15 text-blue-200'
                                            : 'border-slate-700 text-slate-400 hover:border-slate-500'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          className="sr-only"
                                          checked={checked}
                                          onChange={() =>
                                            toggleMetricLabel(
                                              child.id,
                                              !checked,
                                            )
                                          }
                                        />
                                        {child.name}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    <label className="block text-slate-400 font-semibold mb-1 mt-3">
                      Primary category (formula standing) *
                    </label>
                    <select
                      value={
                        metricLabelIds.includes(metricPrimaryLabelId)
                          ? metricPrimaryLabelId
                          : metricLabelIds[0] || metricPrimaryLabelId
                      }
                      onChange={(e) => {
                        const next = assignMetricPrimary(
                          metricLabelIds,
                          metricPrimaryLabelId,
                          e.target.value,
                          labels,
                        );
                        setMetricLabelIds(next.labelIds);
                        setMetricPrimaryLabelId(next.primaryLabelId);
                      }}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      {labels
                        .filter(
                          (label) =>
                            label.id !== 'attendance' ||
                            label.id === metricPrimaryLabelId,
                        )
                        .map((label) => (
                          <option key={label.id} value={label.id}>
                            {labelPathName(labels, label.id)}
                          </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Changing primary moves the metric out of the previous
                      primary. Extra category chips stay as Also. Shared
                      subcategories appear under each parent; overall rank still
                      counts the metric once. Only the primary feeds formula
                      standing.
                    </p>
                  </>
                )}
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

              {metricType !== 'attendance' && editingMetricId !== 'm_attendance' && (
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={metricIncludeInAdjusted}
                      onChange={(e) => setMetricIncludeInAdjusted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-blue-500 focus:ring-blue-500 bg-slate-900 border-slate-700"
                    />
                    <span>
                      <span className="block font-semibold text-slate-200">
                        Include in Adjusted total
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        When off, this metric does not gap-penalize unscored players in Adjusted Rank
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={metricTreatNoScoreAsZero}
                      onChange={(e) => setMetricTreatNoScoreAsZero(e.target.checked)}
                      disabled={!metricIncludeInAdjusted}
                      className="mt-0.5 w-4 h-4 rounded text-blue-500 focus:ring-blue-500 bg-slate-900 border-slate-700 disabled:opacity-50"
                    />
                    <span>
                      <span className="block font-semibold text-slate-200">
                        Treat no score as 0
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Only applies when included in Adjusted — missing entries count as 0
                      </span>
                    </span>
                  </label>
                </div>
              )}

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
