import React, { useState } from 'react';
import { Database, Loader2, RefreshCw, Wrench } from 'lucide-react';
import {
  CURRENT_SCHEMA_VERSION,
  getMigrationStatus,
  repairLocalMigrations,
  runLocalMigrations,
  type MigrationRunReport,
} from '../services/migrations';

interface DataMigrationPanelProps {
  onComplete?: () => void;
}

export const DataMigrationPanel: React.FC<DataMigrationPanelProps> = ({
  onComplete,
}) => {
  const [status, setStatus] = useState(() => getMigrationStatus());
  const [busy, setBusy] = useState(false);
  const [lastReport, setLastReport] = useState<MigrationRunReport | null>(null);

  const refresh = () => setStatus(getMigrationStatus());

  const run = (fn: () => MigrationRunReport) => {
    setBusy(true);
    try {
      const report = fn();
      setLastReport(report);
      refresh();
      onComplete?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0">
          <Database className="w-5 h-5 text-sky-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white">Data migrations</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Adapts local browser data after product upgrades without wiping
            squads. Runs automatically on app load; use Repair if something looks
            wrong after a release.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
          <dt className="text-slate-500">Stored version</dt>
          <dd className="font-semibold text-slate-200 mt-0.5">
            {status.storedVersion}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
          <dt className="text-slate-500">App expects</dt>
          <dd className="font-semibold text-slate-200 mt-0.5">
            {CURRENT_SCHEMA_VERSION}
          </dd>
        </div>
      </dl>

      {status.upToDate ? (
        <p className="text-xs text-emerald-400/90">Local data is up to date.</p>
      ) : (
        <div className="text-xs text-amber-200/90 space-y-1">
          <p>Pending migrations:</p>
          <ul className="list-disc pl-4 text-slate-400">
            {status.pending.map((m) => (
              <li key={m.id}>
                #{m.id} {m.name} — {m.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || status.upToDate}
          onClick={() => run(() => runLocalMigrations())}
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-3 py-2 text-xs font-semibold"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Run pending
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (
              !window.confirm(
                'Re-run all migrations from v0? Data is kept; shapes are repaired idempotently.',
              )
            ) {
              return;
            }
            run(() => repairLocalMigrations());
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-semibold"
        >
          <Wrench className="w-3.5 h-3.5" />
          Repair (re-run all)
        </button>
      </div>

      {lastReport && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400 space-y-1">
          <p>
            Last run: v{lastReport.fromVersion} → v{lastReport.toVersion}
            {lastReport.skipped ? ' (already current)' : ''}
          </p>
          {lastReport.applied.map((a) => (
            <p key={a.id}>
              Applied #{a.id} {a.name}: {a.notes.join(' ') || 'ok'}
            </p>
          ))}
          {lastReport.error && (
            <p className="text-rose-300">Error: {lastReport.error}</p>
          )}
        </div>
      )}
    </section>
  );
};
