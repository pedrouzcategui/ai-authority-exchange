import { NextResponse } from "next/server";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { buildExchangeLifecycleFields } from "@/lib/business-exchange-lifecycle";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    businessId: string;
  }>;
};

type UpdateExchangeStatusPayload = {
  active?: unknown;
};

function parseNumericId(value: string) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function parseBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { businessId: rawBusinessId } = await context.params;
  const businessId = parseNumericId(rawBusinessId);

  if (businessId === null) {
    return NextResponse.json(
      { error: "The selected business is invalid." },
      { status: 400 },
    );
  }

  let payload: UpdateExchangeStatusPayload;

  try {
    payload = (await request.json()) as UpdateExchangeStatusPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const active = parseBoolean(payload.active);

  if (active === null) {
    return NextResponse.json(
      { error: "Please provide a valid active state." },
      { status: 400 },
    );
  }

  const currentBusiness = await prisma.business.findUnique({
    select: {
      aiAuthorityExchangeJoinedAt: true,
      business: true,
      id: true,
    },
    where: {
      id: businessId,
    },
  });

  if (!currentBusiness) {
    return NextResponse.json(
      { error: "The selected business does not exist." },
      { status: 404 },
    );
  }

  const nextStatus = active ? "active" : "not-participating";
  const exchangeLifecycleFields = buildExchangeLifecycleFields({
    currentJoinedAt: currentBusiness.aiAuthorityExchangeJoinedAt,
    retiredAt: null,
    retiredRoundBatchId: null,
    status: nextStatus,
  });

  await prisma.business.update({
    data: {
      aiAuthorityExchangeJoinedAt:
        exchangeLifecycleFields.aiAuthorityExchangeJoinedAt,
      aiAuthorityExchangeRetiredAt:
        exchangeLifecycleFields.aiAuthorityExchangeRetiredAt,
      aiAuthorityExchangeRetiredInRoundBatchId:
        exchangeLifecycleFields.aiAuthorityExchangeRetiredInRoundBatchId,
      isActiveOnAiAuthorityExchange:
        exchangeLifecycleFields.isActiveOnAiAuthorityExchange,
    },
    where: {
      id: businessId,
    },
  });

  return NextResponse.json({
    exchangeParticipationStatus: nextStatus,
    message: active
      ? `${currentBusiness.business} is now active in the AI Authority Exchange.`
      : `${currentBusiness.business} is no longer active in the AI Authority Exchange.`,
  });
}
