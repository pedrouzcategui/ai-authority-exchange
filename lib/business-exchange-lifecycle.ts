import type { ExchangeParticipationStatus } from "@/lib/ai-authority-exchange";

export function buildExchangeLifecycleFields(params: {
  currentJoinedAt?: Date | null;
  retiredAt: Date | null;
  retiredRoundBatchId: number | null;
  status: ExchangeParticipationStatus;
}) {
  const {
    currentJoinedAt = null,
    retiredAt,
    retiredRoundBatchId,
    status,
  } = params;

  if (status === "not-participating") {
    return {
      aiAuthorityExchangeJoinedAt: null,
      aiAuthorityExchangeRetiredAt: null,
      aiAuthorityExchangeRetiredInRoundBatchId: null,
      isActiveOnAiAuthorityExchange: false,
    };
  }

  if (status === "active") {
    return {
      aiAuthorityExchangeJoinedAt: currentJoinedAt ?? new Date(),
      aiAuthorityExchangeRetiredAt: null,
      aiAuthorityExchangeRetiredInRoundBatchId: null,
      isActiveOnAiAuthorityExchange: true,
    };
  }

  return {
    aiAuthorityExchangeJoinedAt: currentJoinedAt ?? retiredAt,
    aiAuthorityExchangeRetiredAt: retiredAt,
    aiAuthorityExchangeRetiredInRoundBatchId: retiredRoundBatchId,
    isActiveOnAiAuthorityExchange: false,
  };
}
