"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreateEmailDraftButton } from "@/components/create-email-draft-button";
import type { MatchStatus, RoundBatchStatus } from "@/generated/prisma/client";
import { getBusinessProfileHref } from "@/lib/business-profile-route";
import type { BusinessMatchBoardRow, BusinessOption } from "@/lib/matches";

type BusinessMatchesTableRoundBatch = {
  id: number;
  sequenceNumber: number;
  status: RoundBatchStatus;
};

type BusinessMatchesTableProps = {
  business: BusinessOption;
  roundBatches: BusinessMatchesTableRoundBatch[];
  rows: BusinessMatchBoardRow[];
};

type RoleFilter = "all" | "guest" | "host";

type RoundFilter = "all" | "none" | `batch:${number}`;

type SortDirection = "asc" | "desc";

type SortKey =
  | "companyName"
  | "round"
  | "counterpartRole"
  | "interviewPublished"
  | "interviewSent"
  | "status";

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const roleFilterOptions: Array<{ label: string; value: RoleFilter }> = [
  { label: "All Matches", value: "all" },
  { label: "Only Guests", value: "guest" },
  { label: "Only Hosts", value: "host" },
];

function getRoundFilterValue(roundBatchId: number) {
  return `batch:${roundBatchId}` as const;
}

function parseRoundFilterValue(value: RoundFilter) {
  if (value === "all" || value === "none") {
    return null;
  }

  const parsedValue = Number.parseInt(value.replace("batch:", ""), 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

const statusOptions: Array<{ label: string; value: MatchStatus }> = [
  { label: "Not Started", value: "Not_Started" },
  { label: "In Progress", value: "In_Progress" },
  { label: "Done", value: "Done" },
  { label: "Leaving", value: "Leaving" },
  { label: "Partner Leaving", value: "Partner_Leaving" },
];

const statusOrder = new Map(
  statusOptions.map((option, index) => [option.value, index]),
);

function getRoleLabel(role: BusinessMatchBoardRow["counterpartRole"]) {
  return role === "guest" ? "Guest" : "Host";
}

function formatDomainRating(domainRating: number | null) {
  return domainRating === null ? "No DR" : `DR ${domainRating}`;
}

function formatRoundBatchLabel(roundBatch: BusinessMatchesTableRoundBatch) {
  return `Round ${roundBatch.sequenceNumber} (${roundBatch.status === "draft" ? "Draft" : "Applied"})`;
}

function compareRoundAssignments(
  left: Pick<BusinessMatchBoardRow, "roundBatchId" | "roundSequenceNumber">,
  right: Pick<BusinessMatchBoardRow, "roundBatchId" | "roundSequenceNumber">,
) {
  if (left.roundBatchId === null && right.roundBatchId === null) {
    return 0;
  }

  if (left.roundBatchId === null) {
    return 1;
  }

  if (right.roundBatchId === null) {
    return -1;
  }

  const leftSequenceNumber = left.roundSequenceNumber ?? Number.MAX_SAFE_INTEGER;
  const rightSequenceNumber =
    right.roundSequenceNumber ?? Number.MAX_SAFE_INTEGER;

  if (leftSequenceNumber !== rightSequenceNumber) {
    return leftSequenceNumber - rightSequenceNumber;
  }

  return left.roundBatchId - right.roundBatchId;
}

function parseSelectedRoundBatchId(value: string) {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function getStatusSelectClassName(status: MatchStatus | null) {
  switch (status ?? "Not_Started") {
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

function getCounterpartRoleClassName(
  role: BusinessMatchBoardRow["counterpartRole"],
) {
  return role === "guest"
    ? "border-[#f0b8b0] bg-[#fff0ec] text-[#b55247]"
    : "border-[#c3ceda] bg-[#f1f5f8] text-[#55697e]";
}

const counterpartRoleOptions: Array<{
  label: string;
  value: BusinessMatchBoardRow["counterpartRole"];
}> = [
  { label: "Guest", value: "guest" },
  { label: "Host", value: "host" },
];

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

export function BusinessMatchesTable({
  business,
  roundBatches,
  rows,
}: BusinessMatchesTableProps) {
  const businessName = business.business;
  const router = useRouter();
  const [tableRows, setTableRows] = useState(rows);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [roundFilter, setRoundFilter] = useState<RoundFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("companyName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pendingMatchIds, setPendingMatchIds] = useState<number[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setTableRows(rows);
  }, [rows]);

  const roundFilterOptions = (() => {
    const options: Array<{ label: string; value: RoundFilter }> = [
      { label: "All Rounds", value: "all" },
    ];
    const seenRoundBatchIds = new Set<number>();

    for (const roundBatch of roundBatches) {
      seenRoundBatchIds.add(roundBatch.id);
      options.push({
        label: formatRoundBatchLabel(roundBatch),
        value: getRoundFilterValue(roundBatch.id),
      });
    }

    for (const row of tableRows) {
      if (
        row.roundBatchId !== null &&
        row.roundSequenceNumber !== null &&
        row.roundStatus !== null &&
        !seenRoundBatchIds.has(row.roundBatchId)
      ) {
        seenRoundBatchIds.add(row.roundBatchId);
        options.push({
          label: `Round ${row.roundSequenceNumber} (${row.roundStatus === "draft" ? "Draft" : "Applied"})`,
          value: getRoundFilterValue(row.roundBatchId),
        });
      }
    }

    if (tableRows.some((row) => row.roundBatchId === null)) {
      options.push({ label: "No Round", value: "none" });
    }

    return options;
  })();

  function handleSort(nextSortKey: SortKey) {
    setSortDirection((currentDirection) =>
      nextSortKey === sortKey
        ? currentDirection === "asc"
          ? "desc"
          : "asc"
        : "asc",
    );
    setSortKey(nextSortKey);
  }

  async function updateMatch(
    matchId: number,
    updates: Partial<
      Pick<
        BusinessMatchBoardRow,
        | "counterpartRole"
        | "interviewPublished"
        | "interviewSent"
        | "roundBatchId"
        | "status"
      >
    >,
  ) {
    const previousRow = tableRows.find((row) => row.id === matchId);

    if (!previousRow) {
      return;
    }

    const requestBody: {
      businessId?: number;
      counterpartRole?: BusinessMatchBoardRow["counterpartRole"];
      interviewPublished?: boolean;
      interviewSent?: boolean;
      matchId: number;
      roundBatchId?: number | null;
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

    if (updates.roundBatchId !== undefined) {
      requestBody.roundBatchId = updates.roundBatchId;
    }

    if (updates.counterpartRole !== undefined) {
      requestBody.businessId = business.id;
      requestBody.counterpartRole = updates.counterpartRole;
    }

    setPendingMatchIds((currentIds) => [...currentIds, matchId]);
    setTableRows((currentRows) =>
      currentRows.map((row) =>
        row.id === matchId
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
          counterpartRole?: BusinessMatchBoardRow["counterpartRole"];
          interviewPublished: boolean;
          interviewSent: boolean;
          roundBatchId: number | null;
          roundSequenceNumber: number | null;
          roundStatus: RoundBatchStatus | null;
          status: MatchStatus | null;
        };
        message?: string;
      } | null;

      if (!response.ok || !payload?.match) {
        setTableRows((currentRows) =>
          currentRows.map((row) => (row.id === matchId ? previousRow : row)),
        );
        toast.error(payload?.error ?? "The match could not be updated.");
        return;
      }

      setTableRows((currentRows) =>
        currentRows.map((row) =>
          row.id === matchId
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
        currentRows.map((row) => (row.id === matchId ? previousRow : row)),
      );
      toast.error("The match could not be updated.");
    } finally {
      setPendingMatchIds((currentIds) =>
        currentIds.filter((currentId) => currentId !== matchId),
      );
    }
  }

  const visibleRows = tableRows
    .filter((row) => roleFilter === "all" || row.counterpartRole === roleFilter)
    .filter((row) => {
      if (roundFilter === "all") {
        return true;
      }

      if (roundFilter === "none") {
        return row.roundBatchId === null;
      }

      return row.roundBatchId === parseRoundFilterValue(roundFilter);
    })
    .slice()
    .sort((left, right) => {
      let comparison = 0;

      switch (sortKey) {
        case "companyName":
          comparison = collator.compare(
            left.counterpart.business,
            right.counterpart.business,
          );
          break;
        case "round":
          comparison = compareRoundAssignments(left, right);
          break;
        case "counterpartRole":
          comparison = collator.compare(
            getRoleLabel(left.counterpartRole),
            getRoleLabel(right.counterpartRole),
          );
          break;
        case "interviewSent":
          comparison = Number(left.interviewSent) - Number(right.interviewSent);
          break;
        case "interviewPublished":
          comparison =
            Number(left.interviewPublished) - Number(right.interviewPublished);
          break;
        case "status":
          comparison =
            (statusOrder.get(left.status ?? "Not_Started") ?? -1) -
            (statusOrder.get(right.status ?? "Not_Started") ?? -1);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
            Matches And Statuses
          </p>
          <p className="max-w-3xl text-sm leading-7 text-muted sm:text-base">
            Review every saved match connected to {businessName}. Filter to only
            guests or hosts, sort any column directly from the table header, and
            assign each match to the round where it belongs.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="inline-flex rounded-full border border-border bg-white/80 p-1">
            {roleFilterOptions.map((option) => (
              <button
                className={
                  option.value === roleFilter
                    ? "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-full px-4 py-2 text-sm font-medium text-muted transition hover:text-accent"
                }
                key={option.value}
                onClick={() => setRoleFilter(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="relative inline-flex">
            <select
              aria-label="Filter matches by round"
              className="min-h-11 min-w-44 appearance-none rounded-full border border-border bg-white/80 px-4 pr-10 pl-4 text-sm font-medium text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              onChange={(event) =>
                setRoundFilter(event.target.value as RoundFilter)
              }
              value={roundFilter}
            >
              {roundFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-current"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path d="m7 10 5 5 5-5" />
            </svg>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-muted">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            {visibleRows.length} showing
          </div>
        </div>
      </div>

      {tableRows.length === 0 ? (
        <div className="rounded-4xl border border-dashed border-border bg-white/60 px-6 py-14 text-center">
          <p className="text-lg font-medium text-foreground">
            No matches have been saved for {businessName} yet.
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Create a match from the main table, then return here to track the
            interview workflow.
          </p>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-4xl border border-dashed border-border bg-white/60 px-6 py-14 text-center">
          <p className="text-lg font-medium text-foreground">
            No rows matched the current role filter.
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Adjust the role or round filter to review other matches.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-4xl border border-border bg-white/72">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-brand-deep-soft/75 text-left text-xs font-semibold tracking-[0.16em] text-muted uppercase">
                  <th className="px-5 py-4 sm:px-6">
                    <SortHeaderButton
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      label="Company Name"
                      onSort={handleSort}
                      sortKey="companyName"
                    />
                  </th>
                  <th className="px-5 py-4 sm:px-6">
                    <SortHeaderButton
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      label="Round"
                      onSort={handleSort}
                      sortKey="round"
                    />
                  </th>
                  <th className="px-5 py-4 sm:px-6">
                    <SortHeaderButton
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      label="Company Role"
                      onSort={handleSort}
                      sortKey="counterpartRole"
                    />
                  </th>
                  <th className="px-5 py-4 text-center sm:px-6">
                    <SortHeaderButton
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      label="Interview Sent"
                      onSort={handleSort}
                      sortKey="interviewSent"
                    />
                  </th>
                  <th className="px-5 py-4 text-center sm:px-6">
                    <SortHeaderButton
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      label="Interview Published"
                      onSort={handleSort}
                      sortKey="interviewPublished"
                    />
                  </th>
                  <th className="px-5 py-4 sm:px-6">
                    <SortHeaderButton
                      activeSortKey={sortKey}
                      direction={sortDirection}
                      label="Status"
                      onSort={handleSort}
                      sortKey="status"
                    />
                  </th>
                  <th className="w-28 px-5 py-4 text-right sm:px-6">Draft</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const isPending = pendingMatchIds.includes(row.id);

                  return (
                    <tr key={row.id} className="align-middle">
                      <td className="border-t border-border px-5 py-4 sm:px-6">
                        <div className="space-y-1.5">
                          <Link
                            className="block text-sm font-semibold text-foreground transition hover:text-accent"
                            href={getBusinessProfileHref(row.counterpart.id)}
                          >
                            {row.counterpart.business}
                          </Link>
                          <span className="inline-flex items-center rounded-full border border-border bg-brand-deep-soft/55 px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                            {formatDomainRating(row.counterpart.domain_rating)}
                          </span>
                          {row.counterpart.websiteUrl ? (
                            <a
                              className="block text-xs font-medium text-accent transition hover:text-accent-strong"
                              href={row.counterpart.websiteUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {row.counterpart.websiteUrl.replace(
                                /^https?:\/\//,
                                "",
                              )}
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-t border-border px-5 py-4 sm:px-6">
                        <div className="relative inline-flex">
                          <select
                            aria-busy={isPending}
                            className="min-h-10 min-w-44 appearance-none rounded-full border border-border bg-white/85 px-4 pr-10 pl-4 text-sm font-semibold text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isPending}
                            onChange={(event) =>
                              updateMatch(row.id, {
                                roundBatchId: parseSelectedRoundBatchId(
                                  event.target.value,
                                ),
                              })
                            }
                            value={
                              row.roundBatchId === null
                                ? ""
                                : row.roundBatchId.toString()
                            }
                          >
                            <option value="">
                              {roundBatches.length === 0
                                ? "No rounds available"
                                : "No round"}
                            </option>
                            {roundBatches.map((roundBatch) => (
                              <option key={roundBatch.id} value={roundBatch.id}>
                                {formatRoundBatchLabel(roundBatch)}
                              </option>
                            ))}
                          </select>
                          <svg
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-current"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            viewBox="0 0 24 24"
                          >
                            <path d="m7 10 5 5 5-5" />
                          </svg>
                        </div>
                      </td>
                      <td className="border-t border-border px-5 py-4 sm:px-6">
                        <div className="relative inline-flex">
                          <select
                            aria-busy={isPending}
                            className={`min-h-10 min-w-32 appearance-none rounded-full border px-4 pr-10 pl-4 text-sm font-semibold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${getCounterpartRoleClassName(
                              row.counterpartRole,
                            )}`}
                            disabled={isPending}
                            onChange={(event) =>
                              updateMatch(row.id, {
                                counterpartRole: event.target
                                  .value as BusinessMatchBoardRow["counterpartRole"],
                              })
                            }
                            value={row.counterpartRole}
                          >
                            {counterpartRoleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <svg
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-current"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            viewBox="0 0 24 24"
                          >
                            <path d="m7 10 5 5 5-5" />
                          </svg>
                        </div>
                      </td>
                      <td className="border-t border-border px-5 py-4 text-center sm:px-6">
                        <input
                          checked={row.interviewSent}
                          className="h-4 w-4 cursor-pointer rounded border-border accent-accent disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={isPending}
                          onChange={(event) =>
                            updateMatch(row.id, {
                              interviewSent: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                      </td>
                      <td className="border-t border-border px-5 py-4 text-center sm:px-6">
                        <input
                          checked={row.interviewPublished}
                          className="h-4 w-4 cursor-pointer rounded border-border accent-accent disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={isPending}
                          onChange={(event) =>
                            updateMatch(row.id, {
                              interviewPublished: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                      </td>
                      <td className="border-t border-border px-5 py-4 sm:px-6">
                        <div className="relative inline-flex">
                          <select
                            aria-busy={isPending}
                            className={`min-h-10 min-w-40 appearance-none rounded-full border px-4 pr-10 pl-4 text-sm font-semibold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${getStatusSelectClassName(
                              row.status,
                            )}`}
                            disabled={isPending}
                            onChange={(event) =>
                              updateMatch(row.id, {
                                status: event.target.value as MatchStatus,
                              })
                            }
                            value={row.status ?? "Not_Started"}
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <svg
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-current"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            viewBox="0 0 24 24"
                          >
                            <path d="m7 10 5 5 5-5" />
                          </svg>
                        </div>
                      </td>
                      <td className="border-t border-border px-5 py-4 text-right sm:px-6">
                        <div className="flex justify-end">
                          <CreateEmailDraftButton
                            guestId={
                              row.counterpartRole === "guest"
                                ? row.counterpart.id
                                : business.id
                            }
                            hostId={
                              row.counterpartRole === "guest"
                                ? business.id
                                : row.counterpart.id
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
