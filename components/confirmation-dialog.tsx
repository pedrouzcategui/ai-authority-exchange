"use client";

import { useEffect } from "react";

type ConfirmationDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  isBusy?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  tone?: "danger" | "warning";
};

function getConfirmButtonClassName(tone: "danger" | "warning") {
  return tone === "danger"
    ? "bg-[#a93e39] text-white hover:bg-[#8f2e2a] disabled:bg-[#a93e39]/45"
    : "bg-accent text-white hover:bg-accent-strong disabled:bg-accent/45";
}

function getToneAccentClassName(tone: "danger" | "warning") {
  return tone === "danger"
    ? "bg-[#fff1f0] text-[#a93e39]"
    : "bg-accent-soft text-accent-strong";
}

export function ConfirmationDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  description,
  isBusy = false,
  isOpen,
  onClose,
  onConfirm,
  title,
  tone = "danger",
}: ConfirmationDialogProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBusy, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-labelledby="confirmation-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-deep/24 px-4 py-6 backdrop-blur-sm"
      onClick={isBusy ? undefined : onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-xl rounded-4xl border border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,248,251,0.98))] p-6 shadow-[0_32px_90px_rgba(36,53,71,0.26)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${getToneAccentClassName(tone)}`}
          >
            !
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <h2
              className="text-xl font-semibold tracking-tight text-foreground"
              id="confirmation-dialog-title"
            >
              {title}
            </h2>
            <p className="text-sm leading-7 text-muted sm:text-base">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            autoFocus
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/88 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed ${getConfirmButtonClassName(tone)}`}
            disabled={isBusy}
            onClick={onConfirm}
            type="button"
          >
            {isBusy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}