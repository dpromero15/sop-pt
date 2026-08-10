import React, { useState } from 'react';
import { Loader2, LogIn, Shield } from 'lucide-react';
import {
  adminSignIn,
  signInWithGoogle,
} from '../services/firebase';
import { initialAdminEmail } from '../utils/roles';

interface SignInGateProps {
  onSignedIn?: () => void;
}

export const SignInGate: React.FC<SignInGateProps> = ({ onSignedIn }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegacy, setShowLegacy] = useState(false);
  const [email, setEmail] = useState(initialAdminEmail());
  const [password, setPassword] = useState('');
  const hint = initialAdminEmail();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onSignedIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Sign in</h1>
            <p className="text-sm text-slate-400">
              Google account required for team access
            </p>
          </div>
        </div>

        {hint && (
          <p className="text-xs text-slate-500 border border-slate-800 rounded-xl px-3 py-2 bg-slate-950/60">
            Initial System Admin: <span className="text-slate-300">{hint}</span>{' '}
            (must also be listed in API <code>ADMIN_EMAIL_ALLOWLIST</code>).
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => signInWithGoogle())}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-slate-900 font-bold py-3 hover:bg-slate-100 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          Continue with Google
        </button>

        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-300 underline"
          onClick={() => setShowLegacy((v) => !v)}
        >
          {showLegacy ? 'Hide' : 'Use'} email/password (legacy)
        </button>

        {showLegacy && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => adminSignIn(email, password));
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Sign in
            </button>
          </form>
        )}

        {error && (
          <p className="text-sm text-rose-300 border border-rose-500/30 rounded-xl px-3 py-2 bg-rose-950/30">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
