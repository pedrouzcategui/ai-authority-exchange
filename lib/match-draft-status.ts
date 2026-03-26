import type { MatchStatus } from "@/generated/prisma/client";

export function isMatchDraftCreationAllowed(
  status: MatchStatus | null | undefined,
) {
  void status;
  return true;
}

export function getMatchDraftCreationBlockedReason(
  status: MatchStatus | null | undefined,
) {
  void status;
  return null;
}