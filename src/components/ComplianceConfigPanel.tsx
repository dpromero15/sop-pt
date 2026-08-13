import React, { useState } from 'react';
import { ClipboardList, Pencil, Plus, Trash2, Sparkles } from 'lucide-react';
import type { ComplianceRequirement, RequirementKind } from '../types';
import { StorageService } from '../services/storage';
import { flushNow } from '../services/storage/cloudSync';
import { SaveAndSyncButton } from './SaveAndSyncButton';
import { isFlagRequirement } from '../utils/eligibility';
import {
  consequenceLabelsForRequirement,
  mergeRecommendedCompliance,
  polarityHint,
} from '../utils/complianceConsequences';

interface ComplianceConfigPanelProps {
  requirements: ComplianceRequirement[];
  onRefreshData: () => void;
}

const KIND_OPTIONS: { value: RequirementKind; label: string; hint: string }[] = [
  {
    value: 'paperwork',
    label: 'Paperwork',
    hint: 'Check when the form is on file.',
  },
  { value: 'fee', label: 'Fee', hint: 'Check when the fee is paid.' },
  {
    value: 'eligibility',
    label: 'Eligibility / grade check',
    hint: 'Check to FLAG (ineligible). Uncheck when cleared.',
  },
  {
    value: 'disciplinary',
    label: 'Disciplinary',
    hint: 'Check to FLAG (sit-out / card). Uncheck after served.',
  },
  { value: 'other', label: 'Other', hint: 'Check when complete.' },
];

export const ComplianceConfigPanel: React.FC<ComplianceConfigPanelProps> = ({
  requirements,
  onRefreshData,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<ComplianceRequirement | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<RequirementKind>('paperwork');
  const [blocksPlay, setBlocksPlay] = useState(true);
  const [blocksPractice, setBlocksPractice] = useState(false);
  const [blocksEquipment, setBlocksEquipment] = useState(false);
  const [description, setDescription] = useState('');

  const openAdd = () => {
    setEditing(null);
    setName('');
    setKind('paperwork');
    setBlocksPlay(true);
    setBlocksPractice(false);
    setBlocksEquipment(false);
    setDescription('');
    setIsOpen(true);
  };

  const openEdit = (req: ComplianceRequirement) => {
    setEditing(req);
    setName(req.name);
    setKind(req.kind);
    setBlocksPlay(req.blocksPlay);
    setBlocksPractice(req.blocksPractice);
    setBlocksEquipment(req.blocksEquipment === true);
    setDescription(req.description ?? '');
    setIsOpen(true);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const payload = {
      name: trimmed,
      kind,
      blocksPlay,
      blocksPractice,
      blocksEquipment,
      description: description.trim() || undefined,
    };
    if (editing) {
      StorageService.updateComplianceRequirement({
        ...editing,
        ...payload,
      });
    } else {
      const maxOrder = requirements.reduce(
        (m, r) => Math.max(m, r.sortOrder),
        0,
      );
      StorageService.addComplianceRequirement({
        ...payload,
        sortOrder: maxOrder + 1,
      });
    }
    setIsOpen(false);
    void flushNow();
    onRefreshData();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this requirement? Player completion for it will be removed.')) {
      return;
    }
    StorageService.deleteComplianceRequirement(id);
    void flushNow();
    onRefreshData();
  };

  const handleApplyRecommended = () => {
    if (
      !confirm(
        'Apply the recommended CRHS set (Physical, Grade Check, CRHS Policy, CHSSAA Policy, Team fee)? Existing items with those ids are updated; extra items such as red-card sit-out are kept.',
      )
    ) {
      return;
    }
    StorageService.saveComplianceRequirements(
      mergeRecommendedCompliance(requirements),
    );
    void flushNow();
    onRefreshData();
  };

  const kindMeta = KIND_OPTIONS.find((o) => o.value === kind);
  const previewReq: ComplianceRequirement = {
    id: 'preview',
    name: name || 'Requirement',
    kind,
    blocksPlay,
    blocksPractice,
    blocksEquipment,
    sortOrder: 0,
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-100 font-semibold">
          <ClipboardList className="w-5 h-5 text-amber-400" />
          <span>Compliance manager</span>
        </div>
        <div className="flex items-center gap-2">
          <SaveAndSyncButton />
          <button
            type="button"
            onClick={handleApplyRecommended}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-200 text-sm font-semibold px-3 py-1.5"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            Recommended set
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-semibold px-3 py-1.5"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-400">
        Each item has a <span className="text-slate-200">kind</span> (how the
        checkbox works) and <span className="text-slate-200">consequences</span>{' '}
        (what happens when it is incomplete or flagged). Eligibility / grade
        check and disciplinary: check to raise a flag. Paperwork and fees: check
        when done. Save pushes to cloud now (do not wait for JIT).
      </p>
      <ul className="space-y-2">
        {requirements.map((req) => (
          <li
            key={req.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-100">{req.name}</span>
                <span className="text-[11px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
                  {req.kind}
                </span>
                {consequenceLabelsForRequirement(req).map((label) => (
                  <span
                    key={label}
                    className="text-[11px] uppercase tracking-wide text-rose-200 border border-rose-500/40 rounded px-1.5 py-0.5"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {polarityHint(req)}
                {req.description ? ` ${req.description}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openEdit(req)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                aria-label={`Edit ${req.name}`}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(req.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800"
                aria-label={`Delete ${req.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
        {requirements.length === 0 && (
          <li className="text-sm text-slate-500 py-2">No requirements yet.</li>
        )}
      </ul>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-100">
              {editing ? 'Edit requirement' : 'Add requirement'}
            </h3>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Grade Check"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Kind (checkbox meaning)</span>
              <select
                value={kind}
                onChange={(e) => {
                  const next = e.target.value as RequirementKind;
                  setKind(next);
                  if (next === 'eligibility' || next === 'disciplinary') {
                    setBlocksPlay(true);
                    setBlocksPractice(false);
                  }
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-amber-200/90">{kindMeta?.hint}</span>
            </label>
            <fieldset className="space-y-2">
              <legend className="text-xs text-slate-400">
                When incomplete / flagged
              </legend>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={blocksPlay}
                  onChange={(e) => setBlocksPlay(e.target.checked)}
                  className="rounded border-slate-600"
                />
                {kind === 'eligibility' ? 'Ineligible' : 'No play'}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={blocksPractice}
                  onChange={(e) => setBlocksPractice(e.target.checked)}
                  className="rounded border-slate-600"
                />
                No practice
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={blocksEquipment}
                  onChange={(e) => setBlocksEquipment(e.target.checked)}
                  className="rounded border-slate-600"
                />
                No equipment
              </label>
              <p className="text-[11px] text-slate-500">
                Preview: {consequenceLabelsForRequirement(previewReq).join(', ') || 'no block'}
                {isFlagRequirement(previewReq) ? ' · flag checkbox' : ' · complete checkbox'}
              </p>
            </fieldset>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
