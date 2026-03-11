"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RoundBatchStatus } from "@/generated/prisma/client";
import { ConfirmationDialog } from "@/components/confirmation-dialog";

type ConfirmationState = {
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
  title: string;
  tone: "danger" | "warning";
} | null;

type RoundBatchActionsProps = {
  canApply: boolean;
  canClear: boolean;
  canCreateRoundDraft: boolean;
  canDelete: boolean;
  roundBatchId: number | null;
  roundSequenceNumber: number | null;
  roundStatus: RoundBatchStatus | null;
};

export function RoundBatchActions({
  canApply,
  canClear,
  canCreateRoundDraft,
  canDelete,
  roundBatchId,
  roundSequenceNumber,
  roundStatus,
}: RoundBatchActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmationState, setConfirmationState] =
    useState<ConfirmationState>(null);

  function createRoundDraft() {
    startTransition(async () => {
      const response = await fetch("/api/rounds", {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as {
        batch?: {
          id: number;
          sequenceNumber: number;
        };
        error?: string;
        message?: string;
      } | null;

      if (!response.ok || !payload?.batch) {
        toast.error(
          payload?.error ?? "The round draft could not be created.",
        );
        return;
      }

      toast.success(payload.message ?? "Round draft created successfully.");
      router.push(`/rounds?batch=${payload.batch.sequenceNumber}`);
      router.refresh();
    });
  }

  function applyRoundDraft() {
    if (!roundBatchId) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/rounds/${roundBatchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "apply" }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "The round draft could not be applied.");
        return;
      }

      toast.success(
        payload?.message ??
          `Round ${roundSequenceNumber ?? "draft"} was applied successfully.`,
      );
      router.refresh();
    });
  }

  function clearRoundDraft() {
    if (!roundBatchId) {
      return;
    }

    setConfirmationState({
      confirmLabel: "Clear Draft",
      description:
        "This removes every directed assignment from the selected draft round, but keeps the batch so you can rebuild it immediately.",
      onConfirm: () => {
        setConfirmationState(null);
        startTransition(async () => {
          const response = await fetch(`/api/rounds/${roundBatchId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "clear" }),
          });

          const payload = (await response.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;

          if (!response.ok) {
            toast.error(
              payload?.error ?? "The round draft could not be cleared.",
            );
            return;
          }

          toast.success(payload?.message ?? "Round draft cleared.");
          router.refresh();
        });
      },
      title: `Clear round ${roundSequenceNumber ?? "draft"}?`,
      tone: "warning",
    });
  }

  function deleteRound() {
    if (!roundBatchId) {
      return;
    }

    const confirmationMessage =
      roundStatus === "applied"
        ? `Delete round ${roundSequenceNumber ?? ""}? This will remove the batch, its assignments, and every match linked to that round.`
        : `Delete round ${roundSequenceNumber ?? ""}? This will remove the batch, all assignments in it, and any linked matches.`;

    setConfirmationState({
      confirmLabel: "Delete Round",
      description: confirmationMessage,
      onConfirm: () => {
        setConfirmationState(null);
        startTransition(async () => {
          const response = await fetch(`/api/rounds/${roundBatchId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "delete" }),
          });

          const payload = (await response.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;

          if (!response.ok) {
            toast.error(payload?.error ?? "The round could not be deleted.");
            return;
          }

          toast.success(payload?.message ?? "Round deleted.");
          router.push("/rounds");
          router.refresh();
        });
      },
      title: `Delete round ${roundSequenceNumber ?? "draft"}?`,
      tone: "danger",
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending || !canCreateRoundDraft}
          onClick={createRoundDraft}
          title={
            canCreateRoundDraft
              ? "Create the next round draft"
              : "Apply or delete the latest draft round before creating a new one"
          }
          type="button"
        >
          {isPending ? "Creating round draft..." : "Create Round Draft"}
        </button>

        {canClear && roundBatchId ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#efb1a8] bg-[#fff0ec] px-5 py-3 text-sm font-semibold text-[#b55247] transition hover:-translate-y-0.5 hover:border-[#dd786b] hover:text-[#9f4037] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            onClick={clearRoundDraft}
            type="button"
          >
            {isPending ? "Clearing draft..." : "Clear Draft"}
          </button>
        ) : null}

        {canDelete && roundBatchId ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d98d8a] bg-[#fff5f4] px-5 py-3 text-sm font-semibold text-[#a93e39] transition hover:-translate-y-0.5 hover:border-[#bf5d57] hover:text-[#8f2e2a] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            onClick={deleteRound}
            type="button"
          >
            {isPending ? "Deleting round..." : "Delete Round"}
          </button>
        ) : null}

        {canApply && roundBatchId ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent/45"
            disabled={isPending}
            onClick={applyRoundDraft}
            type="button"
          >
            {isPending ? "Applying round..." : "Apply Round"}
          </button>
        ) : null}
      </div>

      <ConfirmationDialog
        confirmLabel={confirmationState?.confirmLabel}
        description={confirmationState?.description ?? ""}
        isBusy={isPending}
        isOpen={confirmationState !== null}
        onClose={() => setConfirmationState(null)}
        onConfirm={() => confirmationState?.onConfirm()}
        title={confirmationState?.title ?? "Confirm action"}
        tone={confirmationState?.tone ?? "danger"}
      />
    </>
  );
}
