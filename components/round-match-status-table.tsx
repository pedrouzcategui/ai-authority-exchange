"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MatchStatus, RoundBatchStatus } from "@/generated/prisma/client";
import { getBusinessProfileHref } from "@/lib/business-profile-route";
import { getRoundMatchMethod, type RoundMatchMethod } from "@/lib/round-match-method";
import type { RoundBatchMatchStatusRow } from "@/lib/rounds";

type RoundMatchStatusTableProps = {
  roundSequenceNumber: number | null;
  roundStatus: RoundBatchStatus;
  rows: RoundBatchMatchStatusRow[];
};

type SortDirection = "asc" | "desc";

type SortKey =
  | "companyName"
  | "publisherName"
  | "interviewPublished"
  | "interviewSent"
  | "status";

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const statusOptions: Array<{ label: string; value: MatchStatus }> = [
  { label: "Not Started", value: "Not_Started" },
  { label: "Draft Created", value: "Draft_Created" },
  { label: "In Progress", value: "In_Progress" },
  { label: "Done", value: "Done" },
  { label: "Leaving", value: "Leaving" },
  { label: "Partner Leaving", value: "Partner_Leaving" },
];

const statusOrder = new Map(
  statusOptions.map((option, index) => [option.value, index]),
);

function formatDomainRating(domainRating: number | null) {
  return domainRating === null ? "No DR" : `DR ${domainRating}`;
}

function getStatusSelectClassName(status: MatchStatus | null) {
  switch (status ?? "Not_Started") {
    case "Draft_Created":
      return "border-[#d7b4e6] bg-[#f8effc] text-[#6d3f83] focus:border-[#9d5dbb] focus:ring-[#9d5dbb]/20";
    case "In_Progress":
      return "border-[#abc0d6] bg-[#edf3fa] text-[#3a536b] focus:border-brand-deep focus:ring-brand-deep/15";
    case "Done":
      return "border-[#8cc6a7] bg-[#e9f8ef] text-[#276b4a] focus:border-[#4eab78] focus:ring-[#4eab78]/20";
    case "Leaving":
      return "border-[#efb1a8] bg-[#fff0ec] text-[#b55247] focus:border-accent focus:ring-accent/15";
    case "Partner_Leaving":
      return "border-[#c3ceda] bg-[#f1f5f8] text-[#55697e] focus:border-brand-deep focus:ring-brand-deep/15";
    case "Not_Started":
    default:
      return "border-border bg-white/85 text-foreground focus:border-accent focus:ring-accent/15";
  }
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

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  return (
    <svg
      aria-hidden="true"
      className={
        active ? "h-3.5 w-3.5 text-accent" : "h-3.5 w-3.5 text-muted/60"
      }
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {direction === "asc" ? (
        <path d="m7 14 5-5 5 5" />
      ) : (
        <path d="m7 10 5 5 5-5" />
      )}
    </svg>
  );
}

function SortHeaderButton({
  activeSortKey,
  direction,
  label,
  onSort,
  sortKey,
}: {
  activeSortKey: SortKey;
  direction: SortDirection;
  label: string;
  onSort: (sortKey: SortKey) => void;
  sortKey: SortKey;
}) {
  const isActive = activeSortKey === sortKey;

  return (
    <button
      className="inline-flex items-center gap-1.5 transition hover:text-accent"
      onClick={() => onSort(sortKey)}
      type="button"
    >
      <span>{label}</span>
      <SortIcon active={isActive} direction={isActive ? direction : "asc"} />
    </button>
  );
}

function getSortedRows(
  rows: RoundBatchMatchStatusRow[],
  sortKey: SortKey,
  sortDirection: SortDirection,
) {
  const multiplier = sortDirection === "asc" ? 1 : -1;

  return rows.toSorted((left, right) => {
    switch (sortKey) {
      case "publisherName":
        return (
          collator.compare(
            left.hostBusiness.businessName,
            right.hostBusiness.businessName,
          ) * multiplier
        );
      case "interviewSent":
        return (
          (Number(left.interviewSent) - Number(right.interviewSent)) *
          multiplier
        );
      case "interviewPublished":
        return (
          (Number(left.interviewPublished) - Number(right.interviewPublished)) *
          multiplier
        );
      case "status": {
        const leftOrder = statusOrder.get(left.status ?? "Not_Started") ?? -1;
        const rightOrder = statusOrder.get(right.status ?? "Not_Started") ?? -1;
        return (leftOrder - rightOrder) * multiplier;
      }
      case "companyName":
      default:
        return (
          collator.compare(
            left.guestBusiness.businessName,
            right.guestBusiness.businessName,
          ) * multiplier
        );
    }
  });
}

export function RoundMatchStatusTable({
  roundSequenceNumber,
  roundStatus,
  rows,
}: RoundMatchStatusTableProps) {
  const router = useRouter();
  const [tableRows, setTableRows] = useState(rows);
  const [pendingMatchIds, setPendingMatchIds] = useState<number[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("companyName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setTableRows(rows);
  }, [rows]);

  function onSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("asc");
  }

  async function updateMatch(
    matchId: number,
    updates: Partial<
      Pick<
        RoundBatchMatchStatusRow,
        "interviewPublished" | "interviewSent" | "status"
      >
    >,
  ) {
    const previousRow = tableRows.find((row) => row.matchId === matchId);

    if (!previousRow) {
      return;
    }

    const requestBody: {
      interviewPublished?: boolean;
      interviewSent?: boolean;
      matchId: number;
      status?: MatchStatus | null;
    } = {
      matchId,
    };

    if (updates.interviewSent !== undefined) {
      requestBody.interviewSent = updates.interviewSent;
    }

    if (updates.interviewPublished !== undefined) {
      requestBody.interviewPublished = updates.interviewPublished;
    }

    if (updates.status !== undefined) {
      requestBody.status = updates.status;
    }

    setPendingMatchIds((currentIds) => [...currentIds, matchId]);
    setTableRows((currentRows) =>
      currentRows.map((row) =>
        row.matchId === matchId
          ? {
              ...row,
              ...updates,
            }
          : row,
      ),
    );

    try {
      const response = await fetch("/api/matches", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        match?: {
          interviewPublished: boolean;
          interviewSent: boolean;
          status: MatchStatus | null;
        };
        message?: string;
      } | null;

      if (!response.ok || !payload?.match) {
        setTableRows((currentRows) =>
          currentRows.map((row) =>
            row.matchId === matchId ? previousRow : row,
          ),
        );
        toast.error(payload?.error ?? "The match could not be updated.");
        return;
      }

      setTableRows((currentRows) =>
        currentRows.map((row) =>
          row.matchId === matchId
            ? {
                ...row,
                ...payload.match,
              }
            : row,
        ),
      );
      toast.success(payload.message ?? "Match updated successfully.");

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setTableRows((currentRows) =>
        currentRows.map((row) =>
          row.matchId === matchId ? previousRow : row,
        ),
      );
      toast.error("The match could not be updated.");
    } finally {
      setPendingMatchIds((currentIds) =>
        currentIds.filter((currentId) => currentId !== matchId),
      );
    }
  }

  const visibleRows = getSortedRows(tableRows, sortKey, sortDirection);
  const batchLabel =
    roundSequenceNumber === null
      ? "Selected Round"
      : `Round ${roundSequenceNumber}`;

  return (
    <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
            Match Workflow
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {batchLabel} match statuses
            </h2>
            <span className="inline-flex items-center rounded-full border border-border bg-white/75 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              {roundStatus}
            </span>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-muted sm:text-base">
            Update interview workflow directly from the selected round instead
            of editing each business individually. Pairings outside the
            standard taxonomy rules are flagged in the table.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-white/75 px-4 py-3 text-sm leading-6 text-muted">
          <p>
            Saved matches in batch:{" "}
            <span className="font-semibold text-foreground">{rows.length}</span>
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-border bg-white/65 px-6 py-10 text-center">
          <p className="text-base font-medium text-foreground">
            {roundStatus === "draft"
              ? "No saved matches exist for this draft yet."
              : "No saved matches were found for this round."}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            {roundStatus === "draft"
              ? "Apply the round to sync the saved matches for its current assignments, or attach matches to this batch before tracking interview workflow here."
              : "Once matches are linked to this batch, their workflow fields will be editable here."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-white/80">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-brand-deep-soft/55 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium" scope="col">
                    <SortHeaderButton
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      label="Company"
                      onSort={onSort}
                      sortKey="companyName"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium" scope="col">
                    <SortHeaderButton
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      label="Publisher"
                      onSort={onSort}
                      sortKey="publisherName"
                    />
                  </th>
                  <th className="px-4 py-3 text-center font-medium" scope="col">
                    <SortHeaderButton
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      label="Interview Sent"
                      onSort={onSort}
                      sortKey="interviewSent"
                    />
                  </th>
                  <th className="px-4 py-3 text-center font-medium" scope="col">
                    <SortHeaderButton
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      label="Interview Published"
                      onSort={onSort}
                      sortKey="interviewPublished"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium" scope="col">
                    <SortHeaderButton
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      label="Status"
                      onSort={onSort}
                      sortKey="status"
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {visibleRows.map((row) => {
                  const isPending = pendingMatchIds.includes(row.matchId);
                  const matchingMethod = getRoundMatchMethod(
                    row.hostBusiness,
                    row.guestBusiness,
                  );

                  return (
                    <tr
                      className={isPending ? "bg-brand-deep-soft/30" : "bg-transparent"}
                      key={row.matchId}
                    >
                      <td className="px-4 py-4 align-middle">
                        <div className="space-y-1.5">
                          <Link
                            className="text-sm font-semibold text-foreground transition hover:text-accent"
                            href={getBusinessProfileHref(row.guestBusiness.businessId)}
                          >
                            {row.guestBusiness.businessName}
                          </Link>
                          <p className="text-xs uppercase tracking-[0.12em] text-muted">
                            {formatDomainRating(row.guestBusiness.domainRating)}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase ${getMatchingMethodClassName(matchingMethod)}`}
                          >
                            {getMatchingMethodLabel(matchingMethod)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="space-y-1">
                          <Link
                            className="text-sm font-semibold text-foreground transition hover:text-accent"
                            href={getBusinessProfileHref(row.hostBusiness.businessId)}
                          >
                            {row.hostBusiness.businessName}
                          </Link>
                          <p className="text-xs uppercase tracking-[0.12em] text-muted">
                            {formatDomainRating(row.hostBusiness.domainRating)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        <input
                          aria-label={`Interview sent for ${row.hostBusiness.businessName} to ${row.guestBusiness.businessName}`}
                          checked={row.interviewSent}
                          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/25"
                          disabled={isPending}
                          onChange={(event) => {
                            void updateMatch(row.matchId, {
                              interviewSent: event.target.checked,
                            });
                          }}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        <input
                          aria-label={`Interview published for ${row.hostBusiness.businessName} to ${row.guestBusiness.businessName}`}
                          checked={row.interviewPublished}
                          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/25"
                          disabled={isPending}
                          onChange={(event) => {
                            void updateMatch(row.matchId, {
                              interviewPublished: event.target.checked,
                            });
                          }}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <select
                          aria-label={`Status for ${row.hostBusiness.businessName} to ${row.guestBusiness.businessName}`}
                          className={`min-h-10 w-full min-w-44 rounded-2xl border px-3 py-2 text-sm font-medium shadow-sm outline-none transition ${getStatusSelectClassName(row.status)}`}
                          disabled={isPending}
                          onChange={(event) => {
                            void updateMatch(row.matchId, {
                              status: event.target.value as MatchStatus,
                            });
                          }}
                          value={row.status ?? "Not_Started"}
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}