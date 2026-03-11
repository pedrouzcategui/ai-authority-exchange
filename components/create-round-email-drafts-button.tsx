"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MatchStatus } from "@/generated/prisma/client";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import {
  getRoundEmailDraftBlockedReason,
  type RoundDraftPlacementStatus,
} from "@/lib/round-email-draft-eligibility";

type RoundDraftAssignmentPair = {
  guestBusinessId: number;
  guestBusinessName: string;
  hostBusinessId: number;
  hostBusinessName: string;
  hostPlacementStatus: RoundDraftPlacementStatus;
  matchStatus: MatchStatus | null;
};

type CreateRoundEmailDraftsButtonProps = {
  assignments: RoundDraftAssignmentPair[];
  roundBatchId: number;
  roundSequenceNumber: number | null;
};

export function CreateRoundEmailDraftsButton({
  assignments,
  roundBatchId,
  roundSequenceNumber,
}: CreateRoundEmailDraftsButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const eligibleAssignments = assignments.filter(
    (assignment) =>
      getRoundEmailDraftBlockedReason({
        matchStatus: assignment.matchStatus,
        placementStatus: assignment.hostPlacementStatus,
      }) === null,
  );
  const skippedAssignmentCount = assignments.length - eligibleAssignments.length;

  function getSkippedSummary() {
    if (skippedAssignmentCount === 0) {
      return "";
    }

    return ` ${skippedAssignmentCount} match${skippedAssignmentCount === 1 ? " was" : "es were"} skipped because the business is incomplete or the status is not Not Started.`;
  }

  function openConfirmation() {
    if (isPending || eligibleAssignments.length === 0) {
      return;
    }

    setIsConfirmationOpen(true);
  }

  function closeConfirmation() {
    if (isPending) {
      return;
    }

    setIsConfirmationOpen(false);
  }

  function createDrafts() {
    setIsConfirmationOpen(false);

    startTransition(async () => {
      let createdCount = 0;
      const failedPairs: string[] = [];

      for (const assignment of eligibleAssignments) {
        const response = await fetch("/api/email-drafts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            guestId: assignment.guestBusinessId,
            hostId: assignment.hostBusinessId,
            roundBatchId,
          }),
        });

        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;

        if (response.ok) {
          createdCount += 1;
          toast.success(
            payload?.message ??
              `Email draft created for ${assignment.hostBusinessName} and ${assignment.guestBusinessName}. Match status updated to Draft Created.`,
          );
          continue;
        }

        failedPairs.push(
          `${assignment.hostBusinessName} -> ${assignment.guestBusinessName}${payload?.error ? ` (${payload.error})` : ""}`,
        );
      }

      if (createdCount > 0) {
        router.refresh();
      }

      if (failedPairs.length > 0) {
        toast.error(
          createdCount > 0
            ? `${failedPairs.length} draft${failedPairs.length === 1 ? "" : "s"} failed for round ${roundSequenceNumber ?? "selected"}.${getSkippedSummary()} Failed pairs: ${failedPairs.join("; ")}.`
            : `No drafts were created for round ${roundSequenceNumber ?? "selected"}.${getSkippedSummary()} Failed pairs: ${failedPairs.join("; ")}.`,
        );
        return;
      }

      if (skippedAssignmentCount > 0) {
        toast.success(
          `Finished round ${roundSequenceNumber ?? "selected"}.${getSkippedSummary()}`,
        );
      }
    });
  }

  return (
    <>
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending || eligibleAssignments.length === 0}
        onClick={openConfirmation}
        title={
          eligibleAssignments.length === 0
            ? "Email drafts can only be created for businesses with complete matches that are still marked Not Started."
            : undefined
        }
        type="button"
      >
        {isPending ? "Creating drafts..." : "Create All Email Drafts"}
      </button>

      <ConfirmationDialog
        cancelLabel="Keep Reviewing"
        confirmLabel="Create Drafts"
        description={`This will create Gmail drafts for ${eligibleAssignments.length} applied match${eligibleAssignments.length === 1 ? "" : "es"} in round ${roundSequenceNumber ?? "selected"}. ${skippedAssignmentCount === 0 ? "You can review and send them from Gmail afterward." : `${skippedAssignmentCount} ${skippedAssignmentCount === 1 ? "match will" : "matches will"} be skipped because the business is incomplete or the status is no longer Not Started.`}`}
        isBusy={isPending}
        isOpen={isConfirmationOpen}
        onClose={closeConfirmation}
        onConfirm={createDrafts}
        title={`Create drafts for round ${roundSequenceNumber ?? "selected"}?`}
        tone="warning"
      />
    </>
  );
}