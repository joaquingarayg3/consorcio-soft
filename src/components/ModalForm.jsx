import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

const springTransition = { type: "spring", duration: 0.4, bounce: 0.15 };

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ModalFormButton({ loading, label, loadingLabel }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="relative flex h-11 w-full items-center justify-center overflow-hidden rounded-lg bg-amber-700 text-base font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900 disabled:cursor-not-allowed disabled:bg-amber-400"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {loading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="flex items-center gap-2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4 animate-spin"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
              />
            </svg>
            {loadingLabel}
          </motion.span>
        ) : (
          <motion.span
            key="label"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// Ventana superpuesta para todo lo que sea "agregar algo nuevo". Se cierra con
// la ×, Escape o tocando afuera (salvo mientras se está guardando, `busy`).
export default function ModalForm({
  open,
  onClose,
  busy = false,
  title,
  description,
  success = false,
  successTitle,
  successMessage,
  children,
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const latest = useRef({ onClose, busy });

  useEffect(() => {
    latest.current = { onClose, busy };
  });

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (!latest.current.busy) latest.current.onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusables = [...panelRef.current.querySelectorAll(FOCUSABLE)];
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 px-4 py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={success ? undefined : titleId}
            aria-label={success ? successTitle : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={springTransition}
            className="max-h-[calc(100dvh-3rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl focus:outline-none"
          >
            <AnimatePresence mode="wait" initial={false}>
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={springTransition}
                  role="status"
                  className="flex flex-col items-center py-6 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ ...springTransition, delay: 0.1 }}
                    aria-hidden="true"
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-6 w-6"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </motion.div>
                  <p className="font-semibold text-stone-900">{successTitle}</p>
                  <p className="mt-1 text-sm text-stone-500">
                    {successMessage}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2
                        id={titleId}
                        className="text-xl font-semibold text-stone-900"
                      >
                        {title}
                      </h2>
                      {description && (
                        <p className="mt-1 text-sm text-stone-500">
                          {description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onClose}
                      aria-label="Cerrar"
                      className="rounded-lg px-2 py-1 text-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-5">{children}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
