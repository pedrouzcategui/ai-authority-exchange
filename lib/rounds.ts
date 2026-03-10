import { cache } from "react";
import type {
  Prisma,
  PrismaClient,
  RoundAssignmentSource,
  RoundBatchStatus,
} from "@/generated/prisma/client";
import { isExchangeParticipationActive } from "@/lib/ai-authority-exchange";
import { prisma, withDatabaseRetry } from "@/lib/prisma";

const businessNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const roundBusinessSelect = {
  aiAuthorityExchangeJoinedAt: true,
  aiAuthorityExchangeRetiredAt: true,
  business: true,
  business_categories: {
    select: {
      sector_id: true,
    },
  },
  business_category_id: true,
  clientType: true,
  domain_rating: true,
  id: true,
  isActiveOnAiAuthorityExchange: true,
  websiteUrl: true,
} as const;

type RawRoundBusiness = Prisma.BusinessGetPayload<{
  select: typeof roundBusinessSelect;
}>;

const roundAssignmentSelect = {
  createdAt: true,
  guestBusiness: {
    select: roundBusinessSelect,
  },
  guestBusinessId: true,
  hostBusiness: {
    select: roundBusinessSelect,
  },
  hostBusinessId: true,
  id: true,
  roundBatchId: true,
  source: true,
  updatedAt: true,
} as const;

const roundBatchSummarySelect = {
  _count: {
    select: {
      assignments: true,
    },
  },
  appliedAt: true,
  createdAt: true,
  id: true,
  sequenceNumber: true,
  status: true,
} as const;

type RoundBusiness = {
  aiAuthorityExchangeJoinedAt: Date | null;
  aiAuthorityExchangeRetiredAt: Date | null;
  business: string;
  business_categories: {
    sector_id: number | null;
  } | null;
  business_category_id: number | null;
  clientType: "client" | "partner" | null;
  domain_rating: number | null;
  id: number;
  isActiveOnAiAuthorityExchange: boolean;
  websiteUrl: string | null;
};

function toRoundBusiness(business: RawRoundBusiness): RoundBusiness {
  return {
    aiAuthorityExchangeJoinedAt: business.aiAuthorityExchangeJoinedAt,
    aiAuthorityExchangeRetiredAt: business.aiAuthorityExchangeRetiredAt,
    business: business.business,
    business_categories: business.business_categories,
    business_category_id: business.business_category_id,
    clientType: business.clientType,
    domain_rating: business.domain_rating,
    id: business.id,
    isActiveOnAiAuthorityExchange: isExchangeParticipationActive(business),
    websiteUrl: business.websiteUrl,
  };
}

type RawRoundAssignmentRecord = Prisma.RoundAssignmentGetPayload<{
  select: typeof roundAssignmentSelect;
}>;

function toRoundAssignmentRecord(
  assignment: RawRoundAssignmentRecord,
): RoundAssignmentRecord {
  return {
    ...assignment,
    guestBusiness: toRoundBusiness(assignment.guestBusiness),
    hostBusiness: toRoundBusiness(assignment.hostBusiness),
  };
}

type HistoricalMatchRecord = {
  guest: {
    domain_rating: number | null;
    id: number;
  };
  guestId: number;
  host: {
    domain_rating: number | null;
    id: number;
  };
  hostId: number;
};

type RoundAssignmentRecord = {
  createdAt: Date;
  guestBusiness: RoundBusiness;
  guestBusinessId: number;
  hostBusiness: RoundBusiness;
  hostBusinessId: number;
  id: number;
  roundBatchId: number;
  source: RoundAssignmentSource;
  updatedAt: Date;
};

type RoundBatchSummaryRecord = {
  _count: {
    assignments: number;
  };
  appliedAt: Date | null;
  createdAt: Date;
  id: number;
  sequenceNumber: number;
  status: RoundBatchStatus;
};

type HistoricalContext = {
  balanceByBusinessId: Map<number, number | null>;
  pairedBusinessIdsByBusinessId: Map<number, Set<number>>;
};

type RoundDraftState = {
  assignments: RoundAssignmentRecord[];
  assignmentByGuestId: Map<number, RoundAssignmentRecord>;
  assignmentByHostId: Map<number, RoundAssignmentRecord>;
  assignmentByPairKey: Map<string, RoundAssignmentRecord>;
};

type DraftAssignmentCandidate = {
  guestBusinessId: number;
  hostBusinessId: number;
  score: number;
};

export type RoundBatchSummary = {
  appliedAt: string | null;
  assignmentCount: number;
  createdAt: string;
  id: number;
  sequenceNumber: number;
  status: RoundBatchStatus;
};

export type RoundDraftOption = {
  businessId: number;
  businessName: string;
  domainRating: number | null;
};

export type RoundDraftCell = {
  assignmentId: number;
  businessId: number;
  businessName: string;
  domainRating: number | null;
  source: RoundAssignmentSource;
};

export type RoundDraftAssignmentRow = {
  assignmentId: number;
  guestBusiness: RoundDraftOption;
  hostBusiness: RoundDraftOption;
  source: RoundAssignmentSource;
};

export type RoundDraftRow = {
  businessId: number;
  businessName: string;
  domainRating: number | null;
  publishedBy: RoundDraftCell | null;
  publishedByOptions: RoundDraftOption[];
  publishedFor: RoundDraftCell | null;
  publishedForOptions: RoundDraftOption[];
  rowStatus: "complete" | "empty" | "partial";
};

export type RoundBatchView = {
  activeBusinessCount: number;
  assignmentRows: RoundDraftAssignmentRow[];
  batch: RoundBatchSummary | null;
  batches: RoundBatchSummary[];
  rows: RoundDraftRow[];
  selectableBusinesses: RoundDraftOption[];
  unresolvedBusinessCount: number;
};

type UpdateRoundAssignmentParams = {
  businessId: number;
  counterpartBusinessId: number | null;
  direction: "publishedBy" | "publishedFor";
  roundBatchId: number;
};

type UpsertRoundAssignmentRowParams = {
  assignmentId?: number | null;
  guestBusinessId: number;
  hostBusinessId: number;
  roundBatchId: number;
};

type DeleteRoundAssignmentRowParams = {
  assignmentId: number;
  roundBatchId: number;
};

function compareBusinesses(left: { business: string }, right: { business: string }) {
  return businessNameCollator.compare(left.business, right.business);
}

function pairKey(hostBusinessId: number, guestBusinessId: number) {
  return `${hostBusinessId}:${guestBusinessId}`;
}

function formatRoundBatchSummary(batch: RoundBatchSummaryRecord): RoundBatchSummary {
  return {
    appliedAt: batch.appliedAt?.toISOString() ?? null,
    assignmentCount: batch._count.assignments,
    createdAt: batch.createdAt.toISOString(),
    id: batch.id,
    sequenceNumber: batch.sequenceNumber,
    status: batch.status,
  };
}

function getCategoryRelation(hostBusiness: RoundBusiness, guestBusiness: RoundBusiness) {
  if (
    hostBusiness.business_category_id !== null &&
    hostBusiness.business_category_id === guestBusiness.business_category_id
  ) {
    return "same-category";
  }

  if (
    hostBusiness.business_categories?.sector_id !== null &&
    hostBusiness.business_categories?.sector_id ===
      guestBusiness.business_categories?.sector_id
  ) {
    return "same-sector";
  }

  return null;
}

function getDirectionalContribution(
  hostDomainRating: number | null,
  guestDomainRating: number | null,
) {
  if (hostDomainRating === null || guestDomainRating === null) {
    return null;
  }

  return hostDomainRating - guestDomainRating;
}

function getBalanceImprovement(
  currentBalance: number | null,
  contribution: number | null,
) {
  if (currentBalance === null || contribution === null) {
    return 0;
  }

  return Math.abs(currentBalance) - Math.abs(currentBalance + contribution);
}

function getDraftCandidateScore(
  hostBusiness: RoundBusiness,
  guestBusiness: RoundBusiness,
  balanceByBusinessId: Map<number, number | null>,
) {
  const categoryRelation = getCategoryRelation(hostBusiness, guestBusiness);

  if (!categoryRelation) {
    return null;
  }

  const hostContribution = getDirectionalContribution(
    hostBusiness.domain_rating,
    guestBusiness.domain_rating,
  );
  const guestContribution =
    hostContribution === null ? null : hostContribution * -1;
  const hostImprovement = getBalanceImprovement(
    balanceByBusinessId.get(hostBusiness.id) ?? null,
    hostContribution,
  );
  const guestImprovement = getBalanceImprovement(
    balanceByBusinessId.get(guestBusiness.id) ?? null,
    guestContribution,
  );
  const relevanceScore = categoryRelation === "same-category" ? 100 : 60;
  const domainRatingScore = hostContribution === null ? 0 : 5;
  const proximityScore = hostContribution === null ? 0 : -Math.abs(hostContribution) / 100;

  return relevanceScore + hostImprovement * 2 + guestImprovement * 2 + domainRatingScore + proximityScore;
}

function buildHistoricalContext(
  activeBusinesses: RoundBusiness[],
  matches: HistoricalMatchRecord[],
): HistoricalContext {
  const pairedBusinessIdsByBusinessId = new Map<number, Set<number>>();
  const balanceByBusinessId = new Map<number, number | null>();

  for (const business of activeBusinesses) {
    pairedBusinessIdsByBusinessId.set(business.id, new Set<number>());
    balanceByBusinessId.set(
      business.id,
      business.domain_rating === null ? null : 0,
    );
  }

  for (const match of matches) {
    pairedBusinessIdsByBusinessId.get(match.hostId)?.add(match.guestId);
    pairedBusinessIdsByBusinessId.get(match.guestId)?.add(match.hostId);

    if (match.host.domain_rating !== null && match.guest.domain_rating !== null) {
      if (balanceByBusinessId.has(match.hostId)) {
        balanceByBusinessId.set(
          match.hostId,
          (balanceByBusinessId.get(match.hostId) ?? 0) +
            (match.host.domain_rating - match.guest.domain_rating),
        );
      }

      if (balanceByBusinessId.has(match.guestId)) {
        balanceByBusinessId.set(
          match.guestId,
          (balanceByBusinessId.get(match.guestId) ?? 0) +
            (match.guest.domain_rating - match.host.domain_rating),
        );
      }
    }
  }

  return {
    balanceByBusinessId,
    pairedBusinessIdsByBusinessId,
  };
}

function buildRoundDraftState(assignments: RoundAssignmentRecord[]): RoundDraftState {
  return {
    assignments,
    assignmentByGuestId: new Map(
      assignments.map((assignment) => [assignment.guestBusinessId, assignment] as const),
    ),
    assignmentByHostId: new Map(
      assignments.map((assignment) => [assignment.hostBusinessId, assignment] as const),
    ),
    assignmentByPairKey: new Map(
      assignments.map((assignment) => [
        pairKey(assignment.hostBusinessId, assignment.guestBusinessId),
        assignment,
      ] as const),
    ),
  };
}

function isDirectedAssignmentEligible(params: {
  currentAssignmentId?: number;
  draftState: RoundDraftState;
  enforceExchangeRules?: boolean;
  guestBusinessId: number;
  hostBusinessId: number;
  pairedBusinessIdsByBusinessId: Map<number, Set<number>>;
  roundBusinessesById: Map<number, RoundBusiness>;
}) {
  const {
    currentAssignmentId,
    draftState,
    enforceExchangeRules = true,
    guestBusinessId,
    hostBusinessId,
    pairedBusinessIdsByBusinessId,
    roundBusinessesById,
  } = params;

  if (hostBusinessId === guestBusinessId) {
    return false;
  }

  const hostBusiness = roundBusinessesById.get(hostBusinessId);
  const guestBusiness = roundBusinessesById.get(guestBusinessId);

  if (!hostBusiness || !guestBusiness) {
    return false;
  }

  if (enforceExchangeRules) {
    if (
      !hostBusiness.isActiveOnAiAuthorityExchange ||
      !guestBusiness.isActiveOnAiAuthorityExchange
    ) {
      return false;
    }

    if (!getCategoryRelation(hostBusiness, guestBusiness)) {
      return false;
    }

    if (
      pairedBusinessIdsByBusinessId.get(hostBusinessId)?.has(guestBusinessId) ||
      pairedBusinessIdsByBusinessId.get(guestBusinessId)?.has(hostBusinessId)
    ) {
      return false;
    }
  }

  const existingHostAssignment = draftState.assignmentByHostId.get(hostBusinessId);

  if (
    existingHostAssignment &&
    existingHostAssignment.id !== currentAssignmentId
  ) {
    return false;
  }

  const existingGuestAssignment = draftState.assignmentByGuestId.get(guestBusinessId);

  if (
    existingGuestAssignment &&
    existingGuestAssignment.id !== currentAssignmentId
  ) {
    return false;
  }

  const duplicateAssignment = draftState.assignmentByPairKey.get(
    pairKey(hostBusinessId, guestBusinessId),
  );

  if (duplicateAssignment && duplicateAssignment.id !== currentAssignmentId) {
    return false;
  }

  const reverseAssignment = draftState.assignmentByPairKey.get(
    pairKey(guestBusinessId, hostBusinessId),
  );

  if (reverseAssignment && reverseAssignment.id !== currentAssignmentId) {
    return false;
  }

  return true;
}

function buildAutomaticRoundAssignments(params: {
  activeBusinesses: RoundBusiness[];
  balanceByBusinessId: Map<number, number | null>;
  pairedBusinessIdsByBusinessId: Map<number, Set<number>>;
}) {
  const { activeBusinesses, balanceByBusinessId, pairedBusinessIdsByBusinessId } =
    params;
  const roundBusinessesById = new Map(
    activeBusinesses.map((business) => [business.id, business] as const),
  );
  const candidateAssignments: DraftAssignmentCandidate[] = [];

  for (const hostBusiness of activeBusinesses) {
    for (const guestBusiness of activeBusinesses) {
      if (
        hostBusiness.id === guestBusiness.id ||
        pairedBusinessIdsByBusinessId
          .get(hostBusiness.id)
          ?.has(guestBusiness.id)
      ) {
        continue;
      }

      const score = getDraftCandidateScore(
        hostBusiness,
        guestBusiness,
        balanceByBusinessId,
      );

      if (score === null) {
        continue;
      }

      candidateAssignments.push({
        guestBusinessId: guestBusiness.id,
        hostBusinessId: hostBusiness.id,
        score,
      });
    }
  }

  candidateAssignments.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const leftHostBusiness = roundBusinessesById.get(left.hostBusinessId)!;
    const rightHostBusiness = roundBusinessesById.get(right.hostBusinessId)!;
    const hostComparison = compareBusinesses(leftHostBusiness, rightHostBusiness);

    if (hostComparison !== 0) {
      return hostComparison;
    }

    const leftGuestBusiness = roundBusinessesById.get(left.guestBusinessId)!;
    const rightGuestBusiness = roundBusinessesById.get(right.guestBusinessId)!;
    return compareBusinesses(leftGuestBusiness, rightGuestBusiness);
  });

  const selectedAssignments: RoundAssignmentRecord[] = [];
  const selectedState = buildRoundDraftState([]);

  for (const candidateAssignment of candidateAssignments) {
    if (
      !isDirectedAssignmentEligible({
        draftState: selectedState,
        guestBusinessId: candidateAssignment.guestBusinessId,
        hostBusinessId: candidateAssignment.hostBusinessId,
        pairedBusinessIdsByBusinessId,
        roundBusinessesById,
      })
    ) {
      continue;
    }

    const hostBusiness = roundBusinessesById.get(candidateAssignment.hostBusinessId)!;
    const guestBusiness = roundBusinessesById.get(candidateAssignment.guestBusinessId)!;
    const nextAssignment = {
      createdAt: new Date(0),
      guestBusiness,
      guestBusinessId: guestBusiness.id,
      hostBusiness,
      hostBusinessId: hostBusiness.id,
      id: selectedAssignments.length * -1 - 1,
      roundBatchId: 0,
      source: "auto" as const,
      updatedAt: new Date(0),
    } satisfies RoundAssignmentRecord;

    selectedAssignments.push(nextAssignment);
    selectedState.assignments.push(nextAssignment);
    selectedState.assignmentByHostId.set(nextAssignment.hostBusinessId, nextAssignment);
    selectedState.assignmentByGuestId.set(nextAssignment.guestBusinessId, nextAssignment);
    selectedState.assignmentByPairKey.set(
      pairKey(nextAssignment.hostBusinessId, nextAssignment.guestBusinessId),
      nextAssignment,
    );
  }

  return selectedAssignments.map((assignment) => ({
    guestBusinessId: assignment.guestBusinessId,
    hostBusinessId: assignment.hostBusinessId,
    source: assignment.source,
  }));
}

function toRoundDraftOption(business: RoundBusiness): RoundDraftOption {
  return {
    businessId: business.id,
    businessName: business.business,
    domainRating: business.domain_rating,
  };
}

function toRoundDraftCell(
  assignment: RoundAssignmentRecord,
  direction: "publishedBy" | "publishedFor",
): RoundDraftCell {
  const counterpartBusiness =
    direction === "publishedBy" ? assignment.hostBusiness : assignment.guestBusiness;

  return {
    assignmentId: assignment.id,
    businessId: counterpartBusiness.id,
    businessName: counterpartBusiness.business,
    domainRating: counterpartBusiness.domain_rating,
    source: assignment.source,
  };
}

function toRoundDraftAssignmentRow(
  assignment: RoundAssignmentRecord,
): RoundDraftAssignmentRow {
  return {
    assignmentId: assignment.id,
    guestBusiness: toRoundDraftOption(assignment.guestBusiness),
    hostBusiness: toRoundDraftOption(assignment.hostBusiness),
    source: assignment.source,
  };
}

function getBusinessesRepresentedInAssignments(
  assignments: RoundAssignmentRecord[],
) {
  const businessesById = new Map<number, RoundBusiness>();

  for (const assignment of assignments) {
    businessesById.set(assignment.hostBusiness.id, assignment.hostBusiness);
    businessesById.set(assignment.guestBusiness.id, assignment.guestBusiness);
  }

  return Array.from(businessesById.values()).toSorted(compareBusinesses);
}

async function getActiveRoundBusinessesFromDatabase(database: PrismaClient = prisma) {
  const businesses = await database.business.findMany({
    select: roundBusinessSelect,
    where: {
      aiAuthorityExchangeRetiredAt: null,
      client_status: "active",
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

  return businesses.map((business) => toRoundBusiness(business)).toSorted(compareBusinesses);
}

async function getSelectableRoundBusinessesFromDatabase(
  database: PrismaClient = prisma,
) {
  const businesses = await database.business.findMany({
    select: roundBusinessSelect,
  });

  return businesses.map((business) => toRoundBusiness(business)).toSorted(compareBusinesses);
}

async function getHistoricalMatchesForBusinesses(
  database: PrismaClient,
  businessIds: number[],
): Promise<HistoricalMatchRecord[]> {
  if (businessIds.length === 0) {
    return [];
  }

  const matches = await database.match.findMany({
    select: {
      guest: {
        select: {
          domain_rating: true,
          id: true,
        },
      },
      guestId: true,
      host: {
        select: {
          domain_rating: true,
          id: true,
        },
      },
      hostId: true,
    },
    where: {
      OR: [
        {
          guestId: {
            in: businessIds,
          },
        },
        {
          hostId: {
            in: businessIds,
          },
        },
      ],
    },
  });

  return matches as HistoricalMatchRecord[];
}

async function getRoundManagementContext(
  roundBatchId: number,
  database: PrismaClient = prisma,
) {
  const [batch, activeBusinesses, selectableBusinesses, assignments] = await Promise.all([
    database.roundBatch.findUnique({
      select: {
        appliedAt: true,
        createdAt: true,
        id: true,
        sequenceNumber: true,
        status: true,
      },
      where: {
        id: roundBatchId,
      },
    }),
    getActiveRoundBusinessesFromDatabase(database),
    getSelectableRoundBusinessesFromDatabase(database),
    database.roundAssignment.findMany({
      select: roundAssignmentSelect,
      where: {
        roundBatchId,
      },
    }),
  ]);

  if (!batch) {
    throw new Error("The selected round draft does not exist.");
  }

  const historicalMatches = await getHistoricalMatchesForBusinesses(
    database,
    activeBusinesses.map((business) => business.id),
  );
  const historicalContext = buildHistoricalContext(activeBusinesses, historicalMatches);

  return {
    activeBusinesses,
    assignments: assignments.map((assignment) =>
      toRoundAssignmentRecord(assignment),
    ),
    batch,
    historicalContext,
    selectableBusinesses,
  };
}

export const getRoundBatchSummaries = cache(async () => {
  const batches = (await prisma.roundBatch.findMany({
    orderBy: {
      sequenceNumber: "desc",
    },
    select: roundBatchSummarySelect,
  })) as RoundBatchSummaryRecord[];

  return batches.map((batch) => formatRoundBatchSummary(batch));
});

async function getNextRoundSequenceNumber(database: PrismaClient) {
  const aggregateResult = await database.roundBatch.aggregate({
    _max: {
      sequenceNumber: true,
    },
  });

  return (aggregateResult._max.sequenceNumber ?? 0) + 1;
}

export const getRoundBatchView = cache(async (requestedBatchId?: number) => {
  const [batches, activeBusinesses, selectableBusinesses] = await Promise.all([
    getRoundBatchSummaries(),
    getActiveRoundBusinessesFromDatabase(),
    getSelectableRoundBusinessesFromDatabase(),
  ]);

  if (batches.length === 0) {
    return {
      activeBusinessCount: activeBusinesses.length,
      assignmentRows: [],
      batch: null,
      batches,
      rows: activeBusinesses.map((business) => ({
        businessId: business.id,
        businessName: business.business,
        domainRating: business.domain_rating,
        publishedBy: null,
        publishedByOptions: [],
        publishedFor: null,
        publishedForOptions: [],
        rowStatus: "empty" as const,
      })),
      selectableBusinesses: selectableBusinesses.map((business) =>
        toRoundDraftOption(business),
      ),
      unresolvedBusinessCount: activeBusinesses.length,
    } satisfies RoundBatchView;
  }

  const selectedBatch =
    (requestedBatchId === undefined
      ? batches[0]
      : batches.find((batch) => batch.id === requestedBatchId)) ?? batches[0];
  const { assignments, historicalContext } = await getRoundManagementContext(
    selectedBatch.id,
  );
  const displayedBusinesses =
    selectedBatch.status === "draft"
      ? activeBusinesses
      : getBusinessesRepresentedInAssignments(assignments);
  const roundBusinessesById = new Map(
    [...selectableBusinesses, ...displayedBusinesses].map(
      (business) => [business.id, business] as const,
    ),
  );
  const draftState = buildRoundDraftState(assignments);
  const assignmentRows = assignments
    .toSorted((left, right) => {
      const hostComparison = compareBusinesses(
        left.hostBusiness,
        right.hostBusiness,
      );

      if (hostComparison !== 0) {
        return hostComparison;
      }

      return compareBusinesses(left.guestBusiness, right.guestBusiness);
    })
    .map((assignment) => toRoundDraftAssignmentRow(assignment));
  const rows = displayedBusinesses.map((business) => {
    const publishedByAssignment = draftState.assignmentByGuestId.get(business.id) ?? null;
    const publishedForAssignment = draftState.assignmentByHostId.get(business.id) ?? null;
    const publishedByOptions =
      selectedBatch.status === "draft"
        ? selectableBusinesses
            .filter((candidateBusiness) =>
              isDirectedAssignmentEligible({
                currentAssignmentId: publishedByAssignment?.id,
                draftState,
                enforceExchangeRules: false,
                guestBusinessId: business.id,
                hostBusinessId: candidateBusiness.id,
                pairedBusinessIdsByBusinessId:
                  historicalContext.pairedBusinessIdsByBusinessId,
                roundBusinessesById,
              }),
            )
            .map((candidateBusiness) => toRoundDraftOption(candidateBusiness))
        : [];
    const publishedForOptions =
      selectedBatch.status === "draft"
        ? selectableBusinesses
            .filter((candidateBusiness) =>
              isDirectedAssignmentEligible({
                currentAssignmentId: publishedForAssignment?.id,
                draftState,
                enforceExchangeRules: false,
                guestBusinessId: candidateBusiness.id,
                hostBusinessId: business.id,
                pairedBusinessIdsByBusinessId:
                  historicalContext.pairedBusinessIdsByBusinessId,
                roundBusinessesById,
              }),
            )
            .map((candidateBusiness) => toRoundDraftOption(candidateBusiness))
        : [];

    let rowStatus: RoundDraftRow["rowStatus"] = "complete";

    if (!publishedByAssignment && !publishedForAssignment) {
      rowStatus = "empty";
    } else if (!publishedByAssignment || !publishedForAssignment) {
      rowStatus = "partial";
    }

    return {
      businessId: business.id,
      businessName: business.business,
      domainRating: business.domain_rating,
      publishedBy: publishedByAssignment
        ? toRoundDraftCell(publishedByAssignment, "publishedBy")
        : null,
      publishedByOptions,
      publishedFor: publishedForAssignment
        ? toRoundDraftCell(publishedForAssignment, "publishedFor")
        : null,
      publishedForOptions,
      rowStatus,
    } satisfies RoundDraftRow;
  });

  return {
    activeBusinessCount: activeBusinesses.length,
    assignmentRows,
    batch: selectedBatch,
    batches,
    rows,
    selectableBusinesses: selectableBusinesses.map((business) =>
      toRoundDraftOption(business),
    ),
    unresolvedBusinessCount:
      selectedBatch.status === "draft"
        ? rows.filter((row) => row.rowStatus !== "complete").length
        : 0,
  } satisfies RoundBatchView;
});

export async function createRoundBatch() {
  return withDatabaseRetry(async (database) => {
    const nextSequenceNumber = await getNextRoundSequenceNumber(database);
    const batch = await database.roundBatch.create({
      data: {
        sequenceNumber: nextSequenceNumber,
      },
      select: {
        id: true,
        sequenceNumber: true,
      },
    });

    return {
      assignmentCount: 0,
      id: batch.id,
      sequenceNumber: batch.sequenceNumber,
    };
  });
}

export async function generateRoundDraftForBatch(roundBatchId: number) {
  return withDatabaseRetry(async (database) => {
    const batch = await database.roundBatch.findUnique({
      select: {
        _count: {
          select: {
            assignments: true,
          },
        },
        id: true,
        sequenceNumber: true,
        status: true,
      },
      where: {
        id: roundBatchId,
      },
    });

    if (!batch) {
      throw new Error("The selected round draft does not exist.");
    }

    if (batch.status !== "draft") {
      throw new Error("Only draft rounds can generate suggested assignments.");
    }

    if (batch._count.assignments > 0) {
      throw new Error(
        "This round already has assignments. Clear it first if you want to generate a fresh draft.",
      );
    }

    const activeBusinesses = await getActiveRoundBusinessesFromDatabase(database);

    if (activeBusinesses.length === 0) {
      throw new Error(
        "No businesses are active in the AI Authority Exchange yet.",
      );
    }

    const historicalMatches = await getHistoricalMatchesForBusinesses(
      database,
      activeBusinesses.map((business) => business.id),
    );
    const historicalContext = buildHistoricalContext(
      activeBusinesses,
      historicalMatches,
    );
    const generatedAssignments = buildAutomaticRoundAssignments({
      activeBusinesses,
      balanceByBusinessId: historicalContext.balanceByBusinessId,
      pairedBusinessIdsByBusinessId:
        historicalContext.pairedBusinessIdsByBusinessId,
    });

    if (generatedAssignments.length > 0) {
      await database.roundAssignment.createMany({
        data: generatedAssignments.map((assignment) => ({
          guestBusinessId: assignment.guestBusinessId,
          hostBusinessId: assignment.hostBusinessId,
          roundBatchId,
          source: assignment.source,
        })),
      });
    }

    return {
      activeBusinessCount: activeBusinesses.length,
      assignmentCount: generatedAssignments.length,
      id: batch.id,
      sequenceNumber: batch.sequenceNumber,
    };
  });
}

export async function updateRoundAssignment(
  params: UpdateRoundAssignmentParams,
) {
  const { businessId, counterpartBusinessId, direction, roundBatchId } = params;

  return withDatabaseRetry(async (database) => {
    const { assignments, batch, historicalContext, selectableBusinesses } =
      await getRoundManagementContext(roundBatchId, database);

    if (batch.status !== "draft") {
      throw new Error("Only draft rounds can be edited.");
    }

    const selectableBusinessesById = new Map(
      selectableBusinesses.map((business) => [business.id, business] as const),
    );

    if (!selectableBusinessesById.has(businessId)) {
      throw new Error("The selected business does not exist.");
    }

    const draftState = buildRoundDraftState(assignments);
    const currentAssignment =
      direction === "publishedFor"
        ? draftState.assignmentByHostId.get(businessId) ?? null
        : draftState.assignmentByGuestId.get(businessId) ?? null;

    if (counterpartBusinessId === null) {
      if (!currentAssignment) {
        return { message: "The round slot was already empty." };
      }

      await database.roundAssignment.delete({
        where: {
          id: currentAssignment.id,
        },
      });

      return { message: "The round slot was cleared." };
    }

    if (!selectableBusinessesById.has(counterpartBusinessId)) {
      throw new Error("The selected counterpart does not exist.");
    }

    const hostBusinessId =
      direction === "publishedFor" ? businessId : counterpartBusinessId;
    const guestBusinessId =
      direction === "publishedFor" ? counterpartBusinessId : businessId;

    if (
      !isDirectedAssignmentEligible({
        currentAssignmentId: currentAssignment?.id,
        draftState,
        enforceExchangeRules: false,
        guestBusinessId,
        hostBusinessId,
        pairedBusinessIdsByBusinessId:
          historicalContext.pairedBusinessIdsByBusinessId,
        roundBusinessesById: selectableBusinessesById,
      })
    ) {
      throw new Error(
        "That draft pairing is blocked by directionality or round capacity.",
      );
    }

    const savedAssignment = currentAssignment
      ? await database.roundAssignment.update({
          data: {
            guestBusinessId,
            hostBusinessId,
            source: "manual",
          },
          where: {
            id: currentAssignment.id,
          },
          select: {
            id: true,
          },
        })
      : await database.roundAssignment.create({
          data: {
            guestBusinessId,
            hostBusinessId,
            roundBatchId,
            source: "manual",
          },
          select: {
            id: true,
          },
        });

    return {
      assignmentId: savedAssignment.id,
      message: "The round draft was updated.",
    };
  });
}

export async function upsertRoundAssignmentRow(
  params: UpsertRoundAssignmentRowParams,
) {
  const { assignmentId, guestBusinessId, hostBusinessId, roundBatchId } = params;

  return withDatabaseRetry(async (database) => {
    const { assignments, batch, historicalContext, selectableBusinesses } =
      await getRoundManagementContext(roundBatchId, database);

    if (batch.status !== "draft") {
      throw new Error("Only draft rounds can be edited.");
    }

    const selectableBusinessesById = new Map(
      selectableBusinesses.map((business) => [business.id, business] as const),
    );

    if (!selectableBusinessesById.has(hostBusinessId)) {
      throw new Error("The selected publishing business does not exist.");
    }

    if (!selectableBusinessesById.has(guestBusinessId)) {
      throw new Error("The selected receiving business does not exist.");
    }

    const currentAssignment =
      assignmentId === undefined || assignmentId === null
        ? null
        : assignments.find((assignment) => assignment.id === assignmentId) ?? null;

    if (assignmentId !== undefined && assignmentId !== null && !currentAssignment) {
      throw new Error("The selected round row does not exist.");
    }

    if (
      !isDirectedAssignmentEligible({
        currentAssignmentId: currentAssignment?.id,
        draftState: buildRoundDraftState(assignments),
        enforceExchangeRules: false,
        guestBusinessId,
        hostBusinessId,
        pairedBusinessIdsByBusinessId:
          historicalContext.pairedBusinessIdsByBusinessId,
        roundBusinessesById: selectableBusinessesById,
      })
    ) {
      throw new Error(
        "That draft pairing is blocked by directionality or round capacity.",
      );
    }

    const savedAssignment = currentAssignment
      ? await database.roundAssignment.update({
          data: {
            guestBusinessId,
            hostBusinessId,
            source: "manual",
          },
          where: {
            id: currentAssignment.id,
          },
          select: {
            id: true,
          },
        })
      : await database.roundAssignment.create({
          data: {
            guestBusinessId,
            hostBusinessId,
            roundBatchId,
            source: "manual",
          },
          select: {
            id: true,
          },
        });

    return {
      assignmentId: savedAssignment.id,
      message: currentAssignment
        ? "The round row was updated."
        : "The round row was added.",
    };
  });
}

export async function deleteRoundAssignmentRow(
  params: DeleteRoundAssignmentRowParams,
) {
  const { assignmentId, roundBatchId } = params;

  return withDatabaseRetry(async (database) => {
    const batch = await database.roundBatch.findUnique({
      select: {
        id: true,
        status: true,
      },
      where: {
        id: roundBatchId,
      },
    });

    if (!batch) {
      throw new Error("The selected round draft does not exist.");
    }

    if (batch.status !== "draft") {
      throw new Error("Only draft rounds can be edited.");
    }

    const assignment = await database.roundAssignment.findFirst({
      select: {
        id: true,
      },
      where: {
        id: assignmentId,
        roundBatchId,
      },
    });

    if (!assignment) {
      throw new Error("The selected round row does not exist.");
    }

    await database.roundAssignment.delete({
      where: {
        id: assignment.id,
      },
    });

    return {
      message: "The round row was deleted.",
    };
  });
}

export async function clearRoundBatch(roundBatchId: number) {
  return withDatabaseRetry(async (database) => {
    const batch = await database.roundBatch.findUnique({
      select: {
        id: true,
        sequenceNumber: true,
        status: true,
      },
      where: {
        id: roundBatchId,
      },
    });

    if (!batch) {
      throw new Error("The selected round draft does not exist.");
    }

    if (batch.status !== "draft") {
      throw new Error("Only draft rounds can be cleared.");
    }

    const deletionResult = await database.roundAssignment.deleteMany({
      where: {
        roundBatchId,
      },
    });

    return {
      clearedCount: deletionResult.count,
      roundSequenceNumber: batch.sequenceNumber,
    };
  });
}

export async function deleteRoundBatch(roundBatchId: number) {
  return withDatabaseRetry(async (database) => {
    const batch = await database.roundBatch.findUnique({
      select: {
        _count: {
          select: {
            assignments: true,
            matches: true,
          },
        },
        id: true,
        sequenceNumber: true,
        status: true,
      },
      where: {
        id: roundBatchId,
      },
    });

    if (!batch) {
      throw new Error("The selected round does not exist.");
    }

    await database.roundBatch.delete({
      where: {
        id: roundBatchId,
      },
    });

    return {
      deletedAssignmentCount: batch._count.assignments,
      detachedMatchCount: batch._count.matches,
      roundSequenceNumber: batch.sequenceNumber,
      status: batch.status,
    };
  });
}

export async function applyRoundBatch(roundBatchId: number) {
  return withDatabaseRetry(async (database) => {
    const [batch, assignments] = await Promise.all([
      database.roundBatch.findUnique({
        select: {
          id: true,
          sequenceNumber: true,
          status: true,
        },
        where: {
          id: roundBatchId,
        },
      }),
      database.roundAssignment.findMany({
        select: {
          guestBusinessId: true,
          hostBusinessId: true,
          id: true,
        },
        where: {
          roundBatchId,
        },
      }),
    ]);

    if (!batch) {
      throw new Error("The selected round draft does not exist.");
    }

    if (batch.status !== "draft") {
      throw new Error("This round draft has already been applied.");
    }

    if (assignments.length === 0) {
      throw new Error("The round draft does not contain any assignments to apply.");
    }

    const pairWhereClauses = assignments.flatMap((assignment) => [
      {
        guestId: assignment.guestBusinessId,
        hostId: assignment.hostBusinessId,
      },
      {
        guestId: assignment.hostBusinessId,
        hostId: assignment.guestBusinessId,
      },
    ]);
    const conflictingMatches = await database.match.findMany({
      select: {
        guestId: true,
        hostId: true,
      },
      where: {
        OR: pairWhereClauses,
      },
    });

    if (conflictingMatches.length > 0) {
      throw new Error(
        "One or more round assignments now conflict with an existing match. Refresh the draft before applying it.",
      );
    }

    const creationResult = await database.match.createMany({
      data: assignments.map((assignment) => ({
        guestId: assignment.guestBusinessId,
        hostId: assignment.hostBusinessId,
        roundBatchId,
      })),
      skipDuplicates: true,
    });

    await database.roundBatch.update({
      data: {
        appliedAt: new Date(),
        status: "applied",
      },
      where: {
        id: roundBatchId,
      },
    });

    return {
      appliedCount: creationResult.count,
      roundSequenceNumber: batch.sequenceNumber,
    };
  });
}