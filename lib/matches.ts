import { cache } from "react";
import type {
  MatchStatus,
  Prisma,
  RoundBatchStatus,
} from "@/generated/prisma/client";
import { getExchangeParticipationStatus } from "@/lib/ai-authority-exchange";
import { getBusinessProfileSlug } from "@/lib/business-profile-route";
import { getForbiddenBusinessIdsForBusiness } from "@/lib/forbidden-business-pairs";
import { prisma } from "@/lib/prisma";

const businessContactSelection = {
  email: true,
  firstName: true,
  fullName: true,
  id: true,
  lastName: true,
  role: true,
} as const;

const businessContactAssignmentSelection = {
  business: true,
  id: true,
} as const;

const businessContactDirectorySelection = {
  ...businessContactSelection,
  expertForBusinesses: {
    select: businessContactAssignmentSelection,
  },
  marketerForBusinesses: {
    select: businessContactAssignmentSelection,
  },
} as const;

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
  expert: {
    select: businessContactSelection,
  },
  id: true,
  isActiveOnAiAuthorityExchange: true,
  marketer: {
    select: businessContactSelection,
  },
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
    expert: business.expert,
    id: business.id,
    isActiveOnAiAuthorityExchange:
      business.isActiveOnAiAuthorityExchange === true,
    marketer: business.marketer,
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

export const getForbiddenBusinessesForBusiness = cache(
  async (businessId: number) => {
    const [businesses, forbiddenBusinessIds] = await Promise.all([
      getBusinesses(),
      getForbiddenBusinessIdsForBusiness(businessId),
    ]);
    const forbiddenBusinessIdSet = new Set(forbiddenBusinessIds);

    return businesses.filter((business) =>
      forbiddenBusinessIdSet.has(business.id),
    );
  },
);

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

export type BusinessContactOption = Prisma.BusinessContactGetPayload<{
  select: typeof businessContactSelection;
}>;

export type BusinessContactAssignment = Prisma.BusinessGetPayload<{
  select: typeof businessContactAssignmentSelection;
}>;

type SelectedBusinessContactDirectoryRow = Prisma.BusinessContactGetPayload<{
  select: typeof businessContactDirectorySelection;
}>;

const businessContactCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function getBusinessContactLabel(contact: BusinessContactOption) {
  if (contact.fullName && contact.fullName.trim().length > 0) {
    return contact.fullName.trim();
  }

  const fullName = [contact.firstName, contact.lastName]
    .filter((value): value is string =>
      Boolean(value && value.trim().length > 0),
    )
    .join(" ")
    .trim();

  if (fullName.length > 0) {
    return fullName;
  }

  if (contact.email && contact.email.trim().length > 0) {
    return contact.email.trim();
  }

  return `Contact ${contact.id}`;
}

function compareBusinessContacts(
  left: BusinessContactOption,
  right: BusinessContactOption,
) {
  const roleComparison = businessContactCollator.compare(left.role, right.role);

  if (roleComparison !== 0) {
    return roleComparison;
  }

  const labelComparison = businessContactCollator.compare(
    getBusinessContactLabel(left),
    getBusinessContactLabel(right),
  );

  if (labelComparison !== 0) {
    return labelComparison;
  }

  return left.id - right.id;
}

export const getBusinessContacts = cache(async () => {
  const contacts = await prisma.businessContact.findMany({
    select: businessContactSelection,
  });

  return contacts.toSorted(compareBusinessContacts);
});

function toBusinessContactDirectoryRow(
  contact: SelectedBusinessContactDirectoryRow,
) {
  return {
    ...contact,
    expertForBusinesses: [...contact.expertForBusinesses].toSorted(
      compareBusinessNames,
    ),
    marketerForBusinesses: [...contact.marketerForBusinesses].toSorted(
      compareBusinessNames,
    ),
  };
}

export const getBusinessContactDirectoryRows = cache(async () => {
  const contacts = await prisma.businessContact.findMany({
    select: businessContactDirectorySelection,
  });

  return contacts
    .map((contact) => toBusinessContactDirectoryRow(contact))
    .toSorted(compareBusinessContacts);
});

export type BusinessOption = Awaited<ReturnType<typeof getBusinesses>>[number];
export type BusinessContactDirectoryRow = Awaited<
  ReturnType<typeof getBusinessContactDirectoryRows>
>[number];

export type BusinessProfileDetails = {
  businessCategoryName: string | null;
  relatedCategoriesReasoning: string | null;
  relatedCategoryNames: string[];
  sectorName: string | null;
  subcategory: string | null;
};

export type BusinessDirectoryRow = {
  business: string;
  businessCategoryName: string | null;
  expert: BusinessDirectoryContact | null;
  id: number;
  isActiveOnAiAuthorityExchange: boolean;
  marketer: BusinessDirectoryContact | null;
  subcategory: string | null;
  websiteUrl: string | null;
};

export type BusinessDirectoryContact = BusinessContactOption;

export const getBusinessById = cache(async (businessId: number) => {
  const business = await prisma.business.findUnique({
    where: {
      id: businessId,
    },
    select: businessSelection,
  });

  return business ? toBusinessOption(business) : null;
});

export const getBusinessProfileDetails = cache(async (businessId: number) => {
  const business = await prisma.business.findUnique({
    where: {
      id: businessId,
    },
    select: {
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
      related_categories_reasoning: true,
      related_category_ids: true,
      subcategory: true,
    },
  });

  if (!business) {
    return null;
  }

  const relatedCategories =
    business.related_category_ids.length === 0
      ? []
      : await prisma.business_categories.findMany({
          select: {
            id: true,
            name: true,
          },
          where: {
            id: {
              in: business.related_category_ids,
            },
          },
        });

  const relatedCategoryNameById = new Map(
    relatedCategories.map((category) => [category.id, category.name] as const),
  );

  return {
    businessCategoryName: business.business_categories?.name ?? null,
    relatedCategoriesReasoning: business.related_categories_reasoning,
    relatedCategoryNames: business.related_category_ids
      .map((categoryId) => relatedCategoryNameById.get(categoryId))
      .filter((categoryName): categoryName is string => Boolean(categoryName)),
    sectorName: business.business_categories?.economic_sectors?.name ?? null,
    subcategory: business.subcategory,
  } satisfies BusinessProfileDetails;
});

export const getBusinessDirectoryRows = cache(async () => {
  const businesses = await prisma.business.findMany({
    select: {
      business: true,
      business_categories: {
        select: {
          name: true,
        },
      },
      expert: {
        select: businessContactSelection,
      },
      id: true,
      isActiveOnAiAuthorityExchange: true,
      marketer: {
        select: businessContactSelection,
      },
      subcategory: true,
      websiteUrl: true,
    },
  });

  return businesses
    .map(
      (business) =>
        ({
          business: business.business,
          businessCategoryName: business.business_categories?.name ?? null,
          expert: business.expert,
          id: business.id,
          isActiveOnAiAuthorityExchange:
            business.isActiveOnAiAuthorityExchange === true,
          marketer: business.marketer,
          subcategory: business.subcategory,
          websiteUrl: business.websiteUrl,
        }) satisfies BusinessDirectoryRow,
    )
    .toSorted(compareBusinessNames);
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
  forbiddenBusinesses: BusinessOption[];
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
  forbiddenBusinessesByBusinessId: Map<number, BusinessOption[]>,
) {
  const relationshipRows: BusinessRelationshipRow[] = businesses.map(
    (business) => ({
      ...business,
      forbiddenBusinesses:
        forbiddenBusinessesByBusinessId.get(business.id) ?? [],
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
    row.forbiddenBusinesses.sort(compareBusinessNames);
    row.publishedBy.sort(compareBusinessNames);
    row.publishedFor.sort(compareBusinessNames);
  }

  return relationshipRows;
}

async function getForbiddenBusinessesByBusinessId(
  businesses: Pick<BusinessOption, "id">[],
) {
  const entries = await Promise.all(
    businesses.map(async (business) => {
      const forbiddenBusinesses = await getForbiddenBusinessesForBusiness(
        business.id,
      );

      return [business.id, forbiddenBusinesses] as const;
    }),
  );

  return new Map(entries);
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
      const [businesses, matches, forbiddenBusinesses] = await Promise.all([
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
        getForbiddenBusinessesForBusiness(businessId),
      ]);
      const normalizedMatches = matches.map((match) =>
        toMatchWithBusinesses(match),
      );
      const business = businesses.find(
        (candidate) => candidate.id === businessId,
      );

      if (!business) {
        return [];
      }

      const relationshipRow: BusinessRelationshipRow = {
        ...business,
        forbiddenBusinesses,
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

    const businessesPromise = getExplicitlyActiveExchangeBusinesses();
    const matchesPromise = getMatches();
    const forbiddenBusinessesByBusinessIdPromise = businessesPromise.then(
      getForbiddenBusinessesByBusinessId,
    );
    const [businesses, matches, forbiddenBusinessesByBusinessId] =
      await Promise.all([
        businessesPromise,
        matchesPromise,
        forbiddenBusinessesByBusinessIdPromise,
      ]);
    const relationshipRows = buildBusinessRelationshipRows(
      businesses,
      matches,
      forbiddenBusinessesByBusinessId,
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
