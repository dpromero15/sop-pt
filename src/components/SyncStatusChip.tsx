import React, { useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import {
  flushNow,
  getCloudSyncStatus,
  subscribeCloudSync,
  type SyncUiStatus,
} from '../services/storage/cloudSync';
import { useAccess } from '../access/AccessProvider';
import { SyncLogActions, SyncLogList } from './SyncLogPanel';

const LABEL: Record<SyncUiStatus, string> = {
  'local-only': 'Local',
  offline: 'Offline',
  hydrating: 'Loading…',
  pending: 'Pending',
  syncing: 'Syncing…',
  synced: 'Synced',
  error: 'Sync error',
};

export const SyncStatusChip: React.FC = () => {
  const { can } = useAccess();
  const [state, setState] = useState(getCloudSyncStatus());
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribeCloudSync((status, detail) => {
        setState({ status, detail });
      }),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!can('cloudSync') && state.status === 'local-only') return null;

  const retryable =
    state.status === 'pending' ||
    state.status === 'error' ||
    state.status === 'offline';
  const chipText =
    state.status === 'pending' && state.detail === 'Retrying…'
      ? 'Retrying…'
      : LABEL[state.status];
  const tone =
    state.status === 'synced'
      ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
      : state.status === 'error'
        ? 'border-rose-500/40 text-rose-200 bg-rose-950/40'
        : state.status === 'offline' || state.status === 'local-only'
          ? 'border-slate-700 text-slate-400 bg-slate-900/70'
          : 'border-amber-500/30 text-amber-100 bg-amber-500/10';

  const Icon =
    state.status === 'hydrating' || state.status === 'syncing'
      ? Loader2
      : state.status === 'offline' || state.status === 'local-only'
        ? CloudOff
        : Cloud;

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
      >
        <button
          type="button"
          title={chipText}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1"
        >
          <Icon
            className={`w-3 h-3 ${
              state.status === 'hydrating' || state.status === 'syncing'
                ? 'animate-spin'
                : ''
            }`}
          />
          <span className="max-w-[9rem] truncate">{chipText}</span>
        </button>
        {retryable ? (
          <button
            type="button"
            title="Retry sync now"
            aria-label="Retry sync now"
            onClick={() => {
              void flushNow();
            }}
            className="p-0.5 rounded-full hover:bg-white/10"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        ) : null}
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-100">System log</p>
            <SyncLogActions compact />
          </div>
          {state.detail && (
            <p className="text-[11px] text-rose-200/90 break-words">
              {state.detail}
            </p>
          )}
          <SyncLogList limit={12} />
        </div>
      )}
    </div>
  );
};
