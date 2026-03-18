"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { BusinessContactFormState } from "@/lib/business-contact-form";

type BusinessContactDialogProps = {
  description?: string;
  extraFields?: ReactNode;
  footerNote?: string;
  isBusy?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onFieldChange: (
    field: "email" | "firstName" | "lastName",
    value: string,
  ) => void;
  onSave: () => void;
  roleLabel: string;
  saveLabel?: string;
  state: BusinessContactFormState;
  warningMessage?: string | null;
};

export function BusinessContactDialog({
  description,
  extraFields,
  footerNote,
  isBusy = false,
  isOpen,
  onClose,
  onFieldChange,
  onSave,
  roleLabel,
  saveLabel,
  state,
  warningMessage,
}: BusinessContactDialogProps) {
  const portalTarget = typeof document === "undefined" ? null : document.body;

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

  if (!isOpen || !portalTarget) {
    return null;
  }

  const isEditingExistingContact = state.mode === "existing";

  return createPortal(
    <div
      aria-labelledby="business-contact-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-60 flex items-center justify-center bg-[rgba(51,71,91,0.42)] px-4 py-8 backdrop-blur-sm"
      onClick={isBusy ? undefined : onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-xl rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
              {isEditingExistingContact
                ? `Edit ${roleLabel}`
                : `Create ${roleLabel}`}
            </p>
            <h2
              className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
              id="business-contact-dialog-title"
            >
              {isEditingExistingContact
                ? `Update the ${roleLabel.toLocaleLowerCase()} contact`
                : `Add a new ${roleLabel.toLocaleLowerCase()} contact`}
            </h2>
            <p className="max-w-xl text-sm leading-7 text-muted sm:text-base">
              {description ??
                `Save the ${roleLabel.toLocaleLowerCase()} information here, then return to the business modal to finish the business update.`}
            </p>
          </div>

          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-8 space-y-6">
          {extraFields}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                First name
              </span>
              <input
                className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                disabled={isBusy}
                onChange={(event) =>
                  onFieldChange("firstName", event.target.value)
                }
                placeholder={`${roleLabel} first name`}
                type="text"
                value={state.firstName}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Last name (optional)
              </span>
              <input
                className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                disabled={isBusy}
                onChange={(event) =>
                  onFieldChange("lastName", event.target.value)
                }
                placeholder={`${roleLabel} last name`}
                type="text"
                value={state.lastName}
              />
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Email (optional)
            </span>
            <input
              className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              disabled={isBusy}
              inputMode="email"
              onChange={(event) => onFieldChange("email", event.target.value)}
              placeholder={`${roleLabel} email`}
              type="email"
              value={state.email}
            />
          </label>

          {warningMessage ? (
            <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-950">
              {warningMessage}
            </div>
          ) : null}

          <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-7 text-muted">
              {footerNote ??
                "This only stages the contact inside the business editor. The contact is written when you save the main business modal."}
            </p>

            <button
              className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent/45"
              disabled={isBusy}
              onClick={onSave}
              type="button"
            >
              {isBusy
                ? "Saving..."
                : (saveLabel ??
                  (isEditingExistingContact
                    ? `Save ${roleLabel}`
                    : `Create ${roleLabel}`))}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
