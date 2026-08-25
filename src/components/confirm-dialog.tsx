'use client';

import { useEffect, useRef } from 'react';

export interface ConfirmDialogProps {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** null hides the cancel button (informational dialog). */
  cancelLabel?: string | null;
  danger?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}

/**
 * In-app confirmation dialog. Native confirm()/alert() are suppressed in
 * installed PWAs on iOS, so every destructive action goes through this.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      data-testid="confirm-dialog"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">{title}</h2>
        {message && <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          {cancelLabel !== null && (
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            className={[
              'rounded-lg px-4 py-2 text-sm font-medium text-white',
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--ink)] !text-[var(--bg)] hover:opacity-90',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
