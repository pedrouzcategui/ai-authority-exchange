"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MatchStatus } from "@/generated/prisma/client";
import { getBusinessProfileHref } from "@/lib/business-profile-route";
import type { BusinessMatchBoardRow } from "@/lib/matches";

type BusinessMatchesTableProps = {
  businessName: string;
  rows: BusinessMatchBoardRow[];
};

type RoleFilter = "all" | "guest" | "host";

type SortDirection = "asc" | "desc";

type SortKey =
  | "companyName"
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

const statusOptions: Array<{ label: string; value: MatchStatus }> = [
  { label: "Not Started", value: "Not_Started" },
  { label: "In Progress", value: "In_Progress" },
  { label: "Done", value: "Done" },
  { label: "Leaving", value: "Leaving" },
  { label: "Partner Leaving", value: "Partner_Leaving" },
];

const statusOrder = new Map(statusOptions.map((option, index) => [option.value, index]));

function getRoleLabel(role: BusinessMatchBoardRow["counterpartRole"]) {
  return role === "guest" ? "Guest" : "Host";
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
      className={active ? "h-3.5 w-3.5 text-accent" : "h-3.5 w-3.5 text-muted/60"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {direction === "asc" ? <path d="m7 14 5-5 5 5" /> : <path d="m7 10 5 5 5-5" />}
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
  businessName,
  rows,
}: BusinessMatchesTableProps) {
  const router = useRouter();
  const [tableRows, setTableRows] = useState(rows);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("companyName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pendingMatchIds, setPendingMatchIds] = useState<number[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setTableRows(rows);
  }, [rows]);

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
      Pick<BusinessMatchBoardRow, "interviewPublished" | "interviewSent" | "status">
    >,
  ) {
    const previousRow = tableRows.find((row) => row.id === matchId);

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
          interviewPublished: boolean;
          interviewSent: boolean;
          status: MatchStatus | null;
        };
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
            guests or hosts, and sort any column directly from the table header.
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
            Switch back to All Matches to review the full table.
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
                            className="text-sm font-semibold text-foreground transition hover:text-accent"
                            href={getBusinessProfileHref(row.counterpart.id)}
                          >
                            {row.counterpart.business}
                          </Link>
                          {row.counterpart.websiteUrl ? (
                            <a
                              className="block text-xs font-medium text-accent transition hover:text-accent-strong"
                              href={row.counterpart.websiteUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {row.counterpart.websiteUrl.replace(/^https?:\/\//, "")}
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-t border-border px-5 py-4 sm:px-6">
                        <span
                          className={`inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-semibold ${getCounterpartRoleClassName(
                            row.counterpartRole,
                          )}`}
                        >
                          {getRoleLabel(row.counterpartRole)}
                        </span>
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