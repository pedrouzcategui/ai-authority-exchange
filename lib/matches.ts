import { cache } from "react";
import type {
  MatchStatus,
  Prisma,
  RoundBatchStatus,
} from "@/generated/prisma/client";
import { getExchangeParticipationStatus } from "@/lib/ai-authority-exchange";
import { getBusinessProfileSlug } from "@/lib/business-profile-route";
import { prisma } from "@/lib/prisma";

const businessSelection = {
  aiAuthorityExchangeJoinedAt: true,
  aiAuthorityExchangeRetiredAt: true,
  aiAuthorityExchangeRetiredInRoundBatch: {
    select: {
      sequenceNumber: true,
    },
  },
  aiAuthorityExchangeRetiredInRoundBatchId: true,
  business: true,
  clientType: true,
  domain_rating: true,
  id: true,
  isActiveOnAiAuthorityExchange: true,
  websiteUrl: true,
} as const;

type SelectedBusiness = Prisma.BusinessGetPayload<{
  select: typeof businessSelection;
}>;

function toBusinessOption(business: SelectedBusiness) {
  return {
    aiAuthorityExchangeJoinedAt: business.aiAuthorityExchangeJoinedAt,
    aiAuthorityExchangeParticipationStatus:
      getExchangeParticipationStatus(business),
    aiAuthorityExchangeRetiredAt: business.aiAuthorityExchangeRetiredAt,
    aiAuthorityExchangeRetiredInRoundBatchId:
      business.aiAuthorityExchangeRetiredInRoundBatchId,
    aiAuthorityExchangeRetiredInRoundSequenceNumber:
      business.aiAuthorityExchangeRetiredInRoundBatch?.sequenceNumber ?? null,
    business: business.business,
    clientType: business.clientType,
    domain_rating: business.domain_rating,
    id: business.id,
    isActiveOnAiAuthorityExchange:
      business.isActiveOnAiAuthorityExchange === true,
    websiteUrl: business.websiteUrl,
  };
}

type RawMatchWithBusinesses = Prisma.MatchGetPayload<{
  include: {
    guest: {
      select: typeof businessSelection;
    };
    host: {
      select: typeof businessSelection;
    };
    roundBatch: {
      select: {
        id: true;
        sequenceNumber: true;
        status: true;
      };
    };
  };
}>;

function toMatchWithBusinesses(match: RawMatchWithBusinesses) {
  return {
    ...match,
    guest: toBusinessOption(match.guest),
    host: toBusinessOption(match.host),
  };
}

const businessNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function compareBusinessNames(
  left: { business: string },
  right: { business: string },
) {
  return businessNameCollator.compare(left.business, right.business);
}

function normalizeBusinessIdentifier(value: string) {
  return decodeURIComponent(value).trim().toLocaleLowerCase();
}

export const getBusinesses = cache(async () => {
  const businesses = await prisma.business.findMany({
    select: businessSelection,
  });

  return businesses
    .map((business) => toBusinessOption(business))
    .toSorted(compareBusinessNames);
});

export const getExplicitlyActiveExchangeBusinesses = cache(async () => {
  const businesses = await prisma.business.findMany({
    select: businessSelection,
    where: {
      isActiveOnAiAuthorityExchange: true,
    },
  });

  return businesses
    .map((business) => toBusinessOption(business))
    .toSorted(compareBusinessNames);
});

export type BusinessOption = Awaited<ReturnType<typeof getBusinesses>>[number];

export const getBusinessById = cache(async (businessId: number) => {
  const business = await prisma.business.findUnique({
    where: {
      id: businessId,
    },
    select: businessSelection,
  });

  return business ? toBusinessOption(business) : null;
});

export const getBusinessByIdentifier = cache(async (identifier: string) => {
  const normalizedIdentifier = normalizeBusinessIdentifier(identifier);
  const requestedSlug = getBusinessProfileSlug(normalizedIdentifier);
  const parsedId = Number.parseInt(normalizedIdentifier, 10);
  const businesses = await getBusinesses();

  return (
    businesses.find((candidate) => candidate.business === identifier) ??
    businesses.find(
      (candidate) =>
        candidate.business.toLocaleLowerCase() === normalizedIdentifier,
    ) ??
    businesses.find(
      (candidate) =>
        getBusinessProfileSlug(candidate.business) === requestedSlug,
    ) ??
    (Number.isInteger(parsedId) && parsedId > 0
      ? businesses.find((candidate) => candidate.id === parsedId)
      : undefined) ??
    null
  );
});

export const getMatches = cache(async (hostId?: number, guestId?: number) => {
  const where =
    hostId === undefined && guestId === undefined
      ? undefined
      : {
          ...(hostId === undefined ? {} : { hostId }),
          ...(guestId === undefined ? {} : { guestId }),
        };

  const matches = await prisma.match.findMany({
    include: {
      guest: {
        select: businessSelection,
      },
      host: {
        select: businessSelection,
      },
      roundBatch: {
        select: {
          id: true,
          sequenceNumber: true,
          status: true,
        },
      },
    },
    where,
    orderBy: {
      id: "desc",
    },
  });

  return matches.map((match) => toMatchWithBusinesses(match));
});

type MatchWithBusinesses = Awaited<ReturnType<typeof getMatches>>[number];

export type BusinessRelationshipRow = BusinessOption & {
  publishedBy: BusinessOption[];
  publishedFor: BusinessOption[];
};

export type BusinessRelationshipState = {
  id: number;
  publishedByIds: number[];
  publishedForIds: number[];
};

export type BusinessMatchBoardRow = {
  counterpart: BusinessOption;
  counterpartRole: "guest" | "host";
  createdAt: Date | null;
  id: number;
  interviewPublished: boolean;
  interviewSent: boolean;
  roundBatchId: number | null;
  roundSequenceNumber: number | null;
  roundStatus: RoundBatchStatus | null;
  status: MatchStatus | null;
};

function buildBusinessRelationshipRows(
  businesses: BusinessOption[],
  matches: MatchWithBusinesses[],
) {
  const relationshipRows: BusinessRelationshipRow[] = businesses.map(
    (business) => ({
      ...business,
      publishedBy: [],
      publishedFor: [],
    }),
  );
  const rowById = new Map(
    relationshipRows.map((row) => [row.id, row] as const),
  );

  for (const match of matches) {
    rowById.get(match.host.id)?.publishedFor.push(match.guest);
    rowById.get(match.guest.id)?.publishedBy.push(match.host);
  }

  for (const row of relationshipRows) {
    row.publishedBy.sort(compareBusinessNames);
    row.publishedFor.sort(compareBusinessNames);
  }

  return relationshipRows;
}

export const getBusinessMatchBoard = cache(async (businessId: number) => {
  const matches = await prisma.match.findMany({
    include: {
      guest: {
        select: businessSelection,
      },
      host: {
        select: businessSelection,
      },
      roundBatch: {
        select: {
          id: true,
          sequenceNumber: true,
          status: true,
        },
      },
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    where: {
      OR: [
        {
          hostId: businessId,
        },
        {
          guestId: businessId,
        },
      ],
    },
  });

  const normalizedMatches = matches.map((match) =>
    toMatchWithBusinesses(match),
  );

  return normalizedMatches.map((match) => {
    const businessIsHost = match.hostId === businessId;

    return {
      counterpart: businessIsHost ? match.guest : match.host,
      counterpartRole: businessIsHost ? "guest" : "host",
      createdAt: match.created_at ?? null,
      id: match.id,
      interviewPublished: match.interview_published ?? false,
      interviewSent: match.interview_sent ?? false,
      roundBatchId: match.roundBatchId ?? null,
      roundSequenceNumber: match.roundBatch?.sequenceNumber ?? null,
      roundStatus: match.roundBatch?.status ?? null,
      status: match.status ?? null,
    } satisfies BusinessMatchBoardRow;
  });
});

export const getBusinessRelationshipRows = cache(
  async (hostId?: number, guestId?: number, businessId?: number) => {
    if (businessId !== undefined) {
      const [businesses, matches] = await Promise.all([
        getExplicitlyActiveExchangeBusinesses(),
        prisma.match.findMany({
          include: {
            guest: {
              select: businessSelection,
            },
            host: {
              select: businessSelection,
            },
            roundBatch: {
              select: {
                id: true,
                sequenceNumber: true,
                status: true,
              },
            },
          },
          where: {
            OR: [
              {
                hostId: businessId,
              },
              {
                guestId: businessId,
              },
            ],
          },
          orderBy: {
            id: "desc",
          },
        }),
      ]);
      const activeBusinessIds = new Set(
        businesses.map((business) => business.id),
      );
      const normalizedMatches = matches
        .map((match) => toMatchWithBusinesses(match))
        .filter(
          (match) =>
            activeBusinessIds.has(match.host.id) &&
            activeBusinessIds.has(match.guest.id),
        );
      const business = businesses.find(
        (candidate) => candidate.id === businessId,
      );

      if (!business) {
        return [];
      }

      const relationshipRow: BusinessRelationshipRow = {
        ...business,
        publishedBy: [],
        publishedFor: [],
      };

      for (const match of normalizedMatches) {
        if (match.host.id === businessId) {
          relationshipRow.publishedFor.push(match.guest);
        }

        if (match.guest.id === businessId) {
          relationshipRow.publishedBy.push(match.host);
        }
      }

      relationshipRow.publishedBy.sort(compareBusinessNames);
      relationshipRow.publishedFor.sort(compareBusinessNames);

      return [relationshipRow];
    }

    const [businesses, matches] = await Promise.all([
      getExplicitlyActiveExchangeBusinesses(),
      getMatches(),
    ]);
    const activeBusinessIds = new Set(
      businesses.map((business) => business.id),
    );
    const activeMatches = matches.filter(
      (match) =>
        activeBusinessIds.has(match.host.id) &&
        activeBusinessIds.has(match.guest.id),
    );
    const relationshipRows = buildBusinessRelationshipRows(
      businesses,
      activeMatches,
    );

    if (hostId === undefined && guestId === undefined) {
      return relationshipRows;
    }

    return relationshipRows.filter(
      (row) =>
        (hostId === undefined ||
          row.publishedBy.some((business) => business.id === hostId)) &&
        (guestId === undefined ||
          row.publishedFor.some((business) => business.id === guestId)),
    );
  },
);
