import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "../../components/ui/Button";

/**
 * A modal confirmation for a destructive action.
 *
 * Safe defaults: focus starts on Cancel, Escape cancels (unless the action is
 * running), Tab stays inside the dialog, and focus returns to the control
 * that opened it. Nothing happens until the confirm button is pressed.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  confirmDisabled = false,
  busy = false,
  busyLabel = "Deleting…",
  onConfirm,
  onCancel,
  cancelLabel = "Cancel",
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const ids = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  const cancelHandler = useRef(onCancel);
  // Keep the latest values for the document-level key handler.
  useEffect(() => {
    busyRef.current = busy;
    cancelHandler.current = onCancel;
  });

  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cancelRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) cancelHandler.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), a[href]",
        ),
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
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="observatory-dialog__backdrop">
      <div
        ref={dialogRef}
        className="observatory-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-body`}
      >
        <h2 id={`${ids}-title`}>{title}</h2>
        <div id={`${ids}-body`} className="observatory-dialog__body">
          {children}
        </div>
        <div className="observatory-dialog__actions">
          {/* Same look as <Button variant="secondary">, which takes no ref. */}
          <button
            ref={cancelRef}
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={confirmDisabled || busy}
            aria-busy={busy || undefined}
          >
            {busy ? busyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
