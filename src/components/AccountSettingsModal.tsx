import React from 'react';
import { X } from 'lucide-react';
import { useAccess } from '../access/AccessProvider';

interface AccountSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onOpenAdmin?: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  open,
  onClose,
  onOpenAdmin,
}) => {
  const { auth, roleLabel, can, clearWorkspace, signOut } = useAccess();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="account-settings-title"
        className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="account-settings-title"
              className="font-display text-lg font-bold text-white"
            >
              Settings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Account & workspace</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
          {auth.photoURL ? (
            <img
              src={auth.photoURL}
              alt=""
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold">
              {(auth.displayName || auth.email || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {auth.displayName || 'User'}
            </p>
            <p className="text-xs text-slate-500 truncate">{auth.email}</p>
            <p className="text-[10px] uppercase tracking-wider text-emerald-400 mt-1 font-semibold">
              {roleLabel}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            className="w-full text-left rounded-xl border border-slate-800 hover:border-slate-700 px-3 py-2.5 text-sm text-slate-200"
            onClick={() => {
              clearWorkspace();
              onClose();
            }}
          >
            Switch team…
          </button>
          {can('adminPage') && (
            <button
              type="button"
              className="w-full text-left rounded-xl border border-slate-800 hover:border-slate-700 px-3 py-2.5 text-sm text-slate-200"
              onClick={() => {
                onOpenAdmin?.();
                onClose();
              }}
            >
              Open Admin
            </button>
          )}
          <button
            type="button"
            className="w-full text-left rounded-xl border border-rose-500/20 hover:bg-rose-950/30 px-3 py-2.5 text-sm text-rose-300"
            onClick={() => {
              void signOut();
              onClose();
            }}
          >
            Sign out
          </button>
        </div>

        <p className="text-[11px] text-slate-600 leading-relaxed">
          SOP-PT is a Systems of Play product (System of Play · Player Tracker).
        </p>
      </div>
    </div>
  );
};
