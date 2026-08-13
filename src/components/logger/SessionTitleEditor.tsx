import React, { useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';

interface SessionTitleEditorProps {
  title: string;
  readOnly?: boolean;
  onSave: (title: string) => void;
  /** Display size for the title when not editing. */
  size?: 'sm' | 'lg';
}

export const SessionTitleEditor: React.FC<SessionTitleEditorProps> = ({
  title,
  readOnly = false,
  onSave,
  size = 'lg',
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  const cancel = () => {
    setDraft(title);
    setEditing(false);
  };

  const commit = () => {
    const next = draft.trim();
    if (!next) {
      cancel();
      return;
    }
    if (next !== title) onSave(next);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        {size === 'lg' ? (
          <h3 className="min-w-0 truncate text-xl font-extrabold text-white">
            {title}
          </h3>
        ) : (
          <p className="min-w-0 truncate text-sm font-bold text-slate-50">
            {title}
          </p>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Rename session"
            title="Rename session"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      className="flex min-w-0 items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        className={`min-w-0 flex-1 rounded-lg border border-purple-500/50 bg-slate-950 px-2 py-1 text-white focus:outline-none ${
          size === 'lg' ? 'text-base font-semibold' : 'text-sm font-semibold'
        }`}
        aria-label="Session name"
        maxLength={120}
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg p-1 text-emerald-400 hover:bg-slate-800"
        aria-label="Save name"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={cancel}
        className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-800"
        aria-label="Cancel rename"
      >
        <X className="h-4 w-4" />
      </button>
    </form>
  );
};
