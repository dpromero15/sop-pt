import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import {
  enterTeamCloudSync,
  getCloudSyncStatus,
  subscribeCloudSync,
  type SyncUiStatus,
} from '../services/storage/cloudSync';
import { useAccess } from '../access/AccessProvider';

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
  const { activeTeamId, can } = useAccess();
  const [state, setState] = useState(getCloudSyncStatus());

  useEffect(() => subscribeCloudSync((status, detail) => {
    setState({ status, detail });
  }), []);

  if (!can('cloudSync') && state.status === 'local-only') return null;

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
    <button
      type="button"
      title={state.detail || LABEL[state.status]}
      onClick={() => {
        if (activeTeamId) void enterTeamCloudSync(activeTeamId);
      }}
      className={`hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      <Icon
        className={`w-3 h-3 ${
          state.status === 'hydrating' || state.status === 'syncing'
            ? 'animate-spin'
            : ''
        }`}
      />
      {LABEL[state.status]}
      {state.status === 'error' ? <RefreshCw className="w-3 h-3" /> : null}
    </button>
  );
};
