import type { MatchStatus } from "@/generated/prisma/client";

export const allowedMatchDraftStatus: MatchStatus = "Not_Started";

function getMatchStatusLabel(status: MatchStatus | null | undefined) {
  switch (status) {
    case "Draft_Created":
      return "Draft Created";
    case "In_Progress":
      return "In Progress";
    case "Done":
      return "Done";
    case "Leaving":
      return "Leaving";
    case "Partner_Leaving":
      return "Partner Leaving";
    case "Not_Started":
    case null:
    case undefined:
    default:
      return "Not Started";
  }
}

export function isMatchDraftCreationAllowed(
  status: MatchStatus | null | undefined,
) {
  return status === null || status === undefined || status === allowedMatchDraftStatus;
}

export function getMatchDraftCreationBlockedReason(
  status: MatchStatus | null | undefined,
) {
  if (isMatchDraftCreationAllowed(status)) {
    return null;
  }

  return `Email drafts can only be created for matches marked Not Started. Current status: ${getMatchStatusLabel(status)}.`;
}