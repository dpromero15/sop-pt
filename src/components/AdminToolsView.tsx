import React, { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  CloudOff,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Upload,
  Download,
} from 'lucide-react';
import {
  adminSignIn,
  adminSignOut,
  initFirebase,
  isFirebaseConfigured,
  subscribeToAuth,
  type AuthState,
} from '../services/firebase';
import {
  checkConnectionStatus,
  setForceLocal,
} from '../services/storage/connectionStatus';
import type { ConnectionStatus } from '../services/storage/types';
import {
  bootstrapLocalToCloud,
  hydrateCloudToLocal,
} from '../services/storage';

interface AdminToolsViewProps {
  onRefreshData: () => void;
}

export const AdminToolsView: React.FC<AdminToolsViewProps> = ({ onRefreshData }) => {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    initFirebase();
    const next = await checkConnectionStatus();
    setStatus(next);
  }, []);

  useEffect(() => {
    initFirebase();
    const unsub = subscribeToAuth((state) => {
      setAuth(state);
      void refresh();
    });
    void refresh();
    return unsub;
  }, [refresh]);

  const run = async (fn: () => Promise<void>, okMsg: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage(okMsg);
      await refresh();
      onRefreshData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const badge =
    status?.mode === 'cloud'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sky-400">
            {status?.mode === 'cloud' ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
            <h2 className="text-sm font-semibold uppercase tracking-wide">Admin tools</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Firebase connection status, admin sign-in, and local ↔ cloud sync.
          </p>
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border ${badge}`}>
          {status?.mode ?? '…'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <StatusRow label="API configured" ok={status?.apiConfigured} />
        <StatusRow label="API healthy" ok={status?.apiHealthy} />
        <StatusRow label="Firestore reachable" ok={status?.firestoreReachable} />
        <StatusRow label="Firebase Auth configured" ok={isFirebaseConfigured()} />
        <StatusRow label="Signed in" ok={status?.signedIn} />
        <StatusRow label="Force local" ok={status?.forceLocal} invert />
      </div>

      <p className="text-xs text-slate-400 border border-slate-800 rounded-xl px-3 py-2 bg-slate-950/50">
        {status?.message ?? 'Checking connection…'}
        {auth?.email ? ` · ${auth.email}` : ''}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry connection
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setForceLocal(true);
            void refresh();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold border border-slate-700"
        >
          Use local only
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setForceLocal(false);
            void refresh();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold border border-slate-700"
        >
          Allow cloud
        </button>
      </div>

      {!auth?.signedIn ? (
        <form
          className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => adminSignIn(email, password), 'Signed in.');
          }}
        >
          <input
            type="email"
            required
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !isFirebaseConfigured()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-3 py-2 text-xs font-semibold"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
            Sign in
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => adminSignOut(), 'Signed out.')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold border border-slate-700"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !auth?.signedIn}
          onClick={() => void run(() => bootstrapLocalToCloud(), 'Local data uploaded to cloud.')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-xs font-semibold"
        >
          <Upload className="w-3.5 h-3.5" />
          Bootstrap local → cloud
        </button>
        <button
          type="button"
          disabled={busy || !auth?.signedIn}
          onClick={() =>
            void run(async () => {
              await hydrateCloudToLocal();
            }, 'Cloud snapshot loaded into local blobs.')
          }
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-2 text-xs font-semibold"
        >
          <Download className="w-3.5 h-3.5" />
          Hydrate cloud → local
        </button>
      </div>

      {!isFirebaseConfigured() && (
        <p className="text-xs text-amber-400">
          Set VITE_FIREBASE_* and VITE_API_BASE_URL in `.env.local` to enable cloud mode. See
          `.env.example`.
        </p>
      )}

      {message && (
        <p className="text-xs text-slate-200 border border-slate-700 rounded-lg px-3 py-2 bg-slate-950">
          {message}
        </p>
      )}
    </section>
  );
};

function StatusRow({
  label,
  ok,
  invert,
}: {
  label: string;
  ok: boolean | null | undefined;
  invert?: boolean;
}) {
  const tone =
    ok == null
      ? 'text-slate-500'
      : invert
        ? ok
          ? 'text-amber-400'
          : 'text-emerald-400'
        : ok
          ? 'text-emerald-400'
          : 'text-rose-400';
  const value = ok == null ? 'n/a' : ok ? 'yes' : 'no';
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  );
}
