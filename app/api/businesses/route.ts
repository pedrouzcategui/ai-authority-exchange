import { NextResponse } from "next/server";
import { Prisma, type BusinessRoleType } from "@/generated/prisma/client";
import type { ExchangeParticipationStatus } from "@/lib/ai-authority-exchange";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { buildExchangeLifecycleFields } from "@/lib/business-exchange-lifecycle";
import { prisma } from "@/lib/prisma";

type CreateBusinessPayload = {
  aiAuthorityExchangeRetiredAt?: unknown;
  aiAuthorityExchangeRetiredRoundSequenceNumber?: unknown;
  exchangeParticipationStatus?: unknown;
  isActiveOnAiAuthorityExchange?: unknown;
  name?: unknown;
  role?: unknown;
  websiteUrl?: unknown;
};

type UpdateBusinessPayload = CreateBusinessPayload & {
  businessCategoryId?: unknown;
  businessId?: unknown;
  relatedCategoriesReasoning?: unknown;
  relatedCategoryIds?: unknown;
  subcategory?: unknown;
};

const hasProtocolPattern = /^[a-z][a-z\d+.-]*:\/\//i;

function formatErrorDetails(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const metaDetails = error.meta
      ? ` Meta: ${JSON.stringify(error.meta)}.`
      : "";
    return `Prisma error ${error.code}: ${error.message}.${metaDetails}`;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeWebsiteUrl(value: unknown) {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    return null;
  }

  const candidateUrl = hasProtocolPattern.test(normalizedValue)
    ? normalizedValue
    : `https://${normalizedValue}`;

  try {
    const parsedUrl = new URL(candidateUrl);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function normalizeRole(value: unknown): BusinessRoleType | null {
  if (value === "client" || value === "partner") {
    return value;
  }

  return null;
}

function normalizeOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function normalizeExchangeParticipationStatus(
  value: unknown,
): ExchangeParticipationStatus | null {
  if (
    value === "not-participating" ||
    value === "active" ||
    value === "retired"
  ) {
    return value;
  }

  return null;
}

function resolveExchangeParticipationStatus(params: {
  legacyIsActiveOnAiAuthorityExchange: boolean | null;
  providedStatus: ExchangeParticipationStatus | null;
}) {
  const { legacyIsActiveOnAiAuthorityExchange, providedStatus } = params;

  if (providedStatus) {
    return providedStatus;
  }

  if (legacyIsActiveOnAiAuthorityExchange === true) {
    return "active";
  }

  if (legacyIsActiveOnAiAuthorityExchange === false) {
    return "not-participating";
  }

  return null;
}

function normalizeOptionalDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { isValid: true, value: null } as const;
  }

  if (typeof value === "string" || value instanceof Date) {
    const parsedDate = new Date(value);

    if (!Number.isNaN(parsedDate.getTime())) {
      return { isValid: true, value: parsedDate } as const;
    }
  }

  return { isValid: false, value: null } as const;
}

function parsePositiveInteger(value: unknown) {
  const parsedValue = parseNumericId(value);

  if (parsedValue === null || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function normalizeNullablePositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { isValid: true, value: null } as const;
  }

  const parsedValue = parsePositiveInteger(value);

  if (parsedValue === null) {
    return { isValid: false, value: null } as const;
  }

  return { isValid: true, value: parsedValue } as const;
}

function normalizeNullableText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { isValid: true, value: null } as const;
  }

  if (typeof value !== "string") {
    return { isValid: false, value: null } as const;
  }

  const trimmedValue = value.trim();

  return {
    isValid: true,
    value: trimmedValue.length > 0 ? trimmedValue : null,
  } as const;
}

function normalizeRelatedCategoryIds(value: unknown) {
  if (value === null) {
    return { isValid: true, value: [] } as const;
  }

  if (!Array.isArray(value)) {
    return { isValid: false, value: [] } as const;
  }

  const normalizedIds: number[] = [];
  const seenIds = new Set<number>();

  for (const item of value) {
    const parsedValue = parsePositiveInteger(item);

    if (parsedValue === null) {
      return { isValid: false, value: [] } as const;
    }

    if (!seenIds.has(parsedValue)) {
      seenIds.add(parsedValue);
      normalizedIds.push(parsedValue);
    }
  }

  return { isValid: true, value: normalizedIds } as const;
}

async function resolveRetiredRoundBatchId(sequenceNumber: number | null) {
  if (sequenceNumber === null) {
    return null;
  }

  const roundBatch = await prisma.roundBatch.findUnique({
    select: {
      id: true,
    },
    where: {
      sequenceNumber,
    },
  });

  return roundBatch?.id ?? null;
}

function parseNumericId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number.parseInt(value, 10);

    if (Number.isInteger(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: CreateBusinessPayload;

  try {
    payload = (await request.json()) as CreateBusinessPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const name = normalizeString(payload.name);
  const role = normalizeRole(payload.role);
  const legacyIsActiveOnAiAuthorityExchange = normalizeOptionalBoolean(
    payload.isActiveOnAiAuthorityExchange,
  );
  const exchangeParticipationStatus = resolveExchangeParticipationStatus({
    legacyIsActiveOnAiAuthorityExchange,
    providedStatus: normalizeExchangeParticipationStatus(
      payload.exchangeParticipationStatus,
    ),
  });
  const retiredAt = normalizeOptionalDate(payload.aiAuthorityExchangeRetiredAt);
  const retiredRoundSequenceNumber = parsePositiveInteger(
    payload.aiAuthorityExchangeRetiredRoundSequenceNumber,
  );
  const websiteUrl = normalizeWebsiteUrl(payload.websiteUrl);

  if (
    !name ||
    !websiteUrl ||
    !role ||
    !exchangeParticipationStatus ||
    !retiredAt.isValid
  ) {
    return NextResponse.json(
      {
        error:
          "Please provide a business name, a valid website URL, a role, and a valid AI Authority Exchange status.",
      },
      { status: 400 },
    );
  }

  if (exchangeParticipationStatus === "retired" && retiredAt.value === null) {
    return NextResponse.json(
      {
        error:
          "Please provide the retirement date when a business is marked as retired from the AI Authority Exchange.",
      },
      { status: 400 },
    );
  }

  if (
    exchangeParticipationStatus !== "retired" &&
    (retiredAt.value !== null || retiredRoundSequenceNumber !== null)
  ) {
    return NextResponse.json(
      {
        error:
          "Retirement details can only be provided when the business is marked as retired from the AI Authority Exchange.",
      },
      { status: 400 },
    );
  }

  try {
    const retiredRoundBatchId = await resolveRetiredRoundBatchId(
      retiredRoundSequenceNumber,
    );

    if (retiredRoundSequenceNumber !== null && retiredRoundBatchId === null) {
      return NextResponse.json(
        {
          error: `Round ${retiredRoundSequenceNumber} does not exist yet. Create or import that round before assigning it as the retirement round.`,
        },
        { status: 400 },
      );
    }

    const exchangeLifecycleFields = buildExchangeLifecycleFields({
      retiredAt: retiredAt.value,
      retiredRoundBatchId,
      status: exchangeParticipationStatus,
    });
    const business = await prisma.business.create({
      data: {
        aiAuthorityExchangeJoinedAt:
          exchangeLifecycleFields.aiAuthorityExchangeJoinedAt,
        aiAuthorityExchangeRetiredAt:
          exchangeLifecycleFields.aiAuthorityExchangeRetiredAt,
        aiAuthorityExchangeRetiredInRoundBatchId:
          exchangeLifecycleFields.aiAuthorityExchangeRetiredInRoundBatchId,
        business: name,
        clientType: role,
        isActiveOnAiAuthorityExchange:
          exchangeLifecycleFields.isActiveOnAiAuthorityExchange,
        websiteUrl,
      },
      select: {
        business: true,
        id: true,
      },
    });

    return NextResponse.json(
      {
        business,
        message: `${business.business} was added successfully as a ${role}.`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A business with that name already exists." },
        { status: 409 },
      );
    }

    const errorDetails = formatErrorDetails(error);

    return NextResponse.json(
      { error: `The business could not be created. ${errorDetails}` },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: UpdateBusinessPayload;

  try {
    payload = (await request.json()) as UpdateBusinessPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const businessId = parseNumericId(payload.businessId);
  const name = normalizeString(payload.name);
  const role = normalizeRole(payload.role);
  const hasBusinessCategoryId = Object.prototype.hasOwnProperty.call(
    payload,
    "businessCategoryId",
  );
  const hasRelatedCategoriesReasoning = Object.prototype.hasOwnProperty.call(
    payload,
    "relatedCategoriesReasoning",
  );
  const hasRelatedCategoryIds = Object.prototype.hasOwnProperty.call(
    payload,
    "relatedCategoryIds",
  );
  const hasSubcategory = Object.prototype.hasOwnProperty.call(
    payload,
    "subcategory",
  );
  const legacyIsActiveOnAiAuthorityExchange = normalizeOptionalBoolean(
    payload.isActiveOnAiAuthorityExchange,
  );
  const exchangeParticipationStatus = resolveExchangeParticipationStatus({
    legacyIsActiveOnAiAuthorityExchange,
    providedStatus: normalizeExchangeParticipationStatus(
      payload.exchangeParticipationStatus,
    ),
  });
  const retiredAt = normalizeOptionalDate(payload.aiAuthorityExchangeRetiredAt);
  const retiredRoundSequenceNumber = parsePositiveInteger(
    payload.aiAuthorityExchangeRetiredRoundSequenceNumber,
  );
  const businessCategoryId = hasBusinessCategoryId
    ? normalizeNullablePositiveInteger(payload.businessCategoryId)
    : null;
  const relatedCategoriesReasoning = hasRelatedCategoriesReasoning
    ? normalizeNullableText(payload.relatedCategoriesReasoning)
    : null;
  const relatedCategoryIds = hasRelatedCategoryIds
    ? normalizeRelatedCategoryIds(payload.relatedCategoryIds)
    : null;
  const subcategory = hasSubcategory
    ? normalizeNullableText(payload.subcategory)
    : null;
  const websiteUrl = normalizeWebsiteUrl(payload.websiteUrl);

  if (
    businessId === null ||
    !name ||
    !role ||
    !websiteUrl ||
    !exchangeParticipationStatus ||
    !retiredAt.isValid
  ) {
    return NextResponse.json(
      {
        error:
          "Please provide a valid business, business name, website URL, role, and AI Authority Exchange status.",
      },
      { status: 400 },
    );
  }

  if (exchangeParticipationStatus === "retired" && retiredAt.value === null) {
    return NextResponse.json(
      {
        error:
          "Please provide the retirement date when a business is marked as retired from the AI Authority Exchange.",
      },
      { status: 400 },
    );
  }

  if (
    exchangeParticipationStatus !== "retired" &&
    (retiredAt.value !== null || retiredRoundSequenceNumber !== null)
  ) {
    return NextResponse.json(
      {
        error:
          "Retirement details can only be provided when the business is marked as retired from the AI Authority Exchange.",
      },
      { status: 400 },
    );
  }

  if (
    (businessCategoryId && !businessCategoryId.isValid) ||
    (subcategory && !subcategory.isValid) ||
    (relatedCategoryIds && !relatedCategoryIds.isValid) ||
    (relatedCategoriesReasoning && !relatedCategoriesReasoning.isValid)
  ) {
    return NextResponse.json(
      {
        error:
          "Please provide valid business taxonomy values before saving this business.",
      },
      { status: 400 },
    );
  }

  try {
    const [currentBusiness, retiredRoundBatchId] = await Promise.all([
      prisma.business.findUnique({
        select: {
          aiAuthorityExchangeJoinedAt: true,
          business_category_id: true,
          id: true,
          related_category_ids: true,
        },
        where: {
          id: businessId,
        },
      }),
      resolveRetiredRoundBatchId(retiredRoundSequenceNumber),
    ]);

    if (!currentBusiness) {
      return NextResponse.json(
        { error: "The selected business does not exist." },
        { status: 404 },
      );
    }

    if (retiredRoundSequenceNumber !== null && retiredRoundBatchId === null) {
      return NextResponse.json(
        {
          error: `Round ${retiredRoundSequenceNumber} does not exist yet. Create or import that round before assigning it as the retirement round.`,
        },
        { status: 400 },
      );
    }

    const effectiveBusinessCategoryId = hasBusinessCategoryId
      ? businessCategoryId!.value
      : currentBusiness.business_category_id;
    const nextRelatedCategoryIds = hasRelatedCategoryIds
      ? relatedCategoryIds!.value.filter(
          (categoryId) => categoryId !== effectiveBusinessCategoryId,
        )
      : hasBusinessCategoryId && effectiveBusinessCategoryId !== null
        ? currentBusiness.related_category_ids.filter(
            (categoryId) => categoryId !== effectiveBusinessCategoryId,
          )
        : currentBusiness.related_category_ids;
    const referencedCategoryIds = new Set<number>();

    if (hasBusinessCategoryId && businessCategoryId!.value !== null) {
      referencedCategoryIds.add(businessCategoryId!.value);
    }

    if (hasRelatedCategoryIds) {
      for (const categoryId of nextRelatedCategoryIds) {
        referencedCategoryIds.add(categoryId);
      }
    }

    if (referencedCategoryIds.size > 0) {
      const existingCategories = await prisma.business_categories.findMany({
        select: {
          id: true,
        },
        where: {
          id: {
            in: [...referencedCategoryIds],
          },
        },
      });

      if (existingCategories.length !== referencedCategoryIds.size) {
        return NextResponse.json(
          {
            error:
              "One or more selected business categories are no longer available.",
          },
          { status: 400 },
        );
      }
    }

    const exchangeLifecycleFields = buildExchangeLifecycleFields({
      currentJoinedAt: currentBusiness.aiAuthorityExchangeJoinedAt,
      retiredAt: retiredAt.value,
      retiredRoundBatchId,
      status: exchangeParticipationStatus,
    });
    const updateData: Prisma.BusinessUpdateInput = {
      aiAuthorityExchangeJoinedAt:
        exchangeLifecycleFields.aiAuthorityExchangeJoinedAt,
      aiAuthorityExchangeRetiredAt:
        exchangeLifecycleFields.aiAuthorityExchangeRetiredAt,
      aiAuthorityExchangeRetiredInRoundBatchId:
        exchangeLifecycleFields.aiAuthorityExchangeRetiredInRoundBatchId,
      business: name,
      clientType: role,
      isActiveOnAiAuthorityExchange:
        exchangeLifecycleFields.isActiveOnAiAuthorityExchange,
      websiteUrl,
    };

    if (hasBusinessCategoryId) {
      updateData.business_category_id = businessCategoryId!.value;
    }

    if (hasSubcategory) {
      updateData.subcategory = subcategory!.value;
    }

    if (hasRelatedCategoryIds || hasBusinessCategoryId) {
      updateData.related_category_ids = nextRelatedCategoryIds;
    }

    if (hasRelatedCategoriesReasoning) {
      updateData.related_categories_reasoning =
        relatedCategoriesReasoning!.value;
    }

    const business = await prisma.business.update({
      data: updateData,
      select: {
        business: true,
        id: true,
      },
      where: {
        id: businessId,
      },
    });

    return NextResponse.json(
      {
        business,
        message: `${business.business} was updated successfully.`,
      },
      { status: 200 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A business with that name already exists." },
        { status: 409 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "The selected business does not exist." },
        { status: 404 },
      );
    }

    const errorDetails = formatErrorDetails(error);

    return NextResponse.json(
      { error: `The business could not be updated. ${errorDetails}` },
      { status: 500 },
    );
  }
}
