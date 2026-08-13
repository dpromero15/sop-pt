import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { flushNow } from '../services/storage/cloudSync';

interface SaveAndSyncButtonProps {
  label?: string;
  /** Extra work before flush (e.g. persist a draft). */
  beforeFlush?: () => void;
  onSaved?: () => void;
  className?: string;
  compact?: boolean;
}

/** Explicit Save that flushes JIT immediately instead of waiting on the 10s debounce. */
export const SaveAndSyncButton: React.FC<SaveAndSyncButtonProps> = ({
  label = 'Save',
  beforeFlush,
  onSaved,
  className,
  compact = false,
}) => {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      beforeFlush?.();
      await flushNow();
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      title="Save and push to cloud now (do not wait for JIT)"
      onClick={() => {
        void handleClick();
      }}
      className={
        className ??
        (compact
          ? 'inline-flex items-center gap-1.5 rounded-lg border border-sky-700/50 bg-slate-950 hover:bg-slate-800 text-sky-200 text-xs font-semibold px-2.5 py-1.5 disabled:opacity-50'
          : 'inline-flex items-center gap-1.5 rounded-xl border border-sky-600/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-sm font-semibold px-3.5 py-2.5 disabled:opacity-50')
      }
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Check className="w-4 h-4" />
      )}
      {busy ? 'Saving…' : label}
    </button>
  );
};
