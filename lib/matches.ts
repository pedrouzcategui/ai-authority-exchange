import { cache } from "react";
import { prisma } from "@/lib/prisma";

const businessSelection = {
  business: true,
  clientType: true,
  id: true,
  websiteUrl: true,
} as const;

export const getBusinesses = cache(async () => {
  return prisma.business.findMany({
    orderBy: {
      business: "asc",
    },
    select: businessSelection,
  });
});

export type BusinessOption = Awaited<ReturnType<typeof getBusinesses>>[number];

export const getMatches = cache(async (hostId?: number, guestId?: number) => {
  const where =
    hostId === undefined && guestId === undefined
      ? undefined
      : {
          ...(hostId === undefined ? {} : { hostId }),
          ...(guestId === undefined ? {} : { guestId }),
        };

  return prisma.match.findMany({
    include: {
      guest: {
        select: businessSelection,
      },
      host: {
        select: businessSelection,
      },
    },
    where,
    orderBy: {
      id: "desc",
    },
  });
});

export type BusinessRelationshipRow = BusinessOption & {
  publishedBy: BusinessOption[];
  publishedFor: BusinessOption[];
};

export const getBusinessRelationshipRows = cache(
  async (hostId?: number, guestId?: number, businessId?: number) => {
    if (businessId !== undefined) {
      const [businesses, matches] = await Promise.all([
        getBusinesses(),
        prisma.match.findMany({
          include: {
            guest: {
              select: businessSelection,
            },
            host: {
              select: businessSelection,
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

      for (const match of matches) {
        if (match.host.id === businessId) {
          relationshipRow.publishedFor.push(match.guest);
        }

        if (match.guest.id === businessId) {
          relationshipRow.publishedBy.push(match.host);
        }
      }

      relationshipRow.publishedBy.sort((left, right) =>
        left.business.localeCompare(right.business),
      );
      relationshipRow.publishedFor.sort((left, right) =>
        left.business.localeCompare(right.business),
      );

      return [relationshipRow];
    }

    const selectedBusinessIds = [
      ...new Set([hostId, guestId].filter((id) => id !== undefined)),
    ];
    const [businesses, matches] = await Promise.all([
      getBusinesses(),
      selectedBusinessIds.length === 0
        ? getMatches()
        : prisma.match.findMany({
            include: {
              guest: {
                select: businessSelection,
              },
              host: {
                select: businessSelection,
              },
            },
            where: {
              OR: [
                {
                  hostId: {
                    in: selectedBusinessIds,
                  },
                },
                {
                  guestId: {
                    in: selectedBusinessIds,
                  },
                },
              ],
            },
            orderBy: {
              id: "desc",
            },
          }),
    ]);
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
      row.publishedBy.sort((left, right) =>
        left.business.localeCompare(right.business),
      );
      row.publishedFor.sort((left, right) =>
        left.business.localeCompare(right.business),
      );
    }

    if (hostId === undefined && guestId === undefined) {
      return relationshipRows;
    }

    return relationshipRows.filter(
      (row) =>
        row.id === hostId ||
        row.id === guestId ||
        row.publishedBy.length > 0 ||
        row.publishedFor.length > 0,
    );
  },
);
