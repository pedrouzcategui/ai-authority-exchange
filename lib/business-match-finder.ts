import { cache } from "react";
import { isExchangeParticipationActive } from "@/lib/ai-authority-exchange";
import { prisma } from "@/lib/prisma";
import type { BusinessOption } from "@/lib/matches";

const WEBHOOK_TIMEOUT_MS = 60_000;

export type BusinessMatchSuggestion = {
  competitionRationale: string | null;
  editorialBridge: string | null;
  matchRationale: string | null;
  matchScore: number | null;
  partnerName: string;
  selectedPartnerId: number | null;
  suggestedTopics: string[];
};

export type LocalBusinessMatchCandidate = {
  categoryName: string | null;
  clientType: "client" | "partner" | null;
  domainRating: number | null;
  id: number;
  isActiveOnAiAuthorityExchange: boolean;
  name: string;
  relatedCategoryNames: string[];
  sectorName: string | null;
  subcategoryName: string | null;
  websiteUrl: string | null;
};

export type MatchSearchScope = "same-category" | "same-category-or-sector";

export type BusinessMatchLookupResult =
  | {
      matches: BusinessMatchSuggestion[];
      status: "error";
      summaryText: null;
      userMessage: string;
    }
  | {
      matches: [];
      status: "unconfigured";
      summaryText: null;
      userMessage: string;
    }
  | {
      matches: BusinessMatchSuggestion[];
      status: "success";
      summaryText: string;
      userMessage: null;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

function pickString(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const normalizedValue = normalizeString(record[key]);

    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return null;
}

function pickNumber(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const normalizedValue = normalizeNumber(record[key]);

    if (normalizedValue !== null) {
      return normalizedValue;
    }
  }

  return null;
}

function normalizeSuggestedTopics(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((topic) => normalizeString(topic))
      .filter((topic): topic is string => topic !== null);
  }

  const normalizedValue = normalizeString(value);
  return normalizedValue ? [normalizedValue] : [];
}

function normalizeMatchSuggestion(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const partnerName = pickString(value, [
    "partner_name",
    "partnerName",
    "name",
  ]);

  if (!partnerName) {
    return null;
  }

  return {
    competitionRationale: pickString(value, [
      "competition_rationale",
      "competitionRationale",
      "competitor_rationale",
    ]),
    editorialBridge: pickString(value, ["editorial_bridge", "editorialBridge"]),
    matchRationale: pickString(value, ["match_rationale", "matchRationale"]),
    matchScore: pickNumber(value, ["match_score", "matchScore"]),
    partnerName,
    selectedPartnerId: pickNumber(value, [
      "selected_partner_id",
      "selectedPartnerId",
      "partner_id",
    ]),
    suggestedTopics: normalizeSuggestedTopics(value.suggested_topics),
  } satisfies BusinessMatchSuggestion;
}

function extractMatchSuggestions(payload: unknown) {
  if (Array.isArray(payload)) {
    const nestedOutput = payload.flatMap((entry) => {
      if (!isRecord(entry) || !Array.isArray(entry.output)) {
        return [];
      }

      return entry.output;
    });

    const candidateEntries = nestedOutput.length > 0 ? nestedOutput : payload;

    return candidateEntries
      .map((entry) => normalizeMatchSuggestion(entry))
      .filter((entry): entry is BusinessMatchSuggestion => entry !== null);
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.output)) {
    return payload.output
      .map((entry) => normalizeMatchSuggestion(entry))
      .filter((entry): entry is BusinessMatchSuggestion => entry !== null);
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.output)) {
    return payload.data.output
      .map((entry) => normalizeMatchSuggestion(entry))
      .filter((entry): entry is BusinessMatchSuggestion => entry !== null);
  }

  return [];
}

function extractPlainText(payload: unknown) {
  if (typeof payload === "string") {
    const trimmedPayload = payload.trim();
    return trimmedPayload.length === 0 ? null : trimmedPayload;
  }

  if (!isRecord(payload)) {
    return null;
  }

  return pickString(payload, ["message", "summary", "text", "output"]) ?? null;
}

function formatSectionValue(value: string | number | null) {
  return value === null ? "Not provided." : String(value);
}

function formatSummaryText(
  businessName: string,
  matches: readonly BusinessMatchSuggestion[],
) {
  return `Here are the top ${matches.length} most accurate partners for ${businessName}\n\n${matches
    .map(
      (partner, index) =>
        `Partner: ${index + 1} - ${partner.partnerName}\n\nWhy: ${formatSectionValue(partner.matchRationale)}\n\nMatch Score: ${formatSectionValue(partner.matchScore)}\n\nEditorial Bridge: ${formatSectionValue(partner.editorialBridge)}\n\nCompetitor Rationale: ${formatSectionValue(partner.competitionRationale)}\n\nSuggested Topics:\n${partner.suggestedTopics.length === 0 ? "Not provided." : partner.suggestedTopics.join("\n")}\n\n------`,
    )
    .join("\n\n")}`;
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function createWebhookRequest(
  webhookUrl: string,
  business: BusinessOption,
  method: "GET" | "POST",
): { init: RequestInit; url: string } {
  const acceptHeaders: HeadersInit = {
    Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
  };
  const payload = {
    id: business.id,
    name: business.business,
    business_id: business.id,
    business_name: business.business,
    business_website_url: business.websiteUrl,
    website_url: business.websiteUrl,
  };

  if (method === "GET") {
    const requestUrl = new URL(webhookUrl);

    requestUrl.searchParams.set("id", business.id.toString());
    requestUrl.searchParams.set("name", business.business);
    requestUrl.searchParams.set("business_id", business.id.toString());
    requestUrl.searchParams.set("business_name", business.business);

    if (business.websiteUrl) {
      requestUrl.searchParams.set("website_url", business.websiteUrl);
      requestUrl.searchParams.set("business_website_url", business.websiteUrl);
    }

    return {
      init: {
        cache: "no-store" as const,
        headers: acceptHeaders,
        method,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      },
      url: requestUrl.toString(),
    };
  }

  const postHeaders: HeadersInit = {
    ...acceptHeaders,
    "Content-Type": "application/json",
  };

  return {
    init: {
      body: JSON.stringify(payload),
      cache: "no-store" as const,
      headers: postHeaders,
      method,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    },
    url: webhookUrl,
  };
}

export const getLocalBusinessMatchCandidates = cache(
  async (businessId: number, scope: MatchSearchScope) => {
    const [hostBusiness, existingMatches] = await Promise.all([
      prisma.business.findUnique({
        where: {
          id: businessId,
        },
        select: {
          business_categories: {
            select: {
              sector_id: true,
            },
          },
          business_category_id: true,
        },
      }),
      prisma.match.findMany({
        where: {
          OR: [
            {
              guestId: businessId,
            },
            {
              hostId: businessId,
            },
          ],
        },
        select: {
          guestId: true,
          hostId: true,
        },
      }),
    ]);

    if (!hostBusiness || hostBusiness.business_category_id === null) {
      return [] satisfies LocalBusinessMatchCandidate[];
    }

    const blockedBusinessIds = new Set<number>([businessId]);

    for (const match of existingMatches) {
      blockedBusinessIds.add(match.hostId);
      blockedBusinessIds.add(match.guestId);
    }

    const hostSectorId = hostBusiness.business_categories?.sector_id ?? null;
    const categoryOrSectorWhere =
      scope === "same-category-or-sector" && hostSectorId !== null
        ? {
            OR: [
              {
                business_categories: {
                  is: {
                    sector_id: hostSectorId,
                  },
                },
              },
              {
                business_category_id: hostBusiness.business_category_id,
              },
            ],
          }
        : {
            business_category_id: hostBusiness.business_category_id,
          };

    const candidates = await prisma.business.findMany({
      orderBy: [{ domain_rating: "desc" }, { created_at: "desc" }],
      select: {
        aiAuthorityExchangeJoinedAt: true,
        aiAuthorityExchangeRetiredAt: true,
        business: true,
        business_categories: {
          select: {
            economic_sectors: {
              select: {
                name: true,
              },
            },
            name: true,
          },
        },
        clientType: true,
        domain_rating: true,
        id: true,
        isActiveOnAiAuthorityExchange: true,
        related_category_ids: true,
        subcategory: true,
        websiteUrl: true,
      },
      take: 5,
      where: {
        ...categoryOrSectorWhere,
        aiAuthorityExchangeRetiredAt: null,
        client_status: "active",
        id: {
          notIn: [...blockedBusinessIds],
        },
        OR: [
          {
            aiAuthorityExchangeJoinedAt: {
              not: null,
            },
          },
          {
            isActiveOnAiAuthorityExchange: true,
          },
        ],
      },
    });

    const relatedCategoryIds = [
      ...new Set(
        candidates.flatMap((candidate) => candidate.related_category_ids),
      ),
    ];
    const relatedCategories =
      relatedCategoryIds.length === 0
        ? []
        : await prisma.business_categories.findMany({
            select: {
              id: true,
              name: true,
            },
            where: {
              id: {
                in: relatedCategoryIds,
              },
            },
          });
    const relatedCategoryNameById = new Map(
      relatedCategories.map(
        (category) => [category.id, category.name] as const,
      ),
    );

    return candidates.map((candidate) => ({
      categoryName: candidate.business_categories?.name ?? null,
      clientType: candidate.clientType,
      domainRating: candidate.domain_rating,
      id: candidate.id,
      isActiveOnAiAuthorityExchange: isExchangeParticipationActive(candidate),
      name: candidate.business,
      relatedCategoryNames: candidate.related_category_ids
        .map((categoryId) => relatedCategoryNameById.get(categoryId))
        .filter((categoryName): categoryName is string =>
          Boolean(categoryName),
        ),
      sectorName: candidate.business_categories?.economic_sectors?.name ?? null,
      subcategoryName: candidate.subcategory,
      websiteUrl: candidate.websiteUrl,
    })) satisfies LocalBusinessMatchCandidate[];
  },
);

export async function findBusinessMatches(
  business: BusinessOption,
): Promise<BusinessMatchLookupResult> {
  const webhookUrl = normalizeString(process.env.N8N_MATCH_FINDER_WEBHOOK_URL);

  if (!webhookUrl) {
    return {
      matches: [],
      status: "unconfigured",
      summaryText: null,
      userMessage:
        "Set N8N_MATCH_FINDER_WEBHOOK_URL to your n8n webhook endpoint to enable business match lookups.",
    };
  }

  const configuredMethod = normalizeString(
    process.env.N8N_MATCH_FINDER_WEBHOOK_METHOD,
  );
  const method = configuredMethod?.toUpperCase() === "POST" ? "POST" : "GET";

  try {
    const request = createWebhookRequest(webhookUrl, business, method);
    const response = await fetch(request.url, request.init);
    const rawResponse = await response.text();

    if (!response.ok) {
      const details = rawResponse.trim();

      return {
        matches: [],
        status: "error",
        summaryText: null,
        userMessage:
          details.length === 0
            ? `The n8n webhook returned ${response.status} ${response.statusText}.`
            : `The n8n webhook returned ${response.status} ${response.statusText}: ${details}`,
      };
    }

    const directTextResponse = rawResponse.trim();

    if (directTextResponse.length === 0) {
      return {
        matches: [],
        status: "error",
        summaryText: null,
        userMessage: "The n8n webhook returned an empty response.",
      };
    }

    const parsedPayload = safeParseJson(directTextResponse);

    if (parsedPayload === null) {
      return {
        matches: [],
        status: "success",
        summaryText: directTextResponse,
        userMessage: null,
      };
    }

    const suggestions = extractMatchSuggestions(parsedPayload);

    if (suggestions.length > 0) {
      return {
        matches: suggestions,
        status: "success",
        summaryText: formatSummaryText(business.business, suggestions),
        userMessage: null,
      };
    }

    const plainTextPayload = extractPlainText(parsedPayload);

    if (plainTextPayload) {
      return {
        matches: [],
        status: "success",
        summaryText: plainTextPayload,
        userMessage: null,
      };
    }

    return {
      matches: [],
      status: "error",
      summaryText: null,
      userMessage:
        "The n8n webhook responded, but the payload did not match the expected schema.",
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      return {
        matches: [],
        status: "error",
        summaryText: null,
        userMessage: "The n8n webhook timed out before it returned a response.",
      };
    }

    const message =
      error instanceof Error ? error.message : "Unknown webhook error.";

    return {
      matches: [],
      status: "error",
      summaryText: null,
      userMessage: `The n8n webhook request failed: ${message}`,
    };
  }
}
