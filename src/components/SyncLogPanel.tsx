import React, { useEffect, useState } from 'react';
import { Cloud, Eraser, RefreshCw, ScrollText } from 'lucide-react';
import {
  clearSyncLog,
  getSyncLog,
  subscribeSyncLog,
  type SyncLogEvent,
} from '../services/storage/syncLog';
import {
  enterTeamCloudSync,
  flushNow,
  getCloudSyncStatus,
  getPendingSyncBuckets,
  subscribeCloudSync,
} from '../services/storage/cloudSync';
import { useAccess } from '../access/AccessProvider';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

const LEVEL_CLASS: Record<SyncLogEvent['level'], string> = {
  info: 'text-slate-300',
  warn: 'text-amber-200',
  error: 'text-rose-300',
};

export const SyncLogList: React.FC<{ limit?: number }> = ({ limit }) => {
  const [events, setEvents] = useState(getSyncLog);

  useEffect(() => subscribeSyncLog(setEvents), []);

  const shown = limit ? events.slice(-limit).reverse() : [...events].reverse();

  if (shown.length === 0) {
    return (
      <p className="text-xs text-slate-500 py-2">
        No sync events yet. Saves and flushes will show up here.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5 max-h-72 overflow-y-auto font-mono text-[11px]">
      {shown.map((e) => (
        <li key={e.id} className="flex gap-2 items-start">
          <span className="text-slate-500 shrink-0 tabular-nums">
            {formatTime(e.at)}
          </span>
          <span className={`min-w-0 break-words ${LEVEL_CLASS[e.level]}`}>
            {e.message}
            {e.buckets && e.buckets.length > 0 ? (
              <span className="text-slate-500"> · {e.buckets.join(', ')}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
};

export const SyncLogActions: React.FC<{ compact?: boolean }> = ({
  compact = false,
}) => {
  const { activeTeamId } = useAccess();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const btn =
    'inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-200 font-semibold disabled:opacity-40 ' +
    (compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={busy || !activeTeamId}
        onClick={() => run(() => flushNow(activeTeamId ?? undefined))}
        className={btn}
      >
        <Cloud className="w-3 h-3" />
        Sync now
      </button>
      <button
        type="button"
        disabled={busy || !activeTeamId}
        onClick={() =>
          run(async () => {
            if (activeTeamId) await enterTeamCloudSync(activeTeamId);
          })
        }
        className={btn}
      >
        <RefreshCw className="w-3 h-3" />
        Retry hydrate
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => clearSyncLog()}
        className={btn}
      >
        <Eraser className="w-3 h-3" />
        Clear
      </button>
    </div>
  );
};

export const SyncLogPanel: React.FC = () => {
  const [sync, setSync] = useState(getCloudSyncStatus);
  const [pending, setPending] = useState(getPendingSyncBuckets);

  useEffect(
    () =>
      subscribeCloudSync(() => {
        setSync(getCloudSyncStatus());
        setPending(getPendingSyncBuckets());
      }),
    [],
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sky-300 font-semibold">
            <ScrollText className="w-4 h-4" />
            System sync log
          </div>
          <p className="text-xs text-slate-500 mt-1">
            JIT hydrate / flush history for this browser. Current:{' '}
            <span className="text-slate-300">{sync.status}</span>
            {sync.detail ? ` — ${sync.detail}` : ''}
            {pending.length > 0 ? ` · pending ${pending.join(', ')}` : ''}
          </p>
        </div>
        <SyncLogActions />
      </div>
      <SyncLogList />
    </section>
  );
};
