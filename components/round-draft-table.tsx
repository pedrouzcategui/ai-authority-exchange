"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ActionTooltip,
  PlusIcon,
  SaveIcon,
  TrashIcon,
} from "@/components/action-icons";
import type {
  RoundAssignmentSource,
  RoundBatchStatus,
} from "@/generated/prisma/client";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { getBusinessProfileHref } from "@/lib/business-profile-route";
import type {
  RoundDraftAssignmentRow,
  RoundDraftOption,
  RoundDraftRow,
} from "@/lib/rounds";

type RoundDraftTableProps = {
  assignmentRows: RoundDraftAssignmentRow[];
  roundBatchId: number;
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

function getSourceClassName(source: RoundAssignmentSource) {
  return source === "manual"
    ? "border-[#abc0d6] bg-[#edf3fa] text-[#3a536b]"
    : "border-border bg-brand-deep-soft/55 text-foreground";
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

export function RoundDraftTable({
  assignmentRows,
  roundBatchId,
  rows,
  roundStatus,
  selectableBusinesses,
  unresolvedBusinessCount,
}: RoundDraftTableProps) {
  const isDraft = roundStatus === "draft";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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

  useEffect(() => {
    setDraftRows(assignmentRows.map((row) => createEditableAssignmentRow(row)));
  }, [assignmentRows]);

  function getBusinessLabel(businessId: number) {
    return (
      businessById.get(businessId)?.businessName ?? `Business ${businessId}`
    );
  }

  function addRow() {
    setDraftRows((currentRows) => [
      ...currentRows,
      {
        assignmentId: null,
        clientId: `new-${nextTemporaryRowId.current++}`,
        guestBusinessId: "",
        hostBusinessId: "",
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

  function getLocalValidationMessage(row: EditableAssignmentRow) {
    const hostBusinessId = parseSelectedId(row.hostBusinessId);
    const guestBusinessId = parseSelectedId(row.guestBusinessId);
    const otherRows = getRowsExcluding(row.clientId);

    if (hostBusinessId === null || guestBusinessId === null) {
      return "Choose both businesses before saving this row.";
    }

    if (hostBusinessId === guestBusinessId) {
      return "A business cannot be matched to itself.";
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

  function saveRow(row: EditableAssignmentRow) {
    const hostBusinessId = parseSelectedId(row.hostBusinessId);
    const guestBusinessId = parseSelectedId(row.guestBusinessId);
    const validationMessage = getLocalValidationMessage(row);

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

        toast.success(payload?.message ?? "Round row saved.");
        router.refresh();
      } finally {
        setActiveRowId(null);
      }
    });
  }

  function deleteRow(row: EditableAssignmentRow) {
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

  function renderBusinessPreview(businessId: string) {
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
      <div className="flex flex-wrap items-center justify-center gap-2 text-center">
        <Link
          className="text-sm font-semibold text-foreground transition hover:text-accent"
          href={getBusinessProfileHref(business.businessId)}
        >
          {business.businessName}
        </Link>
      </div>
    );
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

  function renderRelationshipList(
    businesses: RoundDraftRow["publishedBy"],
    emptyLabel: string,
    tone: "accent" | "neutral",
  ) {
    if (businesses.length === 0) {
      return <p className="text-sm leading-7 text-muted">{emptyLabel}</p>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {businesses.map((entry) => (
          <Link
            className={
              tone === "accent"
                ? "inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[13px] font-medium text-accent-strong transition hover:border-accent/35 hover:bg-accent/14"
                : "inline-flex items-center rounded-full border border-border bg-brand-deep-soft/55 px-2.5 py-1 text-[13px] font-medium text-foreground transition hover:border-accent/35 hover:text-accent"
            }
            href={getBusinessProfileHref(entry.businessId)}
            key={`${tone}-${entry.assignmentId}-${entry.businessId}`}
          >
            {entry.businessName}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-4xl border border-border bg-surface shadow-(--shadow) backdrop-blur-md">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:px-8">
          <div className="space-y-2">
            <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
              Round Overview
            </p>
            <p className="max-w-3xl text-sm leading-7 text-muted sm:text-base">
              This groups the selected round by business, similar to the Notion
              sheet. Each company can have multiple Published By and Published
              For relationships inside the same round.
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
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center sm:px-8">
            <p className="text-lg font-medium text-foreground">
              No businesses are represented in this round yet.
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              {isDraft
                ? "Generate a draft or add pairing rows to build this round overview."
                : "This applied round does not contain any grouped relationships yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-brand-deep-soft/75 text-left text-xs font-semibold tracking-[0.16em] text-muted uppercase">
                  <th className="px-5 py-4 sm:px-6">Business Name</th>
                  <th className="px-5 py-4 sm:px-6">Published For</th>
                  <th className="px-5 py-4 sm:px-6">Published By</th>
                  <th className="px-5 py-4 sm:px-6">Placement</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.businessId} className="align-top">
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
                      </div>
                    </td>
                    <td className="border-t border-border px-5 py-4 sm:px-6">
                      <div className="space-y-2">
                        {renderRelationshipList(
                          row.publishedFor,
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
        )}
      </section>

      <section className="overflow-hidden rounded-4xl border border-border bg-surface shadow-(--shadow) backdrop-blur-md">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
                Pairing Rows
              </p>
              <p className="max-w-3xl text-sm leading-7 text-muted sm:text-base">
                These are the underlying directed pairings saved for the
                selected round. Draft rounds can still be edited row by row,
                while applied rounds stay read-only.
              </p>
            </div>

            {isDraft ? (
              <button
                aria-label="Add round row"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-white/85 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                onClick={addRow}
                title="Add a new row to this round draft"
                type="button"
              >
                <PlusIcon className="h-4 w-4" />
                Add Row
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold tracking-[0.08em] uppercase">
            <span className="inline-flex items-center rounded-full border border-border bg-white/70 px-3 py-1 text-muted">
              No Reverse Pair
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-white/70 px-3 py-1 text-muted">
              No Duplicate Or Reversed Pair
            </span>
          </div>

          {isDraft ? (
            <p className="text-sm leading-7 text-muted">
              {unresolvedBusinessCount === 0
                ? "Every active business is fully placed in this draft."
                : `${unresolvedBusinessCount} business${unresolvedBusinessCount === 1 ? " still needs" : "es still need"} a completed round placement.`}
            </p>
          ) : null}
        </div>

        {draftRows.length === 0 ? (
          <div className="px-6 py-12 text-center sm:px-8">
            <p className="text-lg font-medium text-foreground">
              No directed rows are in this batch yet.
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              {isDraft
                ? "Use Add Row to manually build the round from scratch or after clearing the generated suggestions."
                : "This applied round batch does not contain any saved directed rows."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-center">
              <thead>
                <tr className="bg-brand-deep-soft/75 text-left text-xs font-semibold tracking-[0.16em] text-muted uppercase">
                  <th className="px-5 py-4 text-center sm:px-6">
                    Business Name
                  </th>
                  <th className="px-5 py-4 text-center sm:px-6">
                    Published By
                  </th>
                  <th className="px-5 py-4 text-center sm:px-6">
                    Published For
                  </th>
                  <th className="px-5 py-4 text-center sm:px-6">Source</th>
                  <th className="px-5 py-4 text-center sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {draftRows.map((row) => {
                  const validationMessage = isDraft
                    ? getLocalValidationMessage(row)
                    : null;
                  const hostOptions = isDraft
                    ? getHostOptions(row)
                    : selectableBusinesses;
                  const guestOptions = isDraft
                    ? getGuestOptions(row)
                    : selectableBusinesses;
                  const rowIsBusy = isPending && activeRowId === row.clientId;

                  return (
                    <tr key={row.clientId} className="align-top">
                      <td className="border-t border-border px-5 py-4 text-center sm:px-6">
                        <div className="space-y-3 text-center">
                          {renderBusinessPreview(row.hostBusinessId)}
                        </div>
                      </td>

                      <td className="border-t border-border px-5 py-4 text-center sm:px-6">
                        <div className="space-y-3 text-center">
                          {isDraft ? (
                            <select
                              className="mx-auto block min-h-11 w-full min-w-56 rounded-2xl border border-border bg-white/85 px-4 py-3 text-center text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-muted"
                              disabled={isPending}
                              onChange={(event) =>
                                updateRow(
                                  row.clientId,
                                  "hostBusinessId",
                                  event.target.value,
                                )
                              }
                              value={row.hostBusinessId}
                            >
                              <option value="">
                                Select publishing business
                              </option>
                              {hostOptions.map((business) => (
                                <option
                                  key={`${row.clientId}-host-${business.businessId}`}
                                  value={business.businessId}
                                >
                                  {business.businessName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-xs leading-6 text-center text-muted">
                              Uses the business shown in the first column.
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="border-t border-border px-5 py-4 text-center sm:px-6">
                        <div className="space-y-3 text-center">
                          {isDraft ? (
                            <select
                              className="mx-auto block min-h-11 w-full min-w-56 rounded-2xl border border-border bg-white/85 px-4 py-3 text-center text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-muted"
                              disabled={isPending}
                              onChange={(event) =>
                                updateRow(
                                  row.clientId,
                                  "guestBusinessId",
                                  event.target.value,
                                )
                              }
                              value={row.guestBusinessId}
                            >
                              <option value="">
                                Select receiving business
                              </option>
                              {guestOptions.map((business) => (
                                <option
                                  key={`${row.clientId}-guest-${business.businessId}`}
                                  value={business.businessId}
                                >
                                  {business.businessName}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          {renderBusinessPreview(row.guestBusinessId)}
                        </div>
                      </td>

                      <td className="border-t border-border px-5 py-4 text-center sm:px-6">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] uppercase ${getSourceClassName(row.source)}`}
                        >
                          {row.assignmentId === null ? "new" : row.source}
                        </span>
                      </td>

                      <td className="border-t border-border px-5 py-4 text-center sm:px-6">
                        {isDraft ? (
                          <div className="space-y-3 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-3">
                              <div className="group relative">
                                <button
                                  aria-label={
                                    row.assignmentId === null
                                      ? "Add row"
                                      : "Save row"
                                  }
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white/80 text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={isPending}
                                  onClick={() => saveRow(row)}
                                  type="button"
                                >
                                  <SaveIcon className="h-4 w-4" />
                                </button>
                                <ActionTooltip
                                  label={
                                    rowIsBusy
                                      ? "Saving row"
                                      : row.assignmentId === null
                                        ? "Add row"
                                        : "Save row"
                                  }
                                />
                              </div>
                              <div className="group relative">
                                <button
                                  aria-label="Delete row"
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d98d8a] bg-[#fff5f4] text-[#a93e39] transition hover:-translate-y-0.5 hover:border-[#bf5d57] hover:text-[#8f2e2a] disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={isPending}
                                  onClick={() => deleteRow(row)}
                                  type="button"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                                <ActionTooltip
                                  label={
                                    rowIsBusy ? "Deleting row" : "Delete row"
                                  }
                                />
                              </div>
                            </div>

                            <p className="text-xs leading-6 text-center text-muted">
                              {validationMessage ??
                                "The server will still block self-pairs, duplicate rows, and reversed pairs."}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm leading-7 text-center text-muted">
                            Applied rounds are read-only here.
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
