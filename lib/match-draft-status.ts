import type { MatchStatus } from "@/generated/prisma/client";

export function isMatchDraftCreationAllowed(
  _status: MatchStatus | null | undefined,
) {
  return true;
}

export function getMatchDraftCreationBlockedReason(
  _status: MatchStatus | null | undefined,
) {
  return null;
}