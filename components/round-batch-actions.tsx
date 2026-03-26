"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RoundBatchStatus } from "@/generated/prisma/client";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import {
  getRoundEditorBusySnapshot,
  subscribeToRoundEditorBusy,
} from "@/lib/rounds-editor-busy";

type RoundApplyConflict = {
  assignmentId: number;
  existingGuestBusiness: string;
  existingHostBusiness: string;
  existingMatchId: number;
  existingRoundSequenceNumber: number | null;
  guestBusiness: string;
  hostBusiness: string;
};

type ConfirmationState = {
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
  title: string;
  tone: "danger" | "warning";
} | null;

type ApplyConflictState = {
  conflicts: RoundApplyConflict[];
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
  const [applyConflictState, setApplyConflictState] =
    useState<ApplyConflictState>(null);
  const roundEditorBusy = useSyncExternalStore(
    subscribeToRoundEditorBusy,
    getRoundEditorBusySnapshot,
    () => false,
  );
  const applyButtonDisabled = isPending || roundEditorBusy;

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
        toast.error(payload?.error ?? "The round draft could not be created.");
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
      setApplyConflictState(null);

      const response = await fetch(`/api/rounds/${roundBatchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "apply" }),
      });

      const payload = (await response.json().catch(() => null)) as {
        conflicts?: RoundApplyConflict[];
        error?: string;
        errorCode?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        if (
          payload?.errorCode === "ROUND_APPLY_MATCH_CONFLICT" &&
          payload.conflicts &&
          payload.conflicts.length > 0
        ) {
          setApplyConflictState({
            conflicts: payload.conflicts,
          });
        }

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
            disabled={applyButtonDisabled}
            onClick={applyRoundDraft}
            title={
              roundEditorBusy
                ? "Wait for round edits to finish saving before applying this round"
                : undefined
            }
            type="button"
          >
            {isPending
              ? "Applying round..."
              : roundEditorBusy
                ? "Waiting For Saves..."
                : "Apply Round"}
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

      <ConfirmationDialog
        cancelLabel="Close"
        confirmLabel="Refresh"
        description="These draft assignments already exist in the match history, so the round cannot be applied until they are changed or removed."
        details={
          applyConflictState ? (
            <div className="space-y-3">
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-3xl border border-border bg-white/78 p-3">
                {applyConflictState.conflicts.map((conflict) => (
                  <div
                    className="rounded-2xl border border-border/80 bg-surface px-4 py-3"
                    key={`${conflict.assignmentId}-${conflict.existingMatchId}`}
                  >
                    <p className="text-sm font-semibold text-foreground sm:text-base">
                      {conflict.hostBusiness} -&gt; {conflict.guestBusiness}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      Already matched as {conflict.existingHostBusiness} -&gt;{" "}
                      {conflict.existingGuestBusiness}
                      {conflict.existingRoundSequenceNumber === null
                        ? "."
                        : ` in round ${conflict.existingRoundSequenceNumber}.`}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-6 text-muted">
                {applyConflictState.conflicts.length} conflicting match
                {applyConflictState.conflicts.length === 1 ? "" : "es"} found.
              </p>
            </div>
          ) : null
        }
        isBusy={isPending}
        isOpen={applyConflictState !== null}
        onClose={() => setApplyConflictState(null)}
        onConfirm={() => {
          setApplyConflictState(null);
          router.refresh();
        }}
        title={`Round ${roundSequenceNumber ?? "draft"} has repeated matches`}
        tone="warning"
      />
    </>
  );
}
