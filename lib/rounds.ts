import { cache } from "react";
import type {
  MatchStatus,
  Prisma,
  PrismaClient,
  RoundAssignmentSource,
  RoundBatchStatus,
} from "@/generated/prisma/client";
import { getRoundMatchMethod } from "@/lib/round-match-method";
import { isExchangeParticipationActive } from "@/lib/ai-authority-exchange";
import { getForbiddenBusinessIdsByBusinessIds } from "@/lib/forbidden-business-pairs";
import { prisma, withDatabaseRetry } from "@/lib/prisma";

type RoundDatabaseClient = PrismaClient | Prisma.TransactionClient;

export type RoundApplyConflict = {
  assignmentId: number;
  existingGuestBusiness: string;
  existingHostBusiness: string;
  existingMatchId: number;
  existingRoundSequenceNumber: number | null;
  guestBusiness: string;
  hostBusiness: string;
};

class RoundApplyConflictError extends Error {
  conflicts: RoundApplyConflict[];

  constructor(conflicts: RoundApplyConflict[]) {
    super(
      "One or more round assignments conflict with a match already linked to a different round. Update the draft before applying it.",
    );
    this.name = "RoundApplyConflictError";
    this.conflicts = conflicts;
  }
}

export function isRoundApplyConflictError(
  error: unknown,
): error is RoundApplyConflictError {
  return error instanceof RoundApplyConflictError;
}

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
      name: true,
      sector_id: true,
    },
  },
  business_category_id: true,
  clientType: true,
  description: true,
  domain_rating: true,
  id: true,
  isActiveOnAiAuthorityExchange: true,
  related_category_ids: true,
  subcategory: true,
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

const roundBatchMatchSelect = {
  guest: {
    select: roundBusinessSelect,
  },
  guestId: true,
  host: {
    select: roundBusinessSelect,
  },
  hostId: true,
  id: true,
  interview_published: true,
  interview_sent: true,
  status: true,
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
    name: string | null;
    sector_id: number | null;
  } | null;
  business_category_id: number | null;
  clientType: "client" | "partner" | null;
  description: string | null;
  domain_rating: number | null;
  id: number;
  isActiveOnAiAuthorityExchange: boolean;
  related_category_ids: number[];
  subcategory: string | null;
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
    description: business.description,
    domain_rating: business.domain_rating,
    id: business.id,
    isActiveOnAiAuthorityExchange: isExchangeParticipationActive(business),
    related_category_ids: business.related_category_ids,
    subcategory: business.subcategory,
    websiteUrl: business.websiteUrl,
  };
}

type RawRoundAssignmentRecord = Prisma.RoundAssignmentGetPayload<{
  select: typeof roundAssignmentSelect;
}>;

type RawRoundBatchMatchRecord = Prisma.MatchGetPayload<{
  select: typeof roundBatchMatchSelect;
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
  forbiddenBusinessIdsByBusinessId: Map<number, Set<number>>;
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
  relation: RoundAssignmentRelation;
  score: number;
};

type RoundBusinessRelation =
  | "same-category"
  | "related-category"
  | "same-sector";

type RoundAssignmentRelation = RoundBusinessRelation | "fallback";

type GeneratedRoundAssignments = {
  assignments: Array<{
    guestBusinessId: number;
    hostBusinessId: number;
    source: RoundAssignmentSource;
  }>;
  isComplete: boolean;
  unresolvedBusinessCount: number;
};

type AssignmentSearchState = {
  draftState: RoundDraftState;
  skippedHostBusinessIds: Set<number>;
  selectedAssignments: DraftAssignmentCandidate[];
  totalScore: number;
};

type AssignmentSearchBestResult = {
  assignments: DraftAssignmentCandidate[];
  totalScore: number;
};

const roundBusinessRelationPriority = [
  "same-category",
  "related-category",
  "same-sector",
] as const satisfies readonly RoundBusinessRelation[];

const roundAssignmentRelationPriority = [
  ...roundBusinessRelationPriority,
  "fallback",
] as const satisfies readonly RoundAssignmentRelation[];

const roundAssignmentRelationScore: Record<RoundAssignmentRelation, number> = {
  fallback: 20,
  "related-category": 80,
  "same-category": 100,
  "same-sector": 60,
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
  businessCategoryId: number | null;
  businessCategoryName: string | null;
  description: string | null;
  domainRating: number | null;
  relatedCategoryIds: number[];
  sectorId: number | null;
  subcategory: string | null;
};

export type RoundDraftCell = {
  assignmentId: number;
  businessId: number;
  businessName: string;
  domainRating: number | null;
  matchStatus: MatchStatus | null;
  source: RoundAssignmentSource;
};

export type RoundDraftAssignmentRow = {
  assignmentId: number;
  guestBusiness: RoundDraftOption;
  hostBusiness: RoundDraftOption;
  matchStatus: MatchStatus | null;
  source: RoundAssignmentSource;
};

export type RoundBatchMatchStatusRow = {
  guestBusiness: RoundDraftOption;
  hostBusiness: RoundDraftOption;
  interviewPublished: boolean;
  interviewSent: boolean;
  matchId: number;
  status: MatchStatus | null;
};

export type RoundDraftRow = {
  businessId: number;
  businessName: string;
  domainRating: number | null;
  publishedBy: RoundDraftCell[];
  publishedFor: RoundDraftCell[];
  rowStatus: "complete" | "empty" | "partial";
};

export type RoundBatchView = {
  activeBusinessCount: number;
  assignmentRows: RoundDraftAssignmentRow[];
  batch: RoundBatchSummary | null;
  batches: RoundBatchSummary[];
  forbiddenBusinessIdsByBusinessId: Record<number, number[]>;
  pairedBusinessIdsByBusinessId: Record<number, number[]>;
  matchStatusRows: RoundBatchMatchStatusRow[];
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

function compareBusinesses(
  left: { business: string },
  right: { business: string },
) {
  return businessNameCollator.compare(left.business, right.business);
}

function pairKey(hostBusinessId: number, guestBusinessId: number) {
  return `${hostBusinessId}:${guestBusinessId}`;
}

function formatRoundBatchSummary(
  batch: RoundBatchSummaryRecord,
): RoundBatchSummary {
  return {
    appliedAt: batch.appliedAt?.toISOString() ?? null,
    assignmentCount: batch._count.assignments,
    createdAt: batch.createdAt.toISOString(),
    id: batch.id,
    sequenceNumber: batch.sequenceNumber,
    status: batch.status,
  };
}

function getRoundBusinessRelation(
  hostBusiness: RoundBusiness,
  guestBusiness: RoundBusiness,
): RoundBusinessRelation | null {
  switch (
    getRoundMatchMethod(
      {
        businessCategoryId: hostBusiness.business_category_id,
        relatedCategoryIds: hostBusiness.related_category_ids,
        sectorId: hostBusiness.business_categories?.sector_id ?? null,
        subcategory: hostBusiness.subcategory,
      },
      {
        businessCategoryId: guestBusiness.business_category_id,
        relatedCategoryIds: guestBusiness.related_category_ids,
        sectorId: guestBusiness.business_categories?.sector_id ?? null,
        subcategory: guestBusiness.subcategory,
      },
    )
  ) {
    case "same-subcategory":
    case "same-category":
      return "same-category";
    case "related-category":
      return "related-category";
    case "related-sector":
      return "same-sector";
    default:
      return null;
  }
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
  relation: RoundAssignmentRelation,
) {
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
  const relevanceScore = roundAssignmentRelationScore[relation];
  const domainRatingScore = hostContribution === null ? 0 : 5;
  const proximityScore =
    hostContribution === null ? 0 : -Math.abs(hostContribution) / 100;

  return (
    relevanceScore +
    hostImprovement * 2 +
    guestImprovement * 2 +
    domainRatingScore +
    proximityScore
  );
}

function toForbiddenBusinessIdSetMap(
  forbiddenBusinessIdsByBusinessId: Map<number, number[]>,
) {
  return new Map(
    Array.from(
      forbiddenBusinessIdsByBusinessId.entries(),
      ([businessId, ids]) => [businessId, new Set(ids)],
    ),
  );
}

function serializeForbiddenBusinessIdsByBusinessId(
  forbiddenBusinessIdsByBusinessId: Map<number, number[]>,
) {
  return Object.fromEntries(
    Array.from(
      forbiddenBusinessIdsByBusinessId.entries(),
      ([businessId, ids]) => [businessId, ids],
    ),
  ) as Record<number, number[]>;
}

function serializePairedBusinessIdsByBusinessId(
  pairedBusinessIdsByBusinessId: Map<number, Set<number>>,
) {
  return Object.fromEntries(
    Array.from(pairedBusinessIdsByBusinessId.entries(), ([businessId, ids]) => [
      businessId,
      Array.from(ids),
    ]),
  ) as Record<number, number[]>;
}

function isForbiddenRoundPair(params: {
  forbiddenBusinessIdsByBusinessId: Map<number, Set<number>>;
  guestBusinessId: number;
  hostBusinessId: number;
}) {
  const { forbiddenBusinessIdsByBusinessId, guestBusinessId, hostBusinessId } =
    params;

  return (
    forbiddenBusinessIdsByBusinessId
      .get(hostBusinessId)
      ?.has(guestBusinessId) === true ||
    forbiddenBusinessIdsByBusinessId
      .get(guestBusinessId)
      ?.has(hostBusinessId) === true
  );
}

function isHistoricalRoundPair(params: {
  guestBusinessId: number;
  hostBusinessId: number;
  pairedBusinessIdsByBusinessId: Map<number, Set<number>>;
}) {
  const { guestBusinessId, hostBusinessId, pairedBusinessIdsByBusinessId } =
    params;

  return (
    pairedBusinessIdsByBusinessId.get(hostBusinessId)?.has(guestBusinessId) ===
      true ||
    pairedBusinessIdsByBusinessId.get(guestBusinessId)?.has(hostBusinessId) ===
      true
  );
}

function buildHistoricalContext(
  activeBusinesses: RoundBusiness[],
  forbiddenBusinessIdsByBusinessId: Map<number, Set<number>>,
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

    if (
      match.host.domain_rating !== null &&
      match.guest.domain_rating !== null
    ) {
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
    forbiddenBusinessIdsByBusinessId,
    pairedBusinessIdsByBusinessId,
  };
}

function buildRoundDraftState(
  assignments: RoundAssignmentRecord[],
): RoundDraftState {
  return {
    assignments,
    assignmentByGuestId: new Map(
      assignments.map(
        (assignment) => [assignment.guestBusinessId, assignment] as const,
      ),
    ),
    assignmentByHostId: new Map(
      assignments.map(
        (assignment) => [assignment.hostBusinessId, assignment] as const,
      ),
    ),
    assignmentByPairKey: new Map(
      assignments.map(
        (assignment) =>
          [
            pairKey(assignment.hostBusinessId, assignment.guestBusinessId),
            assignment,
          ] as const,
      ),
    ),
  };
}

function addRoundAssignmentToState(
  draftState: RoundDraftState,
  assignment: RoundAssignmentRecord,
) {
  draftState.assignments.push(assignment);
  draftState.assignmentByHostId.set(assignment.hostBusinessId, assignment);
  draftState.assignmentByGuestId.set(assignment.guestBusinessId, assignment);
  draftState.assignmentByPairKey.set(
    pairKey(assignment.hostBusinessId, assignment.guestBusinessId),
    assignment,
  );
}

function sortDraftAssignmentCandidates(
  candidateAssignments: DraftAssignmentCandidate[],
  roundBusinessesById: Map<number, RoundBusiness>,
) {
  candidateAssignments.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const leftHostBusiness = roundBusinessesById.get(left.hostBusinessId)!;
    const rightHostBusiness = roundBusinessesById.get(right.hostBusinessId)!;
    const hostComparison = compareBusinesses(
      leftHostBusiness,
      rightHostBusiness,
    );

    if (hostComparison !== 0) {
      return hostComparison;
    }

    const leftGuestBusiness = roundBusinessesById.get(left.guestBusinessId)!;
    const rightGuestBusiness = roundBusinessesById.get(right.guestBusinessId)!;
    return compareBusinesses(leftGuestBusiness, rightGuestBusiness);
  });

  return candidateAssignments;
}

function isDirectedAssignmentEligible(params: {
  currentAssignmentId?: number;
  draftState: RoundDraftState;
  enforceExchangeRules?: boolean;
  enforceSingleSlotPerDirection?: boolean;
  forbiddenBusinessIdsByBusinessId: Map<number, Set<number>>;
  guestBusinessId: number;
  hostBusinessId: number;
  pairedBusinessIdsByBusinessId: Map<number, Set<number>>;
  requiredRelation?: RoundAssignmentRelation;
  roundBusinessesById: Map<number, RoundBusiness>;
}) {
  const {
    currentAssignmentId,
    draftState,
    enforceExchangeRules = true,
    enforceSingleSlotPerDirection = false,
    forbiddenBusinessIdsByBusinessId,
    guestBusinessId,
    hostBusinessId,
    pairedBusinessIdsByBusinessId,
    requiredRelation,
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

  const relation = getRoundBusinessRelation(hostBusiness, guestBusiness);
  const assignmentRelation = relation ?? "fallback";

  if (requiredRelation && assignmentRelation !== requiredRelation) {
    return false;
  }

  if (
    isForbiddenRoundPair({
      forbiddenBusinessIdsByBusinessId,
      guestBusinessId,
      hostBusinessId,
    })
  ) {
    return false;
  }

  if (enforceExchangeRules) {
    if (
      !hostBusiness.isActiveOnAiAuthorityExchange ||
      !guestBusiness.isActiveOnAiAuthorityExchange
    ) {
      return false;
    }

    if (!relation && requiredRelation !== "fallback") {
      return false;
    }
  }

  if (
    isHistoricalRoundPair({
      guestBusinessId,
      hostBusinessId,
      pairedBusinessIdsByBusinessId,
    })
  ) {
    return false;
  }

  if (enforceSingleSlotPerDirection) {
    const existingHostAssignment =
      draftState.assignmentByHostId.get(hostBusinessId);

    if (
      existingHostAssignment &&
      existingHostAssignment.id !== currentAssignmentId
    ) {
      return false;
    }

    const existingGuestAssignment =
      draftState.assignmentByGuestId.get(guestBusinessId);

    if (
      existingGuestAssignment &&
      existingGuestAssignment.id !== currentAssignmentId
    ) {
      return false;
    }
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

function buildCandidateAssignmentsForRelation(params: {
  activeBusinesses: RoundBusiness[];
  balanceByBusinessId: Map<number, number | null>;
  forbiddenBusinessIdsByBusinessId: Map<number, Set<number>>;
  pairedBusinessIdsByBusinessId: Map<number, Set<number>>;
  relation: RoundAssignmentRelation;
  roundBusinessesById: Map<number, RoundBusiness>;
}) {
  const {
    activeBusinesses,
    balanceByBusinessId,
    forbiddenBusinessIdsByBusinessId,
    pairedBusinessIdsByBusinessId,
    relation,
    roundBusinessesById,
  } = params;
  const candidateAssignments: DraftAssignmentCandidate[] = [];
  const emptyDraftState = buildRoundDraftState([]);

  for (const hostBusiness of activeBusinesses) {
    for (const guestBusiness of activeBusinesses) {
      if (
        !isDirectedAssignmentEligible({
          draftState: emptyDraftState,
          forbiddenBusinessIdsByBusinessId,
          guestBusinessId: guestBusiness.id,
          hostBusinessId: hostBusiness.id,
          pairedBusinessIdsByBusinessId,
          requiredRelation: relation,
          roundBusinessesById,
        })
      ) {
        continue;
      }

      candidateAssignments.push({
        guestBusinessId: guestBusiness.id,
        hostBusinessId: hostBusiness.id,
        relation,
        score: getDraftCandidateScore(
          hostBusiness,
          guestBusiness,
          balanceByBusinessId,
          relation,
        ),
      });
    }
  }

  return sortDraftAssignmentCandidates(
    candidateAssignments,
    roundBusinessesById,
  );
}

function buildCandidateAssignmentsByHostId(params: {
  activeBusinesses: RoundBusiness[];
  balanceByBusinessId: Map<number, number | null>;
  forbiddenBusinessIdsByBusinessId: Map<number, Set<number>>;
  pairedBusinessIdsByBusinessId: Map<number, Set<number>>;
  relationPriority: readonly RoundAssignmentRelation[];
}) {
  const {
    activeBusinesses,
    balanceByBusinessId,
    forbiddenBusinessIdsByBusinessId,
    pairedBusinessIdsByBusinessId,
    relationPriority,
  } = params;
  const roundBusinessesById = new Map(
    activeBusinesses.map((business) => [business.id, business] as const),
  );
  const candidateAssignmentsByHostId = new Map<
    number,
    DraftAssignmentCandidate[]
  >();

  for (const relation of relationPriority) {
    const candidateAssignments = buildCandidateAssignmentsForRelation({
      activeBusinesses,
      balanceByBusinessId,
      forbiddenBusinessIdsByBusinessId,
      pairedBusinessIdsByBusinessId,
      relation,
      roundBusinessesById,
    });

    for (const candidateAssignment of candidateAssignments) {
      const hostCandidates =
        candidateAssignmentsByHostId.get(candidateAssignment.hostBusinessId) ??
        [];

      hostCandidates.push(candidateAssignment);
      candidateAssignmentsByHostId.set(
        candidateAssignment.hostBusinessId,
        hostCandidates,
      );
    }
  }

  return {
    candidateAssignmentsByHostId,
    roundBusinessesById,
  };
}

function toDraftAssignmentRecord(
  candidateAssignment: DraftAssignmentCandidate,
  roundBusinessesById: Map<number, RoundBusiness>,
  index: number,
): RoundAssignmentRecord {
  const hostBusiness = roundBusinessesById.get(
    candidateAssignment.hostBusinessId,
  )!;
  const guestBusiness = roundBusinessesById.get(
    candidateAssignment.guestBusinessId,
  )!;

  return {
    createdAt: new Date(0),
    guestBusiness,
    guestBusinessId: guestBusiness.id,
    hostBusiness,
    hostBusinessId: hostBusiness.id,
    id: index * -1 - 1,
    roundBatchId: 0,
    source: "auto",
    updatedAt: new Date(0),
  } satisfies RoundAssignmentRecord;
}

function selectNextHostBusinessId(params: {
  activeBusinesses: RoundBusiness[];
  candidateAssignmentsByHostId: Map<number, DraftAssignmentCandidate[]>;
  draftState: RoundDraftState;
  forbiddenBusinessIdsByBusinessId: Map<number, Set<number>>;
  pairedBusinessIdsByBusinessId: Map<number, Set<number>>;
  roundBusinessesById: Map<number, RoundBusiness>;
  skippedHostBusinessIds: Set<number>;
}) {
  const {
    activeBusinesses,
    candidateAssignmentsByHostId,
    draftState,
    forbiddenBusinessIdsByBusinessId,
    pairedBusinessIdsByBusinessId,
    roundBusinessesById,
    skippedHostBusinessIds,
  } = params;
  let selectedHostBusinessId: number | null = null;
  let selectedCandidateCount = Number.POSITIVE_INFINITY;

  for (const business of activeBusinesses) {
    if (
      draftState.assignmentByHostId.has(business.id) ||
      skippedHostBusinessIds.has(business.id)
    ) {
      continue;
    }

    const candidateCount = (
      candidateAssignmentsByHostId.get(business.id) ?? []
    ).filter((candidateAssignment) =>
      isDirectedAssignmentEligible({
        draftState,
        enforceSingleSlotPerDirection: true,
        forbiddenBusinessIdsByBusinessId,
        guestBusinessId: candidateAssignment.guestBusinessId,
        hostBusinessId: candidateAssignment.hostBusinessId,
        pairedBusinessIdsByBusinessId,
        requiredRelation: candidateAssignment.relation,
        roundBusinessesById,
      }),
    ).length;

    if (candidateCount < selectedCandidateCount) {
      selectedHostBusinessId = business.id;
      selectedCandidateCount = candidateCount;

      if (candidateCount === 0) {
        break;
      }
    }
  }

  return selectedHostBusinessId;
}

function searchRoundAssignments(params: {
  activeBusinesses: RoundBusiness[];
  candidateAssignmentsByHostId: Map<number, DraftAssignmentCandidate[]>;
  forbiddenBusinessIdsByBusinessId: Map<number, Set<number>>;
  pairedBusinessIdsByBusinessId: Map<number, Set<number>>;
  requireCompleteCoverage: boolean;
  roundBusinessesById: Map<number, RoundBusiness>;
}) {
  const {
    activeBusinesses,
    candidateAssignmentsByHostId,
    forbiddenBusinessIdsByBusinessId,
    pairedBusinessIdsByBusinessId,
    requireCompleteCoverage,
    roundBusinessesById,
  } = params;
  let bestResult: AssignmentSearchBestResult = {
    assignments: [],
    totalScore: Number.NEGATIVE_INFINITY,
  };

  const searchState: AssignmentSearchState = {
    draftState: buildRoundDraftState([]),
    skippedHostBusinessIds: new Set<number>(),
    selectedAssignments: [],
    totalScore: 0,
  };

  function commitBestResult() {
    if (
      searchState.selectedAssignments.length > bestResult.assignments.length ||
      (searchState.selectedAssignments.length ===
        bestResult.assignments.length &&
        searchState.totalScore > bestResult.totalScore)
    ) {
      bestResult = {
        assignments: [...searchState.selectedAssignments],
        totalScore: searchState.totalScore,
      };
    }
  }

  function visit() {
    if (
      !requireCompleteCoverage &&
      searchState.selectedAssignments.length +
        (activeBusinesses.length -
          searchState.draftState.assignmentByHostId.size -
          searchState.skippedHostBusinessIds.size) <=
        bestResult.assignments.length
    ) {
      return false;
    }

    if (
      searchState.draftState.assignmentByHostId.size +
        searchState.skippedHostBusinessIds.size ===
      activeBusinesses.length
    ) {
      commitBestResult();
      return searchState.selectedAssignments.length === activeBusinesses.length;
    }

    const nextHostBusinessId = selectNextHostBusinessId({
      activeBusinesses,
      candidateAssignmentsByHostId,
      draftState: searchState.draftState,
      forbiddenBusinessIdsByBusinessId,
      pairedBusinessIdsByBusinessId,
      roundBusinessesById,
      skippedHostBusinessIds: searchState.skippedHostBusinessIds,
    });

    if (nextHostBusinessId === null) {
      commitBestResult();
      return false;
    }

    const availableCandidates = (
      candidateAssignmentsByHostId.get(nextHostBusinessId) ?? []
    ).filter((candidateAssignment) =>
      isDirectedAssignmentEligible({
        draftState: searchState.draftState,
        enforceSingleSlotPerDirection: true,
        forbiddenBusinessIdsByBusinessId,
        guestBusinessId: candidateAssignment.guestBusinessId,
        hostBusinessId: candidateAssignment.hostBusinessId,
        pairedBusinessIdsByBusinessId,
        requiredRelation: candidateAssignment.relation,
        roundBusinessesById,
      }),
    );

    if (availableCandidates.length === 0) {
      if (requireCompleteCoverage) {
        return false;
      }

      searchState.skippedHostBusinessIds.add(nextHostBusinessId);
      visit();
      searchState.skippedHostBusinessIds.delete(nextHostBusinessId);
      return false;
    }

    for (const candidateAssignment of availableCandidates) {
      const nextAssignment = toDraftAssignmentRecord(
        candidateAssignment,
        roundBusinessesById,
        searchState.selectedAssignments.length,
      );

      addRoundAssignmentToState(searchState.draftState, nextAssignment);
      searchState.selectedAssignments.push(candidateAssignment);
      searchState.totalScore += candidateAssignment.score;

      const completed = visit();

      searchState.totalScore -= candidateAssignment.score;
      searchState.selectedAssignments.pop();
      searchState.draftState.assignments.pop();
      searchState.draftState.assignmentByHostId.delete(
        nextAssignment.hostBusinessId,
      );
      searchState.draftState.assignmentByGuestId.delete(
        nextAssignment.guestBusinessId,
      );
      searchState.draftState.assignmentByPairKey.delete(
        pairKey(nextAssignment.hostBusinessId, nextAssignment.guestBusinessId),
      );

      if (completed && requireCompleteCoverage) {
        return true;
      }
    }

    if (!requireCompleteCoverage) {
      searchState.skippedHostBusinessIds.add(nextHostBusinessId);
      visit();
      searchState.skippedHostBusinessIds.delete(nextHostBusinessId);
      commitBestResult();
    }

    return false;
  }

  visit();

  return {
    assignments: bestResult.assignments,
    isComplete: bestResult.assignments.length === activeBusinesses.length,
  };
}

function countUnresolvedBusinesses(params: {
  activeBusinesses: RoundBusiness[];
  assignments: DraftAssignmentCandidate[];
}) {
  const { activeBusinesses, assignments } = params;
  const hostBusinessIds = new Set(
    assignments.map((assignment) => assignment.hostBusinessId),
  );
  const guestBusinessIds = new Set(
    assignments.map((assignment) => assignment.guestBusinessId),
  );

  return activeBusinesses.filter(
    (business) =>
      !hostBusinessIds.has(business.id) || !guestBusinessIds.has(business.id),
  ).length;
}

function buildAutomaticRoundAssignments(params: {
  activeBusinesses: RoundBusiness[];
  balanceByBusinessId: Map<number, number | null>;
  forbiddenBusinessIdsByBusinessId: Map<number, Set<number>>;
  pairedBusinessIdsByBusinessId: Map<number, Set<number>>;
}) {
  const {
    activeBusinesses,
    balanceByBusinessId,
    forbiddenBusinessIdsByBusinessId,
    pairedBusinessIdsByBusinessId,
  } = params;
  const standardCandidates = buildCandidateAssignmentsByHostId({
    activeBusinesses,
    balanceByBusinessId,
    forbiddenBusinessIdsByBusinessId,
    pairedBusinessIdsByBusinessId,
    relationPriority: roundBusinessRelationPriority,
  });
  const standardSearchResult = searchRoundAssignments({
    activeBusinesses,
    candidateAssignmentsByHostId:
      standardCandidates.candidateAssignmentsByHostId,
    forbiddenBusinessIdsByBusinessId,
    pairedBusinessIdsByBusinessId,
    requireCompleteCoverage: true,
    roundBusinessesById: standardCandidates.roundBusinessesById,
  });

  if (standardSearchResult.isComplete) {
    return {
      assignments: standardSearchResult.assignments.map((assignment) => ({
        guestBusinessId: assignment.guestBusinessId,
        hostBusinessId: assignment.hostBusinessId,
        source: "auto" as const,
      })),
      isComplete: true,
      unresolvedBusinessCount: 0,
    } satisfies GeneratedRoundAssignments;
  }

  const fallbackCandidates = buildCandidateAssignmentsByHostId({
    activeBusinesses,
    balanceByBusinessId,
    forbiddenBusinessIdsByBusinessId,
    pairedBusinessIdsByBusinessId,
    relationPriority: roundAssignmentRelationPriority,
  });
  const fallbackSearchResult = searchRoundAssignments({
    activeBusinesses,
    candidateAssignmentsByHostId:
      fallbackCandidates.candidateAssignmentsByHostId,
    forbiddenBusinessIdsByBusinessId,
    pairedBusinessIdsByBusinessId,
    requireCompleteCoverage: false,
    roundBusinessesById: fallbackCandidates.roundBusinessesById,
  });

  return {
    assignments: fallbackSearchResult.assignments.map((assignment) => ({
      guestBusinessId: assignment.guestBusinessId,
      hostBusinessId: assignment.hostBusinessId,
      source: "auto" as const,
    })),
    isComplete: fallbackSearchResult.isComplete,
    unresolvedBusinessCount: countUnresolvedBusinesses({
      activeBusinesses,
      assignments: fallbackSearchResult.assignments,
    }),
  } satisfies GeneratedRoundAssignments;
}

function toRoundDraftOption(business: RoundBusiness): RoundDraftOption {
  return {
    businessId: business.id,
    businessName: business.business,
    businessCategoryId: business.business_category_id,
    businessCategoryName: business.business_categories?.name ?? null,
    description: business.description,
    domainRating: business.domain_rating,
    relatedCategoryIds: business.related_category_ids,
    sectorId: business.business_categories?.sector_id ?? null,
    subcategory: business.subcategory,
  };
}

function toRoundDraftCell(
  assignment: RoundAssignmentRecord,
  direction: "publishedBy" | "publishedFor",
  matchStatus: MatchStatus | null,
): RoundDraftCell {
  const counterpartBusiness =
    direction === "publishedBy"
      ? assignment.hostBusiness
      : assignment.guestBusiness;

  return {
    assignmentId: assignment.id,
    businessId: counterpartBusiness.id,
    businessName: counterpartBusiness.business,
    domainRating: counterpartBusiness.domain_rating,
    matchStatus,
    source: assignment.source,
  };
}

function toRoundDraftAssignmentRow(
  assignment: RoundAssignmentRecord,
  matchStatus: MatchStatus | null,
): RoundDraftAssignmentRow {
  return {
    assignmentId: assignment.id,
    guestBusiness: toRoundDraftOption(assignment.guestBusiness),
    hostBusiness: toRoundDraftOption(assignment.hostBusiness),
    matchStatus,
    source: assignment.source,
  };
}

function toRoundBatchMatchStatusRow(
  match: RawRoundBatchMatchRecord,
): RoundBatchMatchStatusRow {
  return {
    guestBusiness: toRoundDraftOption(toRoundBusiness(match.guest)),
    hostBusiness: toRoundDraftOption(toRoundBusiness(match.host)),
    interviewPublished: match.interview_published ?? false,
    interviewSent: match.interview_sent ?? false,
    matchId: match.id,
    status: match.status ?? null,
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

function getDisplayedBusinessesForBatch(
  activeBusinesses: RoundBusiness[],
  assignments: RoundAssignmentRecord[],
  status: RoundBatchStatus,
) {
  if (status !== "draft") {
    return getBusinessesRepresentedInAssignments(assignments);
  }

  const businessesById = new Map<number, RoundBusiness>();

  for (const business of activeBusinesses) {
    businessesById.set(business.id, business);
  }

  for (const assignment of assignments) {
    businessesById.set(assignment.hostBusiness.id, assignment.hostBusiness);
    businessesById.set(assignment.guestBusiness.id, assignment.guestBusiness);
  }

  return Array.from(businessesById.values()).toSorted(compareBusinesses);
}

async function getActiveRoundBusinessesFromDatabase(
  database: RoundDatabaseClient = prisma,
) {
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

  return businesses
    .map((business) => toRoundBusiness(business))
    .toSorted(compareBusinesses);
}

async function getSelectableRoundBusinessesFromDatabase(
  database: RoundDatabaseClient = prisma,
) {
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

  return businesses
    .map((business) => toRoundBusiness(business))
    .toSorted(compareBusinesses);
}

async function getHistoricalMatchesForBusinesses(
  database: RoundDatabaseClient,
  businessIds: number[],
  excludedRoundBatchId?: number,
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
      ...(excludedRoundBatchId === undefined
        ? {}
        : {
            NOT: {
              roundBatchId: excludedRoundBatchId,
            },
          }),
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
  database: RoundDatabaseClient = prisma,
) {
  const [batch, activeBusinesses, selectableBusinesses, assignments] =
    await Promise.all([
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
    roundBatchId,
  );
  const forbiddenBusinessIdsByBusinessId =
    await getForbiddenBusinessIdsByBusinessIds(
      selectableBusinesses.map((business) => business.id),
      database,
    );
  const historicalContext = buildHistoricalContext(
    activeBusinesses,
    toForbiddenBusinessIdSetMap(forbiddenBusinessIdsByBusinessId),
    historicalMatches,
  );

  return {
    activeBusinesses,
    assignments: assignments.map((assignment) =>
      toRoundAssignmentRecord(assignment),
    ),
    batch,
    forbiddenBusinessIdsByBusinessId,
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

async function getNextRoundSequenceNumber(database: RoundDatabaseClient) {
  const aggregateResult = await database.roundBatch.aggregate({
    _max: {
      sequenceNumber: true,
    },
  });

  return (aggregateResult._max.sequenceNumber ?? 0) + 1;
}

async function getLatestRoundBatch(database: RoundDatabaseClient) {
  return database.roundBatch.findFirst({
    orderBy: {
      sequenceNumber: "desc",
    },
    select: {
      id: true,
      sequenceNumber: true,
      status: true,
    },
  });
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
      forbiddenBusinessIdsByBusinessId: {},
      pairedBusinessIdsByBusinessId: {},
      matchStatusRows: [],
      rows: activeBusinesses.map((business) => ({
        businessId: business.id,
        businessName: business.business,
        domainRating: business.domain_rating,
        publishedBy: [],
        publishedFor: [],
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
      : (batches.find((batch) => batch.sequenceNumber === requestedBatchId) ??
        batches.find((batch) => batch.id === requestedBatchId))) ?? batches[0];
  const [
    { assignments, forbiddenBusinessIdsByBusinessId, historicalContext },
    roundBatchMatches,
  ] = await Promise.all([
    getRoundManagementContext(selectedBatch.id),
    prisma.match.findMany({
      select: roundBatchMatchSelect,
      where: {
        roundBatchId: selectedBatch.id,
      },
    }),
  ]);
  const assignmentPairKeys = new Set(
    assignments.map((assignment) =>
      pairKey(assignment.hostBusinessId, assignment.guestBusinessId),
    ),
  );
  const visibleRoundBatchMatches =
    selectedBatch.status === "draft"
      ? roundBatchMatches.filter((match) =>
          assignmentPairKeys.has(pairKey(match.hostId, match.guestId)),
        )
      : roundBatchMatches;
  const matchStatusByPairKey = new Map(
    visibleRoundBatchMatches.map(
      (match) =>
        [pairKey(match.hostId, match.guestId), match.status ?? null] as const,
    ),
  );
  const matchStatusRows = visibleRoundBatchMatches
    .map((match) => toRoundBatchMatchStatusRow(match))
    .toSorted((left, right) => {
      const guestComparison = businessNameCollator.compare(
        left.guestBusiness.businessName,
        right.guestBusiness.businessName,
      );

      if (guestComparison !== 0) {
        return guestComparison;
      }

      return businessNameCollator.compare(
        left.hostBusiness.businessName,
        right.hostBusiness.businessName,
      );
    });
  const displayedBusinesses = getDisplayedBusinessesForBatch(
    activeBusinesses,
    assignments,
    selectedBatch.status,
  );
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
    .map((assignment) =>
      toRoundDraftAssignmentRow(
        assignment,
        matchStatusByPairKey.get(
          pairKey(assignment.hostBusinessId, assignment.guestBusinessId),
        ) ?? null,
      ),
    );
  const rowsByBusinessId = new Map<number, RoundDraftRow>(
    displayedBusinesses.map((business) => [
      business.id,
      {
        businessId: business.id,
        businessName: business.business,
        domainRating: business.domain_rating,
        publishedBy: [],
        publishedFor: [],
        rowStatus: "empty" as const,
      } satisfies RoundDraftRow,
    ]),
  );

  for (const assignment of assignments) {
    const matchStatus =
      matchStatusByPairKey.get(
        pairKey(assignment.hostBusinessId, assignment.guestBusinessId),
      ) ?? null;

    rowsByBusinessId
      .get(assignment.guestBusinessId)
      ?.publishedBy.push(
        toRoundDraftCell(assignment, "publishedBy", matchStatus),
      );
    rowsByBusinessId
      .get(assignment.hostBusinessId)
      ?.publishedFor.push(
        toRoundDraftCell(assignment, "publishedFor", matchStatus),
      );
  }

  const rows = displayedBusinesses.map((business) => {
    const row = rowsByBusinessId.get(business.id)!;

    row.publishedBy.sort((left, right) =>
      businessNameCollator.compare(left.businessName, right.businessName),
    );
    row.publishedFor.sort((left, right) =>
      businessNameCollator.compare(left.businessName, right.businessName),
    );

    row.rowStatus =
      row.publishedBy.length === 0 && row.publishedFor.length === 0
        ? "empty"
        : row.publishedBy.length === 0 || row.publishedFor.length === 0
          ? "partial"
          : "complete";

    return row;
  });
  const unresolvedBusinessCount = rows.filter(
    (row) => row.rowStatus !== "complete",
  ).length;

  return {
    activeBusinessCount: assignmentRows.length + unresolvedBusinessCount,
    assignmentRows,
    batch: selectedBatch,
    batches,
    forbiddenBusinessIdsByBusinessId: serializeForbiddenBusinessIdsByBusinessId(
      forbiddenBusinessIdsByBusinessId,
    ),
    pairedBusinessIdsByBusinessId: serializePairedBusinessIdsByBusinessId(
      historicalContext.pairedBusinessIdsByBusinessId,
    ),
    matchStatusRows,
    rows,
    selectableBusinesses: selectableBusinesses.map((business) =>
      toRoundDraftOption(business),
    ),
    unresolvedBusinessCount,
  } satisfies RoundBatchView;
});

export async function createRoundDraftBatch() {
  return withDatabaseRetry(async (database) => {
    return database.$transaction(async (transaction) => {
      const latestBatch = await getLatestRoundBatch(transaction);

      if (latestBatch?.status === "draft") {
        throw new Error(
          `Round ${latestBatch.sequenceNumber} is still a draft. Apply or delete it before creating a new round.`,
        );
      }

      const activeBusinesses =
        await getActiveRoundBusinessesFromDatabase(transaction);

      if (activeBusinesses.length === 0) {
        throw new Error(
          "No businesses are active in the AI Authority Exchange yet.",
        );
      }

      const nextSequenceNumber = await getNextRoundSequenceNumber(transaction);
      const batch = await transaction.roundBatch.create({
        data: {
          sequenceNumber: nextSequenceNumber,
        },
        select: {
          id: true,
          sequenceNumber: true,
        },
      });

      const historicalMatches = await getHistoricalMatchesForBusinesses(
        transaction,
        activeBusinesses.map((business) => business.id),
      );
      const forbiddenBusinessIdsByBusinessId =
        await getForbiddenBusinessIdsByBusinessIds(
          activeBusinesses.map((business) => business.id),
          transaction,
        );
      const historicalContext = buildHistoricalContext(
        activeBusinesses,
        toForbiddenBusinessIdSetMap(forbiddenBusinessIdsByBusinessId),
        historicalMatches,
      );
      const generationResult = buildAutomaticRoundAssignments({
        activeBusinesses,
        balanceByBusinessId: historicalContext.balanceByBusinessId,
        forbiddenBusinessIdsByBusinessId:
          historicalContext.forbiddenBusinessIdsByBusinessId,
        pairedBusinessIdsByBusinessId:
          historicalContext.pairedBusinessIdsByBusinessId,
      });

      if (generationResult.assignments.length > 0) {
        await transaction.roundAssignment.createMany({
          data: generationResult.assignments.map((assignment) => ({
            guestBusinessId: assignment.guestBusinessId,
            hostBusinessId: assignment.hostBusinessId,
            roundBatchId: batch.id,
            source: assignment.source,
          })),
        });
      }

      return {
        activeBusinessCount: activeBusinesses.length,
        assignmentCount: generationResult.assignments.length,
        id: batch.id,
        isComplete: generationResult.isComplete,
        unresolvedBusinessCount: generationResult.unresolvedBusinessCount,
        sequenceNumber: batch.sequenceNumber,
      };
    });
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

    const activeBusinesses =
      await getActiveRoundBusinessesFromDatabase(database);

    if (activeBusinesses.length === 0) {
      throw new Error(
        "No businesses are active in the AI Authority Exchange yet.",
      );
    }

    const historicalMatches = await getHistoricalMatchesForBusinesses(
      database,
      activeBusinesses.map((business) => business.id),
    );
    const forbiddenBusinessIdsByBusinessId =
      await getForbiddenBusinessIdsByBusinessIds(
        activeBusinesses.map((business) => business.id),
        database,
      );
    const historicalContext = buildHistoricalContext(
      activeBusinesses,
      toForbiddenBusinessIdSetMap(forbiddenBusinessIdsByBusinessId),
      historicalMatches,
    );
    const generationResult = buildAutomaticRoundAssignments({
      activeBusinesses,
      balanceByBusinessId: historicalContext.balanceByBusinessId,
      forbiddenBusinessIdsByBusinessId:
        historicalContext.forbiddenBusinessIdsByBusinessId,
      pairedBusinessIdsByBusinessId:
        historicalContext.pairedBusinessIdsByBusinessId,
    });

    if (generationResult.assignments.length > 0) {
      await database.roundAssignment.createMany({
        data: generationResult.assignments.map((assignment) => ({
          guestBusinessId: assignment.guestBusinessId,
          hostBusinessId: assignment.hostBusinessId,
          roundBatchId,
          source: assignment.source,
        })),
      });
    }

    return {
      activeBusinessCount: activeBusinesses.length,
      assignmentCount: generationResult.assignments.length,
      id: batch.id,
      isComplete: generationResult.isComplete,
      unresolvedBusinessCount: generationResult.unresolvedBusinessCount,
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
        ? (draftState.assignmentByHostId.get(businessId) ?? null)
        : (draftState.assignmentByGuestId.get(businessId) ?? null);

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
      isForbiddenRoundPair({
        forbiddenBusinessIdsByBusinessId:
          historicalContext.forbiddenBusinessIdsByBusinessId,
        guestBusinessId,
        hostBusinessId,
      })
    ) {
      throw new Error(
        "That draft pairing is blocked because this business pair is forbidden.",
      );
    }

    if (
      isHistoricalRoundPair({
        guestBusinessId,
        hostBusinessId,
        pairedBusinessIdsByBusinessId:
          historicalContext.pairedBusinessIdsByBusinessId,
      })
    ) {
      throw new Error(
        "That draft pairing is blocked because these businesses already matched in a previous round.",
      );
    }

    if (
      !isDirectedAssignmentEligible({
        currentAssignmentId: currentAssignment?.id,
        draftState,
        enforceExchangeRules: false,
        forbiddenBusinessIdsByBusinessId:
          historicalContext.forbiddenBusinessIdsByBusinessId,
        guestBusinessId,
        hostBusinessId,
        pairedBusinessIdsByBusinessId:
          historicalContext.pairedBusinessIdsByBusinessId,
        roundBusinessesById: selectableBusinessesById,
      })
    ) {
      throw new Error(
        "That draft pairing is blocked by directionality or duplication.",
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
  const { assignmentId, guestBusinessId, hostBusinessId, roundBatchId } =
    params;

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
        : (assignments.find((assignment) => assignment.id === assignmentId) ??
          null);

    if (
      assignmentId !== undefined &&
      assignmentId !== null &&
      !currentAssignment
    ) {
      throw new Error("The selected round row does not exist.");
    }

    if (
      isForbiddenRoundPair({
        forbiddenBusinessIdsByBusinessId:
          historicalContext.forbiddenBusinessIdsByBusinessId,
        guestBusinessId,
        hostBusinessId,
      })
    ) {
      throw new Error(
        "That draft pairing is blocked because this business pair is forbidden.",
      );
    }

    if (
      isHistoricalRoundPair({
        guestBusinessId,
        hostBusinessId,
        pairedBusinessIdsByBusinessId:
          historicalContext.pairedBusinessIdsByBusinessId,
      })
    ) {
      throw new Error(
        "That draft pairing is blocked because these businesses already matched in a previous round.",
      );
    }

    if (
      !isDirectedAssignmentEligible({
        currentAssignmentId: currentAssignment?.id,
        draftState: buildRoundDraftState(assignments),
        enforceExchangeRules: false,
        forbiddenBusinessIdsByBusinessId:
          historicalContext.forbiddenBusinessIdsByBusinessId,
        guestBusinessId,
        hostBusinessId,
        pairedBusinessIdsByBusinessId:
          historicalContext.pairedBusinessIdsByBusinessId,
        roundBusinessesById: selectableBusinessesById,
      })
    ) {
      throw new Error(
        "That draft pairing is blocked by directionality or duplication.",
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

    const [deletedMatches, deletionResult] = await database.$transaction([
      database.match.deleteMany({
        where: {
          roundBatchId,
        },
      }),
      database.roundAssignment.deleteMany({
        where: {
          roundBatchId,
        },
      }),
    ]);

    return {
      clearedCount: deletionResult.count,
      deletedMatchCount: deletedMatches.count,
      roundSequenceNumber: batch.sequenceNumber,
    };
  });
}

export async function reopenRoundBatch(roundBatchId: number) {
  return withDatabaseRetry(async (database) => {
    const [batch, latestBatch] = await Promise.all([
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
      getLatestRoundBatch(database),
    ]);

    if (!batch) {
      throw new Error("The selected round does not exist.");
    }

    if (batch.status === "draft") {
      throw new Error("This round is already open as a draft.");
    }

    if (latestBatch?.id !== batch.id) {
      throw new Error("Only the latest round can be moved back to draft.");
    }

    await database.roundBatch.update({
      data: {
        status: "draft",
      },
      where: {
        id: roundBatchId,
      },
    });

    return {
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

    const deletedMatches = await database.match.deleteMany({
      where: {
        roundBatchId,
      },
    });

    await database.roundBatch.delete({
      where: {
        id: roundBatchId,
      },
    });

    return {
      deletedAssignmentCount: batch._count.assignments,
      deletedMatchCount: deletedMatches.count,
      roundSequenceNumber: batch.sequenceNumber,
      status: batch.status,
    };
  });
}

export async function applyRoundBatch(roundBatchId: number) {
  return withDatabaseRetry(async (database) => {
    return database.$transaction(async (transaction) => {
      const [batch, assignments, currentBatchMatches] = await Promise.all([
        transaction.roundBatch.findUnique({
          select: {
            id: true,
            sequenceNumber: true,
            status: true,
          },
          where: {
            id: roundBatchId,
          },
        }),
        transaction.roundAssignment.findMany({
          select: {
            guestBusiness: {
              select: {
                business: true,
              },
            },
            guestBusinessId: true,
            hostBusiness: {
              select: {
                business: true,
              },
            },
            hostBusinessId: true,
            id: true,
          },
          where: {
            roundBatchId,
          },
        }),
        transaction.match.findMany({
          select: {
            guestId: true,
            hostId: true,
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
        throw new Error(
          "This round must be moved back to draft before it can be applied.",
        );
      }

      if (assignments.length === 0) {
        throw new Error(
          "The round draft does not contain any assignments to apply.",
        );
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
      const conflictingMatches = await transaction.match.findMany({
        select: {
          guest: {
            select: {
              business: true,
            },
          },
          guestId: true,
          host: {
            select: {
              business: true,
            },
          },
          hostId: true,
          id: true,
          roundBatch: {
            select: {
              sequenceNumber: true,
            },
          },
        },
        where: {
          NOT: {
            roundBatchId,
          },
          OR: pairWhereClauses,
        },
      });

      if (conflictingMatches.length > 0) {
        const conflicts = assignments.flatMap((assignment) =>
          conflictingMatches
            .filter(
              (match) =>
                (match.hostId === assignment.hostBusinessId &&
                  match.guestId === assignment.guestBusinessId) ||
                (match.hostId === assignment.guestBusinessId &&
                  match.guestId === assignment.hostBusinessId),
            )
            .map((match) => ({
              assignmentId: assignment.id,
              existingGuestBusiness: match.guest.business,
              existingHostBusiness: match.host.business,
              existingMatchId: match.id,
              existingRoundSequenceNumber:
                match.roundBatch?.sequenceNumber ?? null,
              guestBusiness: assignment.guestBusiness.business,
              hostBusiness: assignment.hostBusiness.business,
            })),
        );

        throw new RoundApplyConflictError(conflicts);
      }

      const assignmentPairKeys = new Set(
        assignments.map((assignment) =>
          pairKey(assignment.hostBusinessId, assignment.guestBusinessId),
        ),
      );
      const currentBatchMatchesByPairKey = new Map(
        currentBatchMatches.map((match) => [
          pairKey(match.hostId, match.guestId),
          match,
        ]),
      );
      const matchesToDelete = currentBatchMatches.filter(
        (match) => !assignmentPairKeys.has(pairKey(match.hostId, match.guestId)),
      );
      const matchesToCreate = assignments.filter(
        (assignment) =>
          !currentBatchMatchesByPairKey.has(
            pairKey(assignment.hostBusinessId, assignment.guestBusinessId),
          ),
      );

      if (matchesToDelete.length > 0) {
        await transaction.match.deleteMany({
          where: {
            id: {
              in: matchesToDelete.map((match) => match.id),
            },
          },
        });
      }

      if (matchesToCreate.length > 0) {
        await transaction.match.createMany({
          data: matchesToCreate.map((assignment) => ({
            guestId: assignment.guestBusinessId,
            hostId: assignment.hostBusinessId,
            roundBatchId,
          })),
        });
      }

      await transaction.roundBatch.update({
        data: {
          appliedAt: new Date(),
          status: "applied",
        },
        where: {
          id: roundBatchId,
        },
      });

      return {
        appliedCount: assignments.length,
        roundSequenceNumber: batch.sequenceNumber,
      };
    });
  });
}
