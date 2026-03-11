import type { MatchStatus } from "@/generated/prisma/client";
import { getMatchDraftCreationBlockedReason } from "@/lib/match-draft-status";

export type RoundDraftPlacementStatus = "complete" | "empty" | "partial";

export function getRoundDraftCompletenessBlockedReason(
  placementStatus: RoundDraftPlacementStatus,
) {
  if (placementStatus === "complete") {
    return null;
  }

  return "Email drafts can only be created for businesses with complete matches in this round.";
}

export function getRoundEmailDraftBlockedReason(params: {
  matchStatus: MatchStatus | null | undefined;
  placementStatus: RoundDraftPlacementStatus;
}) {
  return (
    getRoundDraftCompletenessBlockedReason(params.placementStatus) ??
    getMatchDraftCreationBlockedReason(params.matchStatus)
  );
}