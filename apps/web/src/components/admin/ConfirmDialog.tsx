'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  /** When true, the note textarea must be non-empty before confirming (e.g. a rejection reason). */
  noteRequired?: boolean;
  noteLabel?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  isSubmitting?: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible confirmation dialog with an optional note field.
 * Traps focus within the dialog, closes on Escape, and restores focus to
 * the element that opened it.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  noteRequired,
  noteLabel,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  isSubmitting,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descId = useId();
  const noteId = useId();
  const [note, setNote] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    setNote('');

    const dialogEl = dialogRef.current;
    const focusFirst = () => {
      const focusable = dialogEl?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable && focusable[0] ? focusable[0] : dialogEl)?.focus();
    };
    // Defer so the dialog is in the DOM before we try to focus it.
    const raf = requestAnimationFrame(focusFirst);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialogEl) return;
      const focusable = Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  const noteMissing = !!noteRequired && note.trim().length === 0;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onCancel} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-elev-2 outline-none"
        >
          <h2 id={titleId} className="text-lg font-bold text-foreground">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="mt-1.5 text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}

          <div className="mt-4">
            <label htmlFor={noteId} className="mb-1.5 block text-[13px] font-medium text-foreground">
              {noteLabel ?? t('adminReviewNoteLabel')}
              {noteRequired ? (
                <span className="ms-0.5 text-danger" aria-hidden>
                  *
                </span>
              ) : (
                <span className="ms-1 text-muted-foreground">({t('optionalLabel')})</span>
              )}
            </label>
            <textarea
              id={noteId}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={500}
              required={noteRequired}
              className="w-full rounded-[10px] border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </div>

          <div className="mt-6 flex gap-2">
            <Button variant="secondary" onClick={onCancel} className="flex-1" disabled={isSubmitting}>
              {cancelLabel ?? t('cancel')}
            </Button>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => onConfirm(note.trim())}
              className="flex-1"
              disabled={noteMissing || isSubmitting}
              isLoading={isSubmitting}
            >
              {!isSubmitting && tone === 'danger' ? <Icon name="warning" size={16} /> : null}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
