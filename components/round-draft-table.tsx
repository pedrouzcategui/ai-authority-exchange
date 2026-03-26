"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionTooltip, PlusIcon, TrashIcon } from "@/components/action-icons";
import {
  RoundBusinessCombobox,
  type RoundBusinessComboboxOption,
} from "@/components/round-business-combobox";
import { CreateEmailDraftButton } from "@/components/create-email-draft-button";
import { CreateRoundEmailDraftsButton } from "@/components/create-round-email-drafts-button";
import type {
  RoundAssignmentSource,
  RoundBatchStatus,
} from "@/generated/prisma/client";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { getBusinessProfileHref } from "@/lib/business-profile-route";
import {
  getRoundEmailDraftBlockedReason,
  type RoundDraftPlacementStatus,
} from "@/lib/round-email-draft-eligibility";
import { setRoundEditorBusy } from "@/lib/rounds-editor-busy";
import {
  getRoundMatchMethod,
  type RoundMatchMethod,
} from "@/lib/round-match-method";
import type {
  RoundDraftAssignmentRow,
  RoundDraftOption,
  RoundDraftRow,
} from "@/lib/rounds";

type RoundDraftTableProps = {
  assignmentRows: RoundDraftAssignmentRow[];
  canDeleteAssignments: boolean;
  forbiddenBusinessIdsByBusinessId: Record<number, number[]>;
  pairedBusinessIdsByBusinessId: Record<number, number[]>;
  roundBatchId: number;
  roundSequenceNumber: number | null;
  rows: RoundDraftRow[];
  roundStatus: RoundBatchStatus;
  selectableBusinesses: RoundDraftOption[];
  unresolvedBusinessCount: number;
};

type EditableAssignmentRow = {
  assignmentId: number | null;
  clientId: string;
  guestBusinessId: string;
  hostBusinessId: string;
  source: RoundAssignmentSource;
};

type DeleteConfirmationState = {
  clientId: string;
  description: string;
  title: string;
};

type DraftOverviewRow = {
  businessId: number;
  businessName: string;
  domainRating: number | null;
  hasOutsideTaxonomy: boolean;
  publishedForDraftTargets: RoundDraftRow["publishedFor"];
  publishedByRows: EditableAssignmentRow[];
  publishedForRows: EditableAssignmentRow[];
  rowStatus: RoundDraftRow["rowStatus"];
};

type PlacementFilter =
  | "all"
  | "needs-matches"
  | "complete"
  | "outside-taxonomy"
  | "partial"
  | "unassigned";

type PlacementSort = "business-name" | "needs-matches-first";

type OverviewPlacementRow = {
  businessName: string;
  hasOutsideTaxonomy: boolean;
  rowStatus: RoundDraftRow["rowStatus"];
};

function hasOutsideTaxonomyMatch(params: {
  businessById: Map<number, RoundDraftOption>;
  counterpartBusinessId: number;
  currentBusinessId: number;
}) {
  return getLinkedBusinessMatchMethod(params) === null;
}

const draftOverviewNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function matchesPlacementFilter(
  row: OverviewPlacementRow,
  placementFilter: PlacementFilter,
) {
  switch (placementFilter) {
    case "needs-matches":
      return row.rowStatus !== "complete";
    case "complete":
      return row.rowStatus === "complete";
    case "outside-taxonomy":
      return row.hasOutsideTaxonomy;
    case "partial":
      return row.rowStatus === "partial";
    case "unassigned":
      return row.rowStatus === "empty";
    case "all":
    default:
      return true;
  }
}

function getPlacementSortWeight(rowStatus: RoundDraftRow["rowStatus"]) {
  switch (rowStatus) {
    case "partial":
      return 0;
    case "empty":
      return 1;
    case "complete":
    default:
      return 2;
  }
}

function getVisibleOverviewRows<Row extends OverviewPlacementRow>(params: {
  placementFilter: PlacementFilter;
  placementSort: PlacementSort;
  rows: Row[];
}) {
  const { placementFilter, placementSort, rows } = params;

  return rows
    .filter((row) => matchesPlacementFilter(row, placementFilter))
    .toSorted((left, right) => {
      if (placementSort === "needs-matches-first") {
        const placementDifference =
          getPlacementSortWeight(left.rowStatus) -
          getPlacementSortWeight(right.rowStatus);

        if (placementDifference !== 0) {
          return placementDifference;
        }
      }

      return draftOverviewNameCollator.compare(
        left.businessName,
        right.businessName,
      );
    });
}

function getSourceClassName(source: RoundAssignmentSource) {
  return source === "manual"
    ? "border-[#abc0d6] bg-[#edf3fa] text-[#3a536b]"
    : "border-border bg-brand-deep-soft/55 text-foreground";
}

function getMatchingMethodClassName(method: RoundMatchMethod | null) {
  switch (method) {
    case "same-subcategory":
      return "border-[#8fc2b1] bg-[#e9f7f1] text-[#256150]";
    case "same-category":
      return "border-[#9bb7dd] bg-[#edf4fd] text-[#31557f]";
    case "related-category":
      return "border-[#d7b4e6] bg-[#f8effc] text-[#6d3f83]";
    case "related-sector":
      return "border-[#efc28b] bg-[#fff5e8] text-[#9b6527]";
    default:
      return "border-[#efb1a8] bg-[#fff0ec] text-[#b55247]";
  }
}

function getMatchingMethodLabel(method: RoundMatchMethod | null) {
  switch (method) {
    case "same-subcategory":
      return "Same Subcategory";
    case "same-category":
      return "Same Category";
    case "related-category":
      return "Related Category";
    case "related-sector":
      return "Related Sector";
    default:
      return "Outside Taxonomy";
  }
}

function getBusinessCategoryLabel(categoryName: string | null) {
  return categoryName?.trim() || "No category assigned";
}

function getBusinessDescriptionLabel(description: string | null) {
  const trimmedDescription = description?.trim();

  if (!trimmedDescription) {
    return "No company description added yet.";
  }

  return trimmedDescription.length > 220
    ? `${trimmedDescription.slice(0, 217)}...`
    : trimmedDescription;
}

function getHistoricalMatchHelperText(hiddenMatchCount: number) {
  if (hiddenMatchCount <= 0) {
    return null;
  }

  return hiddenMatchCount === 1
    ? "1 previously matched business is hidden from this list."
    : `${hiddenMatchCount} previously matched businesses are hidden from this list.`;
}

function getBusinessOptionLabel(params: {
  business: RoundDraftOption;
  businessById: Map<number, RoundDraftOption>;
  currentBusinessId: number;
}) {
  const { business, businessById, currentBusinessId } = params;
  const matchingMethod = getLinkedBusinessMatchMethod({
    businessById,
    counterpartBusinessId: business.businessId,
    currentBusinessId,
  });

  return `${business.businessName} - ${getMatchingMethodLabel(matchingMethod)}`;
}

function toRoundBusinessComboboxOption(params: {
  business: RoundDraftOption;
  businessById: Map<number, RoundDraftOption>;
  currentBusinessId: number;
}): RoundBusinessComboboxOption {
  const { business, businessById, currentBusinessId } = params;
  const matchingMethod = getLinkedBusinessMatchMethod({
    businessById,
    counterpartBusinessId: business.businessId,
    currentBusinessId,
  });

  return {
    categoryLabel: getBusinessCategoryLabel(business.businessCategoryName),
    description: getBusinessDescriptionLabel(business.description),
    label: getBusinessOptionLabel({
      business,
      businessById,
      currentBusinessId,
    }),
    matchClassName: getMatchingMethodClassName(matchingMethod),
    matchLabel: getMatchingMethodLabel(matchingMethod),
    value: business.businessId.toString(),
  };
}

function getLinkedBusinessMatchMethod(params: {
  businessById: Map<number, RoundDraftOption>;
  counterpartBusinessId: number;
  currentBusinessId: number;
}) {
  const { businessById, counterpartBusinessId, currentBusinessId } = params;
  const currentBusiness = businessById.get(currentBusinessId);
  const counterpartBusiness = businessById.get(counterpartBusinessId);

  if (!currentBusiness || !counterpartBusiness) {
    return null;
  }

  return getRoundMatchMethod(currentBusiness, counterpartBusiness);
}

function parseSelectedId(value: string) {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function createEditableAssignmentRow(
  row: RoundDraftAssignmentRow,
): EditableAssignmentRow {
  return {
    assignmentId: row.assignmentId,
    clientId: `saved-${row.assignmentId}`,
    guestBusinessId: row.guestBusiness.businessId.toString(),
    hostBusinessId: row.hostBusiness.businessId.toString(),
    source: row.source,
  };
}

function buildDraftOverviewRows(params: {
  businessById: Map<number, RoundDraftOption>;
  draftRows: EditableAssignmentRow[];
  rows: RoundDraftRow[];
}) {
  const { businessById, draftRows, rows } = params;
  const rowByBusinessId = new Map<number, DraftOverviewRow>();

  function ensureRow(businessId: number) {
    const existingRow = rowByBusinessId.get(businessId);

    if (existingRow) {
      return existingRow;
    }

    const baseRow = rows.find(
      (candidateRow) => candidateRow.businessId === businessId,
    );
    const business = businessById.get(businessId);
    const nextRow = {
      businessId,
      businessName:
        baseRow?.businessName ??
        business?.businessName ??
        `Business ${businessId}`,
      domainRating: baseRow?.domainRating ?? business?.domainRating ?? null,
      hasOutsideTaxonomy: false,
      publishedForDraftTargets: baseRow?.publishedFor ?? [],
      publishedByRows: [],
      publishedForRows: [],
      rowStatus: "empty" as const,
    } satisfies DraftOverviewRow;

    rowByBusinessId.set(businessId, nextRow);
    return nextRow;
  }

  for (const row of rows) {
    ensureRow(row.businessId);
  }

  for (const draftRow of draftRows) {
    const hostBusinessId = parseSelectedId(draftRow.hostBusinessId);
    const guestBusinessId = parseSelectedId(draftRow.guestBusinessId);

    if (hostBusinessId !== null) {
      ensureRow(hostBusinessId).publishedForRows.push(draftRow);
    }

    if (guestBusinessId !== null) {
      ensureRow(guestBusinessId).publishedByRows.push(draftRow);
    }
  }

  return Array.from(rowByBusinessId.values())
    .map(
      (row) =>
        ({
          ...row,
          hasOutsideTaxonomy:
            row.publishedForRows.some((draftRow) => {
              const guestBusinessId = parseSelectedId(draftRow.guestBusinessId);

              return (
                guestBusinessId !== null &&
                hasOutsideTaxonomyMatch({
                  businessById,
                  counterpartBusinessId: guestBusinessId,
                  currentBusinessId: row.businessId,
                })
              );
            }) ||
            row.publishedByRows.some((draftRow) => {
              const hostBusinessId = parseSelectedId(draftRow.hostBusinessId);

              return (
                hostBusinessId !== null &&
                hasOutsideTaxonomyMatch({
                  businessById,
                  counterpartBusinessId: hostBusinessId,
                  currentBusinessId: row.businessId,
                })
              );
            }),
          rowStatus:
            row.publishedByRows.length === 0 &&
            row.publishedForRows.length === 0
              ? "empty"
              : row.publishedByRows.length === 0 ||
                  row.publishedForRows.length === 0
                ? "partial"
                : "complete",
        }) satisfies DraftOverviewRow,
    )
    .toSorted((left, right) =>
      draftOverviewNameCollator.compare(left.businessName, right.businessName),
    );
}

export function RoundDraftTable({
  assignmentRows,
  canDeleteAssignments,
  forbiddenBusinessIdsByBusinessId,
  pairedBusinessIdsByBusinessId,
  roundBatchId,
  roundSequenceNumber,
  rows,
  roundStatus,
  selectableBusinesses,
  unresolvedBusinessCount,
}: RoundDraftTableProps) {
  const isDraft = roundStatus === "draft";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [placementFilter, setPlacementFilter] =
    useState<PlacementFilter>("all");
  const [placementSort, setPlacementSort] = useState<PlacementSort>(
    "needs-matches-first",
  );
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [deleteConfirmationState, setDeleteConfirmationState] =
    useState<DeleteConfirmationState | null>(null);
  const nextTemporaryRowId = useRef(0);
  const [draftRows, setDraftRows] = useState<EditableAssignmentRow[]>(() =>
    assignmentRows.map((row) => createEditableAssignmentRow(row)),
  );
  const businessById = new Map(
    selectableBusinesses.map(
      (business) => [business.businessId, business] as const,
    ),
  );
  const forbiddenBusinessIdSetByBusinessId = new Map(
    Object.entries(forbiddenBusinessIdsByBusinessId).map(
      ([businessId, forbiddenBusinessIds]) =>
        [
          Number.parseInt(businessId, 10),
          new Set(forbiddenBusinessIds),
        ] as const,
    ),
  );
  const pairedBusinessIdSetByBusinessId = new Map(
    Object.entries(pairedBusinessIdsByBusinessId).map(
      ([businessId, pairedBusinessIds]) =>
        [Number.parseInt(businessId, 10), new Set(pairedBusinessIds)] as const,
    ),
  );

  useEffect(() => {
    setDraftRows(assignmentRows.map((row) => createEditableAssignmentRow(row)));
  }, [assignmentRows]);

  useEffect(() => {
    setRoundEditorBusy(isPending);

    return () => {
      setRoundEditorBusy(false);
    };
  }, [isPending]);

  const draftOverviewRows = buildDraftOverviewRows({
    businessById,
    draftRows,
    rows,
  });
  const visibleDraftOverviewRows = getVisibleOverviewRows({
    placementFilter,
    placementSort,
    rows: draftOverviewRows,
  });
  const visibleRows = getVisibleOverviewRows({
    placementFilter,
    placementSort,
    rows: rows.map((row) => ({
      ...row,
      hasOutsideTaxonomy:
        row.publishedFor.some((entry) =>
          hasOutsideTaxonomyMatch({
            businessById,
            counterpartBusinessId: entry.businessId,
            currentBusinessId: row.businessId,
          }),
        ) ||
        row.publishedBy.some((entry) =>
          hasOutsideTaxonomyMatch({
            businessById,
            counterpartBusinessId: entry.businessId,
            currentBusinessId: row.businessId,
          }),
        ),
    })),
  });
  const roundDraftAssignments = assignmentRows.map((assignment) => ({
    guestBusinessId: assignment.guestBusiness.businessId,
    guestBusinessName: assignment.guestBusiness.businessName,
    hostBusinessId: assignment.hostBusiness.businessId,
    hostBusinessName: assignment.hostBusiness.businessName,
    hostPlacementStatus:
      draftOverviewRows.find(
        (row) => row.businessId === assignment.hostBusiness.businessId,
      )?.rowStatus ?? "empty",
    matchStatus: assignment.matchStatus,
  }));

  function getBusinessLabel(businessId: number) {
    return (
      businessById.get(businessId)?.businessName ?? `Business ${businessId}`
    );
  }

  function addOverviewRelationshipRow(
    businessId: number,
    direction: "publishedBy" | "publishedFor",
  ) {
    setDraftRows((currentRows) => [
      ...currentRows,
      {
        assignmentId: null,
        clientId: `new-${nextTemporaryRowId.current++}`,
        guestBusinessId:
          direction === "publishedBy" ? businessId.toString() : "",
        hostBusinessId:
          direction === "publishedFor" ? businessId.toString() : "",
        source: "manual",
      },
    ]);
  }

  function updateRow(
    clientId: string,
    field: "guestBusinessId" | "hostBusinessId",
    value: string,
  ) {
    setDraftRows((currentRows) =>
      currentRows.map((row) =>
        row.clientId === clientId
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }

  function updateRowAndPersist(params: {
    field: "guestBusinessId" | "hostBusinessId";
    row: EditableAssignmentRow;
    value: string;
  }) {
    const { field, row, value } = params;

    if (row[field] === value) {
      return;
    }

    const nextRow = {
      ...row,
      [field]: value,
    } satisfies EditableAssignmentRow;

    updateRow(row.clientId, field, value);

    if (!value) {
      return;
    }

    const validationMessage = getLocalValidationMessage(nextRow);

    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    saveRow(nextRow, { showSuccessToast: false });
  }

  function getRowsExcluding(clientId: string) {
    return draftRows.filter((row) => row.clientId !== clientId);
  }

  function hasPairConflict(
    clientId: string,
    hostBusinessId: number,
    guestBusinessId: number,
  ) {
    return getRowsExcluding(clientId).some((row) => {
      const rowHostBusinessId = parseSelectedId(row.hostBusinessId);
      const rowGuestBusinessId = parseSelectedId(row.guestBusinessId);

      if (rowHostBusinessId === null || rowGuestBusinessId === null) {
        return false;
      }

      return (
        (rowHostBusinessId === hostBusinessId &&
          rowGuestBusinessId === guestBusinessId) ||
        (rowHostBusinessId === guestBusinessId &&
          rowGuestBusinessId === hostBusinessId)
      );
    });
  }

  function isForbiddenPair(hostBusinessId: number, guestBusinessId: number) {
    return (
      forbiddenBusinessIdSetByBusinessId
        .get(hostBusinessId)
        ?.has(guestBusinessId) === true ||
      forbiddenBusinessIdSetByBusinessId
        .get(guestBusinessId)
        ?.has(hostBusinessId) === true
    );
  }

  function isHistoricalPair(hostBusinessId: number, guestBusinessId: number) {
    return (
      pairedBusinessIdSetByBusinessId
        .get(hostBusinessId)
        ?.has(guestBusinessId) === true ||
      pairedBusinessIdSetByBusinessId
        .get(guestBusinessId)
        ?.has(hostBusinessId) === true
    );
  }

  function getHostOptions(row: EditableAssignmentRow) {
    const currentHostBusinessId = parseSelectedId(row.hostBusinessId);
    const currentGuestBusinessId = parseSelectedId(row.guestBusinessId);

    return selectableBusinesses.filter((business) => {
      if (business.businessId === currentHostBusinessId) {
        return true;
      }

      if (
        currentGuestBusinessId !== null &&
        business.businessId === currentGuestBusinessId
      ) {
        return false;
      }

      if (
        currentGuestBusinessId !== null &&
        isForbiddenPair(business.businessId, currentGuestBusinessId)
      ) {
        return false;
      }

      if (
        currentGuestBusinessId !== null &&
        isHistoricalPair(business.businessId, currentGuestBusinessId)
      ) {
        return false;
      }

      if (
        currentGuestBusinessId !== null &&
        hasPairConflict(
          row.clientId,
          business.businessId,
          currentGuestBusinessId,
        )
      ) {
        return false;
      }

      return true;
    });
  }

  function getGuestOptions(row: EditableAssignmentRow) {
    const currentHostBusinessId = parseSelectedId(row.hostBusinessId);
    const currentGuestBusinessId = parseSelectedId(row.guestBusinessId);

    return selectableBusinesses.filter((business) => {
      if (business.businessId === currentGuestBusinessId) {
        return true;
      }

      if (
        currentHostBusinessId !== null &&
        business.businessId === currentHostBusinessId
      ) {
        return false;
      }

      if (
        currentHostBusinessId !== null &&
        isForbiddenPair(currentHostBusinessId, business.businessId)
      ) {
        return false;
      }

      if (
        currentHostBusinessId !== null &&
        isHistoricalPair(currentHostBusinessId, business.businessId)
      ) {
        return false;
      }

      if (
        currentHostBusinessId !== null &&
        hasPairConflict(
          row.clientId,
          currentHostBusinessId,
          business.businessId,
        )
      ) {
        return false;
      }

      return true;
    });
  }

  function getHiddenHistoricalMatchCount(params: {
    currentBusinessId: number;
    selectedBusinessId: string;
  }) {
    const { currentBusinessId, selectedBusinessId } = params;
    const parsedSelectedBusinessId = parseSelectedId(selectedBusinessId);

    return selectableBusinesses.filter((business) => {
      if (business.businessId === currentBusinessId) {
        return false;
      }

      if (business.businessId === parsedSelectedBusinessId) {
        return false;
      }

      return isHistoricalPair(currentBusinessId, business.businessId);
    }).length;
  }

  function getLocalValidationMessage(row: EditableAssignmentRow) {
    const hostBusinessId = parseSelectedId(row.hostBusinessId);
    const guestBusinessId = parseSelectedId(row.guestBusinessId);
    const otherRows = getRowsExcluding(row.clientId);

    if (hostBusinessId === null || guestBusinessId === null) {
      return "Choose both businesses to finish this relationship.";
    }

    if (hostBusinessId === guestBusinessId) {
      return "A business cannot be matched to itself.";
    }

    if (isForbiddenPair(hostBusinessId, guestBusinessId)) {
      return "This business pair is blocked in forbidden matches.";
    }

    if (isHistoricalPair(hostBusinessId, guestBusinessId)) {
      return "These businesses already matched in a previous round.";
    }

    if (
      otherRows.some((candidateRow) => {
        const candidateHostBusinessId = parseSelectedId(
          candidateRow.hostBusinessId,
        );
        const candidateGuestBusinessId = parseSelectedId(
          candidateRow.guestBusinessId,
        );

        return (
          candidateHostBusinessId === hostBusinessId &&
          candidateGuestBusinessId === guestBusinessId
        );
      })
    ) {
      return "This exact row already exists in the draft.";
    }

    if (
      otherRows.some((candidateRow) => {
        const candidateHostBusinessId = parseSelectedId(
          candidateRow.hostBusinessId,
        );
        const candidateGuestBusinessId = parseSelectedId(
          candidateRow.guestBusinessId,
        );

        return (
          candidateHostBusinessId === guestBusinessId &&
          candidateGuestBusinessId === hostBusinessId
        );
      })
    ) {
      return "The reverse direction already exists in this draft.";
    }

    return null;
  }

  function removeUnsavedRow(clientId: string) {
    setDraftRows((currentRows) =>
      currentRows.filter((row) => row.clientId !== clientId),
    );
  }

  function saveRow(
    row: EditableAssignmentRow,
    options?: {
      showSuccessToast?: boolean;
    },
  ) {
    const hostBusinessId = parseSelectedId(row.hostBusinessId);
    const guestBusinessId = parseSelectedId(row.guestBusinessId);
    const validationMessage = getLocalValidationMessage(row);
    const showSuccessToast = options?.showSuccessToast ?? false;

    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    if (hostBusinessId === null || guestBusinessId === null) {
      return;
    }

    setActiveRowId(row.clientId);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/rounds/${roundBatchId}/assignments`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "upsertRow",
              assignmentId: row.assignmentId,
              guestBusinessId,
              hostBusinessId,
            }),
          },
        );

        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;

        if (!response.ok) {
          toast.error(payload?.error ?? "The round row could not be saved.");
          return;
        }

        if (showSuccessToast) {
          toast.success(payload?.message ?? "Round row saved.");
        }

        router.refresh();
      } finally {
        setActiveRowId(null);
      }
    });
  }

  function deleteRow(row: EditableAssignmentRow) {
    if (!canDeleteAssignments && row.assignmentId !== null) {
      return;
    }

    if (row.assignmentId === null) {
      removeUnsavedRow(row.clientId);
      return;
    }

    setDeleteConfirmationState({
      clientId: row.clientId,
      description:
        "This removes the directed assignment from the current draft round. The round itself will stay open for more edits.",
      title: `Delete ${getBusinessLabel(parseSelectedId(row.hostBusinessId) ?? 0)} -> ${getBusinessLabel(parseSelectedId(row.guestBusinessId) ?? 0)}?`,
    });
  }

  function confirmDeleteRow() {
    if (!deleteConfirmationState) {
      return;
    }

    const row = draftRows.find(
      (candidateRow) =>
        candidateRow.clientId === deleteConfirmationState.clientId,
    );

    if (!row || row.assignmentId === null) {
      setDeleteConfirmationState(null);
      return;
    }

    setDeleteConfirmationState(null);

    setActiveRowId(row.clientId);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/rounds/${roundBatchId}/assignments`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "deleteRow",
              assignmentId: row.assignmentId,
            }),
          },
        );

        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;

        if (!response.ok) {
          toast.error(payload?.error ?? "The round row could not be deleted.");
          return;
        }

        toast.success(payload?.message ?? "Round row deleted.");
        router.refresh();
      } finally {
        setActiveRowId(null);
      }
    });
  }

  function renderBusinessPreview(
    businessId: string,
    currentBusinessId: number,
  ) {
    const parsedBusinessId = parseSelectedId(businessId);

    if (parsedBusinessId === null) {
      return (
        <p className="text-xs leading-6 text-center text-muted">
          No business selected yet.
        </p>
      );
    }

    const business = businessById.get(parsedBusinessId);

    if (!business) {
      return (
        <p className="text-xs leading-6 text-center text-muted">
          Business not found.
        </p>
      );
    }

    return (
      <div className="rounded-2xl border border-border bg-brand-deep-soft/30 px-3 py-3">
        <div className="space-y-2 text-left">
          <Link
            className="block text-sm font-semibold text-foreground transition hover:text-accent"
            href={getBusinessProfileHref(business.businessId)}
          >
            {getBusinessOptionLabel({
              business,
              businessById,
              currentBusinessId,
            })}
          </Link>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
            Category
          </p>
          <p className="text-xs font-medium leading-6 text-foreground/85">
            {getBusinessCategoryLabel(business.businessCategoryName)}
          </p>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
            Description
          </p>
          <p className="text-xs leading-6 text-muted">
            {getBusinessDescriptionLabel(business.description)}
          </p>
        </div>
      </div>
    );
  }

  function getRowMatchMethod(row: EditableAssignmentRow) {
    const hostBusinessId = parseSelectedId(row.hostBusinessId);
    const guestBusinessId = parseSelectedId(row.guestBusinessId);

    if (hostBusinessId === null || guestBusinessId === null) {
      return null;
    }

    const hostBusiness = businessById.get(hostBusinessId);
    const guestBusiness = businessById.get(guestBusinessId);

    if (!hostBusiness || !guestBusiness) {
      return null;
    }

    return getRoundMatchMethod(hostBusiness, guestBusiness);
  }

  function getOverviewStatusClassName(status: RoundDraftRow["rowStatus"]) {
    switch (status) {
      case "complete":
        return "border-[#8cc6a7] bg-[#e9f8ef] text-[#276b4a]";
      case "partial":
        return "border-[#efc28b] bg-[#fff5e8] text-[#9b6527]";
      case "empty":
      default:
        return "border-border bg-white/75 text-muted";
    }
  }

  function getOverviewRowClassName(status: RoundDraftRow["rowStatus"]) {
    switch (status) {
      case "partial":
        return "bg-[#fffaf0]";
      case "empty":
        return "bg-[#fff5f4]";
      case "complete":
      default:
        return "bg-white/40";
    }
  }

  function getOverviewStatusLabel(status: RoundDraftRow["rowStatus"]) {
    switch (status) {
      case "complete":
        return "Complete";
      case "partial":
        return "Partial";
      case "empty":
      default:
        return "Unassigned";
    }
  }

  function getOverviewStatusHelperLabel(status: RoundDraftRow["rowStatus"]) {
    switch (status) {
      case "partial":
        return "Still missing one direction";
      case "empty":
        return "No matches yet";
      case "complete":
      default:
        return null;
    }
  }

  function renderRelationshipList(
    businesses: RoundDraftRow["publishedBy"],
    currentBusinessId: number,
    emptyLabel: string,
    tone: "accent" | "neutral",
  ) {
    if (businesses.length === 0) {
      return <p className="text-sm leading-7 text-muted">{emptyLabel}</p>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {businesses.map((entry) => {
          const matchingMethod = getLinkedBusinessMatchMethod({
            businessById,
            counterpartBusinessId: entry.businessId,
            currentBusinessId,
          });

          return (
            <div
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-2.5 py-1"
              key={`${tone}-${entry.assignmentId}-${entry.businessId}`}
            >
              <Link
                className={
                  tone === "accent"
                    ? "text-[13px] font-medium text-accent-strong transition hover:text-accent"
                    : "text-[13px] font-medium text-foreground transition hover:text-accent"
                }
                href={getBusinessProfileHref(entry.businessId)}
              >
                {entry.businessName}
              </Link>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase ${getMatchingMethodClassName(matchingMethod)}`}
              >
                {getMatchingMethodLabel(matchingMethod)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderAppliedDraftActions(
    hostBusinessId: number,
    hostBusinessName: string,
    hostPlacementStatus: RoundDraftPlacementStatus,
    targets: RoundDraftRow["publishedFor"],
  ) {
    if (targets.length === 0) {
      return (
        <p className="text-sm leading-7 text-muted">
          No outgoing matches in this applied round.
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {targets.map((target) =>
          (() => {
            const draftButtonDisabledLabel = getRoundEmailDraftBlockedReason({
              matchStatus: target.matchStatus,
              placementStatus: hostPlacementStatus,
            });

            return (
              <div
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white/70 px-3 py-2"
                key={`draft-${hostBusinessId}-${target.assignmentId}`}
              >
                <span className="min-w-0 text-sm font-medium text-foreground">
                  {hostBusinessName} x {target.businessName}
                </span>
                <CreateEmailDraftButton
                  disabled={draftButtonDisabledLabel !== null}
                  disabledLabel={draftButtonDisabledLabel ?? undefined}
                  guestId={target.businessId}
                  hostId={hostBusinessId}
                  roundBatchId={roundBatchId}
                  tooltipLabel={`Create email draft for ${hostBusinessName} and ${target.businessName}`}
                />
              </div>
            );
          })(),
        )}
      </div>
    );
  }

  function renderOverviewRelationshipEditor(
    row: EditableAssignmentRow,
    currentBusinessId: number,
    direction: "publishedBy" | "publishedFor",
  ) {
    const isPublishedBy = direction === "publishedBy";
    const field = isPublishedBy ? "hostBusinessId" : "guestBusinessId";
    const options = isPublishedBy ? getHostOptions(row) : getGuestOptions(row);
    const placeholder = isPublishedBy
      ? "Select publishing business"
      : "Select receiving business";
    const counterpartBusinessId =
      field === "hostBusinessId" ? row.hostBusinessId : row.guestBusinessId;
    const validationMessage = getLocalValidationMessage(row);
    const rowIsBusy = isPending && activeRowId === row.clientId;
    const matchingMethod = getRowMatchMethod(row);
    const comboboxOptions = options.map((business) =>
      toRoundBusinessComboboxOption({
        business,
        businessById,
        currentBusinessId,
      }),
    );
    const historicalMatchHelperText = getHistoricalMatchHelperText(
      getHiddenHistoricalMatchCount({
        currentBusinessId,
        selectedBusinessId: counterpartBusinessId,
      }),
    );

    return (
      <div
        className="rounded-2xl border border-border bg-white/70 p-3"
        key={`${direction}-${row.clientId}`}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-3">
            <RoundBusinessCombobox
              disabled={isPending}
              helperText={historicalMatchHelperText ?? undefined}
              onChange={(nextValue) =>
                updateRowAndPersist({
                  field,
                  row,
                  value: nextValue,
                })
              }
              options={comboboxOptions}
              placeholder={placeholder}
              value={counterpartBusinessId}
            />

            {renderBusinessPreview(counterpartBusinessId, currentBusinessId)}

            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] uppercase ${getMatchingMethodClassName(matchingMethod)}`}
              >
                {getMatchingMethodLabel(matchingMethod)}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] uppercase ${getSourceClassName(row.source)}`}
              >
                {row.assignmentId === null ? "new" : row.source}
              </span>
            </div>

            <p className="text-xs leading-6 text-muted">
              {rowIsBusy
                ? "Saving relationship..."
                : (validationMessage ??
                  "The server will still block forbidden pairs, self-pairs, duplicate rows, and reversed pairs.")}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 xl:pt-0.5">
            {canDeleteAssignments || row.assignmentId === null ? (
              <div className="group relative">
                <button
                  aria-label={
                    row.assignmentId === null
                      ? "Remove relationship"
                      : "Delete relationship"
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d98d8a] bg-[#fff5f4] text-[#a93e39] transition hover:-translate-y-0.5 hover:border-[#bf5d57] hover:text-[#8f2e2a] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending}
                  onClick={() => deleteRow(row)}
                  type="button"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
                <ActionTooltip
                  label={
                    row.assignmentId === null
                      ? "Remove relationship"
                      : rowIsBusy
                        ? "Deleting relationship"
                        : "Delete relationship"
                  }
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function renderOverviewRelationshipCell(params: {
    businessId: number;
    direction: "publishedBy" | "publishedFor";
    emptyLabel: string;
    relationships: EditableAssignmentRow[];
  }) {
    const { businessId, direction, emptyLabel, relationships } = params;

    if (!isDraft) {
      return renderRelationshipList(
        direction === "publishedBy"
          ? (rows.find((row) => row.businessId === businessId)?.publishedBy ??
              [])
          : (rows.find((row) => row.businessId === businessId)?.publishedFor ??
              []),
        businessId,
        emptyLabel,
        direction === "publishedBy" ? "neutral" : "accent",
      );
    }

    return (
      <div className="space-y-3">
        {relationships.length === 0 ? (
          <p className="text-sm leading-7 text-muted">{emptyLabel}</p>
        ) : (
          relationships.map((relationship) =>
            renderOverviewRelationshipEditor(
              relationship,
              businessId,
              direction,
            ),
          )
        )}

        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-white/85 px-4 py-2 text-xs font-semibold tracking-[0.08em] text-foreground uppercase transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={() => addOverviewRelationshipRow(businessId, direction)}
          type="button"
        >
          <PlusIcon className="h-4 w-4" />
          {direction === "publishedBy"
            ? "Add Published By"
            : "Add Published For"}
        </button>
      </div>
    );
  }

  return (
    <>
      <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
        <div className="flex flex-col gap-4 border-b border-border pb-5">
          <div className="space-y-2">
            <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
              Round Overview
            </p>
            <p className="max-w-3xl text-sm leading-7 text-muted sm:text-base">
              This groups the selected round by business, similar to the Notion
              sheet. Each company can have multiple Published By and Published
              For relationships inside the same round. Pairings outside the
              standard taxonomy rules are flagged throughout this overview.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold tracking-[0.08em] uppercase">
            <span className="inline-flex items-center rounded-full border border-border bg-white/70 px-3 py-1 text-muted">
              One-way Directionality
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-white/70 px-3 py-1 text-muted">
              Multiple Links Per Business Allowed
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-white/70 px-3 py-1 text-muted">
              No Duplicate Or Reversed Pair
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex min-w-52 flex-col gap-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
                Placement Filter
                <select
                  className="min-h-11 rounded-2xl border border-border bg-white/85 px-4 py-3 text-sm font-medium tracking-normal text-foreground normal-case outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  onChange={(event) =>
                    setPlacementFilter(event.target.value as PlacementFilter)
                  }
                  value={placementFilter}
                >
                  <option value="all">All businesses</option>
                  <option value="needs-matches">Needs matches</option>
                  <option value="partial">Partial placement</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="outside-taxonomy">Outside taxonomy</option>
                  <option value="complete">Complete only</option>
                </select>
              </label>

              <label className="flex min-w-52 flex-col gap-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
                Placement Sort
                <select
                  className="min-h-11 rounded-2xl border border-border bg-white/85 px-4 py-3 text-sm font-medium tracking-normal text-foreground normal-case outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  onChange={(event) =>
                    setPlacementSort(event.target.value as PlacementSort)
                  }
                  value={placementSort}
                >
                  <option value="needs-matches-first">
                    Needs matches first
                  </option>
                  <option value="business-name">Business name</option>
                </select>
              </label>
            </div>

            {!isDraft ? (
              <CreateRoundEmailDraftsButton
                assignments={roundDraftAssignments}
                roundBatchId={roundBatchId}
                roundSequenceNumber={roundSequenceNumber}
              />
            ) : null}
          </div>

          {isDraft ? (
            <p className="text-sm leading-7 text-muted">
              {unresolvedBusinessCount === 0
                ? "Every active business is fully placed in this draft."
                : `${unresolvedBusinessCount} business${unresolvedBusinessCount === 1 ? " still needs" : "es still need"} a completed round placement.`}
            </p>
          ) : null}
        </div>

        {(isDraft ? visibleDraftOverviewRows.length : visibleRows.length) ===
        0 ? (
          <div className="mt-6 rounded-4xl border border-dashed border-border bg-white/60 px-6 py-12 text-center">
            <p className="text-lg font-medium text-foreground">
              {rows.length === 0
                ? "No businesses are represented in this round yet."
                : "No businesses match the current placement filter."}
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              {rows.length === 0
                ? isDraft
                  ? "Generate a draft or add pairing rows to build this round overview."
                  : "This applied round does not contain any grouped relationships yet."
                : "Adjust the placement filter or sort controls to see more businesses."}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-4xl border border-border bg-white/72">
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-brand-deep-soft/75 text-left text-xs font-semibold tracking-[0.16em] text-muted uppercase">
                    <th className="px-5 py-4 sm:px-6">Business Name</th>
                    <th className="px-5 py-4 sm:px-6">Published For</th>
                    <th className="px-5 py-4 sm:px-6">Published By</th>
                    {!isDraft ? (
                      <th className="px-5 py-4 sm:px-6">Email Drafts</th>
                    ) : null}
                    <th className="px-5 py-4 sm:px-6">Placement</th>
                  </tr>
                </thead>
                <tbody>
                  {isDraft
                    ? visibleDraftOverviewRows.map((row) => (
                        <tr
                          key={row.businessId}
                          className={`align-top ${getOverviewRowClassName(row.rowStatus)}`}
                        >
                          <td className="border-t border-border px-5 py-4 sm:px-6">
                            <div className="space-y-1.5">
                              <Link
                                className="block text-sm font-semibold text-foreground transition hover:text-accent"
                                href={getBusinessProfileHref(row.businessId)}
                              >
                                {row.businessName}
                              </Link>
                              <span className="inline-flex items-center rounded-full border border-border bg-brand-deep-soft/55 px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                                {row.domainRating === null
                                  ? "No DR"
                                  : `DR ${row.domainRating}`}
                              </span>
                              {getOverviewStatusHelperLabel(row.rowStatus) ? (
                                <p className="text-xs font-medium leading-6 text-muted">
                                  {getOverviewStatusHelperLabel(row.rowStatus)}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="border-t border-border px-5 py-4 sm:px-6">
                            <div className="space-y-2">
                              {renderOverviewRelationshipCell({
                                businessId: row.businessId,
                                direction: "publishedFor",
                                emptyLabel:
                                  "No Published For relationships in this round yet.",
                                relationships: row.publishedForRows,
                              })}
                              {row.publishedForRows.length > 1 ? (
                                <p className="text-xs leading-6 text-muted">
                                  {row.publishedForRows.length} linked
                                  businesses
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="border-t border-border px-5 py-4 sm:px-6">
                            <div className="space-y-2">
                              {renderOverviewRelationshipCell({
                                businessId: row.businessId,
                                direction: "publishedBy",
                                emptyLabel:
                                  "No Published By relationships in this round yet.",
                                relationships: row.publishedByRows,
                              })}
                              {row.publishedByRows.length > 1 ? (
                                <p className="text-xs leading-6 text-muted">
                                  {row.publishedByRows.length} linked businesses
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="border-t border-border px-5 py-4 sm:px-6">
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.08em] uppercase ${getOverviewStatusClassName(row.rowStatus)}`}
                            >
                              {getOverviewStatusLabel(row.rowStatus)}
                            </span>
                          </td>
                        </tr>
                      ))
                    : visibleRows.map((row) => (
                        <tr
                          key={row.businessId}
                          className={`align-top ${getOverviewRowClassName(row.rowStatus)}`}
                        >
                          <td className="border-t border-border px-5 py-4 sm:px-6">
                            <div className="space-y-1.5">
                              <Link
                                className="block text-sm font-semibold text-foreground transition hover:text-accent"
                                href={getBusinessProfileHref(row.businessId)}
                              >
                                {row.businessName}
                              </Link>
                              <span className="inline-flex items-center rounded-full border border-border bg-brand-deep-soft/55 px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                                {row.domainRating === null
                                  ? "No DR"
                                  : `DR ${row.domainRating}`}
                              </span>
                              {getOverviewStatusHelperLabel(row.rowStatus) ? (
                                <p className="text-xs font-medium leading-6 text-muted">
                                  {getOverviewStatusHelperLabel(row.rowStatus)}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="border-t border-border px-5 py-4 sm:px-6">
                            <div className="space-y-2">
                              {renderRelationshipList(
                                row.publishedFor,
                                row.businessId,
                                "No Published For relationships in this round yet.",
                                "accent",
                              )}
                              {row.publishedFor.length > 1 ? (
                                <p className="text-xs leading-6 text-muted">
                                  {row.publishedFor.length} linked businesses
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="border-t border-border px-5 py-4 sm:px-6">
                            <div className="space-y-2">
                              {renderRelationshipList(
                                row.publishedBy,
                                row.businessId,
                                "No Published By relationships in this round yet.",
                                "neutral",
                              )}
                              {row.publishedBy.length > 1 ? (
                                <p className="text-xs leading-6 text-muted">
                                  {row.publishedBy.length} linked businesses
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="border-t border-border px-5 py-4 sm:px-6">
                            {renderAppliedDraftActions(
                              row.businessId,
                              row.businessName,
                              row.rowStatus,
                              row.publishedFor,
                            )}
                          </td>
                          <td className="border-t border-border px-5 py-4 sm:px-6">
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.08em] uppercase ${getOverviewStatusClassName(row.rowStatus)}`}
                            >
                              {getOverviewStatusLabel(row.rowStatus)}
                            </span>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <ConfirmationDialog
        confirmLabel="Delete Row"
        description={deleteConfirmationState?.description ?? ""}
        isBusy={isPending}
        isOpen={deleteConfirmationState !== null}
        onClose={() => setDeleteConfirmationState(null)}
        onConfirm={confirmDeleteRow}
        title={deleteConfirmationState?.title ?? "Delete row?"}
        tone="danger"
      />
    </>
  );
}
