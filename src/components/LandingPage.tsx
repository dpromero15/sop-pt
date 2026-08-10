import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  isDevAuthSimulationEnabled,
  isFirebaseConfigured,
  signInWithGoogle,
  simulateGoogleSignIn,
} from '../services/firebase';

interface LandingPageProps {
  onSignedIn?: () => void;
}

/**
 * Public landing for Systems of Play — SOP-PT (Player Tracker).
 * Brand-first hero with Google sign-in as the sole CTA.
 */
export const LandingPage: React.FC<LandingPageProps> = ({ onSignedIn }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const simEnabled = isDevAuthSimulationEnabled();
  // Real Google OAuth on http://localhost fights the https authDomain iframe — skip when simulating.
  const canRealGoogle = isFirebaseConfigured() && !simEnabled;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onSignedIn?.();
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code ?? '')
          : '';
      if (code === 'auth/popup-blocked') {
        setError(
          'Google sign-in popup was blocked. Allow pop-ups for this site and try again.',
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Sign-in window was closed before finishing. Try again.');
      } else if (code === 'auth/cancelled-popup-request') {
        setError('Another sign-in popup was already open. Close it and retry.');
      } else {
        setError(err instanceof Error ? err.message : 'Sign-in failed');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden text-slate-100">
      {/* Full-bleed pitch atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(165deg, #04150f 0%, #0a1f18 38%, #071018 72%, #020617 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(16,185,129,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.07) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 75%)',
        }}
      />
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[90vw] max-w-4xl h-[42vh] rounded-full blur-3xl opacity-40 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(16,185,129,0.45), transparent 70%)',
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="px-6 pt-8 sm:px-10 sm:pt-10">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-2.5 min-w-0">
              <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                SOP
              </span>
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400/90 truncate">
                Systems of Play
              </span>
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 tracking-wide shrink-0">
              Player Tracker
            </span>
          </div>
        </header>

        <main className="flex-1 flex items-center px-6 py-16 sm:px-10">
          <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-center">
            <div className="space-y-8 max-w-xl">
              <p className="text-emerald-400/90 text-xs font-semibold uppercase tracking-[0.28em]">
                SOP-PT
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.35rem] font-bold leading-[1.08] text-white tracking-tight">
                Systems of Play
                <span className="block text-emerald-300/95 mt-1">
                  Player Tracker
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-md">
                The performance workspace for competitive squads — roster,
                sessions, rankings, and coach insight in one System of Play
                product.
              </p>
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {canRealGoogle && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => signInWithGoogle())}
                      className="inline-flex items-center justify-center gap-3 rounded-xl bg-white text-slate-950 font-semibold px-6 py-3.5 hover:bg-emerald-50 disabled:opacity-50 transition-colors shadow-lg shadow-black/30"
                    >
                      {busy ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <GoogleMark />
                      )}
                      Sign in with Google
                    </button>
                  )}
                  {/* `import.meta.env.DEV` is compile-false in production — Vite strips this branch. */}
                  {import.meta.env.DEV && simEnabled ? (
                    <div className="flex flex-col gap-3 w-full sm:w-auto">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() => simulateGoogleSignIn('systemAdmin'))
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-100 font-semibold px-5 py-3.5 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                      >
                        {busy ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : null}
                        Continue as System Admin (simulated)
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            simulateGoogleSignIn('emptyRosterCoach'),
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-100 font-semibold px-5 py-3.5 hover:bg-sky-500/20 disabled:opacity-50 transition-colors"
                      >
                        {busy ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : null}
                        Continue as coach (empty roster)
                      </button>
                    </div>
                  ) : null}
                  {import.meta.env.DEV && !canRealGoogle && !simEnabled ? (
                    <p className="text-sm text-amber-200/90">
                      Configure Firebase or set{' '}
                      <code className="text-amber-100">VITE_DEV_SIMULATE_AUTH=true</code>{' '}
                      in <code className="text-amber-100">.env.local</code> for local QA.
                    </p>
                  ) : null}
                  {!import.meta.env.DEV && !canRealGoogle ? (
                    <p className="text-sm text-amber-200/90">
                      Google sign-in is unavailable. Contact your Systems of Play admin.
                    </p>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500 max-w-sm leading-snug">
                  {import.meta.env.DEV && simEnabled
                    ? 'Local debug only — System Admin (mock teams) or coach with an empty roster. Not shipped to production.'
                    : 'Secure Google authentication required. You’ll choose a team after sign-in.'}
                </p>
              </div>
              {error && (
                <p className="text-sm text-rose-300 border border-rose-500/30 rounded-xl px-3 py-2 bg-rose-950/40 max-w-md">
                  {error}
                </p>
              )}
            </div>

            <aside
              className="relative hidden lg:block"
              aria-hidden
            >
              <div className="aspect-[4/5] rounded-[2rem] border border-emerald-500/20 bg-gradient-to-b from-emerald-950/80 to-slate-950/90 overflow-hidden shadow-2xl shadow-emerald-950/50">
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      'linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)',
                    backgroundSize: '32px 32px',
                  }}
                />
                <div className="absolute inset-6 border border-white/10 rounded-[1.5rem]" />
                <div className="absolute inset-x-[18%] top-[12%] bottom-[12%] border-x border-dashed border-emerald-400/25" />
                <div className="absolute left-[18%] right-[18%] top-1/2 h-px bg-emerald-400/30" />
                <div className="absolute left-1/2 top-[12%] bottom-[12%] w-px bg-emerald-400/20" />
                <div className="absolute inset-0 flex flex-col justify-end p-8 space-y-2">
                  <p className="font-display text-2xl text-white font-semibold">
                    Clarity on every player.
                  </p>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Rankings, attendance, and coach ratings — built for how
                    Systems of Play runs the pitch.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </main>

        <footer className="px-6 pb-8 sm:px-10">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600">
            <span>© {new Date().getFullYear()} Systems of Play</span>
            <span>SOP-PT is a Systems of Play product</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

function GoogleMark() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export const AuthConfigMissing: React.FC = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
    <div className="max-w-lg rounded-2xl border border-amber-500/40 bg-slate-900 p-8 space-y-4 shadow-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400/90">
        Systems of Play · SOP-PT
      </p>
      <h1 className="font-display text-2xl font-bold text-amber-100">
        Firebase Auth is not configured
      </h1>
      <p className="text-sm text-slate-400 leading-relaxed">
        This Hosting build was shipped without <code className="text-slate-300">VITE_FIREBASE_*</code>{' '}
        values, so Google sign-in cannot start. Add those secrets in GitHub Actions (or deploy
        locally with <code className="text-slate-300">.env.firebase</code>), then redeploy.
      </p>
      <ol className="text-sm text-slate-400 list-decimal pl-5 space-y-1.5">
        <li>
          Repo → Settings → Secrets → Actions → set{' '}
          <code className="text-slate-300">VITE_FIREBASE_API_KEY</code>,{' '}
          <code className="text-slate-300">AUTH_DOMAIN</code>,{' '}
          <code className="text-slate-300">PROJECT_ID</code>,{' '}
          <code className="text-slate-300">APP_ID</code>
        </li>
        <li>
          Or run <code className="text-slate-300">npm run deploy:hosting</code> from a machine
          with <code className="text-slate-300">.env.firebase</code> filled in
        </li>
      </ol>
      {import.meta.env.DEV ? (
        <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-800 pt-3">
          Local QA: set <code className="text-slate-400">VITE_DEV_SIMULATE_AUTH=true</code> in{' '}
          <code className="text-slate-400">.env.local</code> and use{' '}
          <code className="text-slate-400">npm run dev</code>.
        </p>
      ) : null}
    </div>
  </div>
);
