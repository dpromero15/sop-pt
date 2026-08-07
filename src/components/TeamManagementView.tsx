import React, { useEffect, useState } from 'react';
import { Save, Shield } from 'lucide-react';
import type { Team } from '../types';
import { StorageService, pushTeamToCloud } from '../services/storage';

interface TeamManagementViewProps {
  onRefreshData: () => void;
}

export const TeamManagementView: React.FC<TeamManagementViewProps> = ({
  onRefreshData,
}) => {
  const [form, setForm] = useState<Team>(() => StorageService.getTeam());
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(StorageService.getTeam());
  }, []);

  const update = <K extends keyof Team>(key: K, value: Team[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      StorageService.saveTeam(form);
      try {
        await pushTeamToCloud();
      } catch {
        // local save succeeded; cloud optional
      }
      onRefreshData();
      setToast('Team profile saved.');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40';

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-emerald-400">
            <Shield className="w-4 h-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Team management</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Edit the current team name and profile. Changes save to local JSON blobs and sync to
            cloud when connected.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-3 py-2 text-xs font-semibold text-white"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save team'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-slate-400">
          Team name
          <input className={fieldClass} value={form.name} onChange={(e) => update('name', e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          Short name
          <input className={fieldClass} value={form.shortName} onChange={(e) => update('shortName', e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          Season
          <input className={fieldClass} value={form.season} onChange={(e) => update('season', e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          Age group
          <input className={fieldClass} value={form.ageGroup} onChange={(e) => update('ageGroup', e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          Club name
          <input className={fieldClass} value={form.clubName} onChange={(e) => update('clubName', e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          Home venue
          <input className={fieldClass} value={form.homeVenue} onChange={(e) => update('homeVenue', e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          Primary color
          <input className={fieldClass} value={form.primaryColor} onChange={(e) => update('primaryColor', e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          Secondary color
          <input className={fieldClass} value={form.secondaryColor} onChange={(e) => update('secondaryColor', e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          Coach
          <input className={fieldClass} value={form.coachName ?? ''} onChange={(e) => update('coachName', e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          Contact email
          <input className={fieldClass} value={form.contactEmail ?? ''} onChange={(e) => update('contactEmail', e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          Timezone
          <input className={fieldClass} value={form.timezone} onChange={(e) => update('timezone', e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-slate-400 sm:col-span-2">
          Notes
          <textarea
            className={`${fieldClass} min-h-20`}
            value={form.notes ?? ''}
            onChange={(e) => update('notes', e.target.value)}
          />
        </label>
      </div>

      {toast && (
        <p className="text-xs text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-2 bg-emerald-500/10">
          {toast}
        </p>
      )}
    </section>
  );
};
