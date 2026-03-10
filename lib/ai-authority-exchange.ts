export type ExchangeParticipationStatus =
  | "not-participating"
  | "active"
  | "retired";

type ExchangeLifecycleRecord = {
  aiAuthorityExchangeJoinedAt?: Date | null;
  aiAuthorityExchangeRetiredAt?: Date | null;
  isActiveOnAiAuthorityExchange?: boolean | null;
};

export function getExchangeParticipationStatus(
  record: ExchangeLifecycleRecord,
): ExchangeParticipationStatus {
  if (record.aiAuthorityExchangeRetiredAt) {
    return "retired";
  }

  if (
    record.aiAuthorityExchangeJoinedAt ||
    record.isActiveOnAiAuthorityExchange === true
  ) {
    return "active";
  }

  return "not-participating";
}

export function isExchangeParticipationActive(
  record: ExchangeLifecycleRecord,
) {
  return getExchangeParticipationStatus(record) === "active";
}