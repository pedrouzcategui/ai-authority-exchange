import { AddClientModal } from "@/components/add-client-modal";
import { ActionTooltip, FindMatchesIcon } from "@/components/action-icons";
import { BusinessRoleBadge } from "@/components/business-role-badge";
import { EditBusinessModal } from "@/components/edit-business-modal";
import { ManageBusinessRelationshipsModal } from "@/components/manage-business-relationships-modal";
import Link from "next/link";
import { MatchesFilterControls } from "@/components/matches-filter-controls";
import { getBusinessProfileHref } from "@/lib/business-profile-route";
import {
  getBusinesses,
  getBusinessContacts,
  getExplicitlyActiveExchangeBusinesses,
  getBusinessRelationshipRows,
  type BusinessOption,
} from "@/lib/matches";

export const dynamic = "force-dynamic";

type RelationshipPillsProps = {
  businesses: BusinessOption[];
  emptyLabel: string;
  tone: "accent" | "danger" | "neutral";
};

type MatchesPageProps = {
  searchParams?: Promise<{
    business?: string | string[];
    guest?: string | string[];
    host?: string | string[];
    page?: string | string[];
    perPage?: string | string[];
  }>;
};

function parseFilterId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate) {
    return undefined;
  }

  const parsedValue = Number.parseInt(candidate, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return undefined;
  }

  return parsedValue;
}

function parsePageNumber(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate) {
    return 1;
  }

  const parsedValue = Number.parseInt(candidate, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return 1;
  }

  return parsedValue;
}

function parseResultsPerPage(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate) {
    return 5;
  }

  const parsedValue = Number.parseInt(candidate, 10);

  return parsedValue === 10 || parsedValue === 20 ? parsedValue : 5;
}

function buildMatchesQuery(params: {
  business?: number;
  guest?: number;
  host?: number;
  page?: number;
  perPage?: number;
}) {
  const searchParams = new URLSearchParams();

  if (params.business !== undefined) {
    searchParams.set("business", params.business.toString());
  }

  if (params.host !== undefined) {
    searchParams.set("host", params.host.toString());
  }

  if (params.guest !== undefined) {
    searchParams.set("guest", params.guest.toString());
  }

  if (params.perPage !== undefined) {
    searchParams.set("perPage", params.perPage.toString());
  }

  if (params.page !== undefined && params.page > 1) {
    searchParams.set("page", params.page.toString());
  }

  return searchParams.toString();
}

function RelationshipPills({
  businesses,
  emptyLabel,
  tone,
}: RelationshipPillsProps) {
  if (businesses.length === 0) {
    return <p className="text-sm leading-7 text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {businesses.map((business) => (
        <span
          key={`${tone}-${business.id}`}
          className={
            tone === "accent"
              ? "inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-[13px] font-medium text-accent-strong"
              : tone === "danger"
                ? "inline-flex items-center rounded-full border border-danger-strong/15 bg-danger-soft px-2.5 py-0.5 text-[13px] font-medium text-danger-strong"
                : "inline-flex items-center rounded-full border border-border bg-brand-deep-soft/55 px-2.5 py-0.5 text-[13px] font-medium text-foreground"
          }
        >
          {business.business}
        </span>
      ))}
    </div>
  );
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedBusinessFilter = parseFilterId(resolvedSearchParams.business);
  const requestedHostFilter = parseFilterId(resolvedSearchParams.host);
  const requestedGuestFilter = parseFilterId(resolvedSearchParams.guest);
  const businessFilter =
    requestedHostFilter === undefined && requestedGuestFilter === undefined
      ? requestedBusinessFilter
      : undefined;
  const hostFilter =
    businessFilter === undefined ? requestedHostFilter : undefined;
  const guestFilter =
    businessFilter === undefined ? requestedGuestFilter : undefined;
  const requestedPage = parsePageNumber(resolvedSearchParams.page);
  const perPage = parseResultsPerPage(resolvedSearchParams.perPage);
  const [businesses, relationshipRows, allBusinesses, businessContacts] =
    await Promise.all([
      getExplicitlyActiveExchangeBusinesses(),
      getBusinessRelationshipRows(hostFilter, guestFilter, businessFilter),
      getBusinesses(),
      getBusinessContacts(),
    ]);
  const businessById = new Map(
    businesses.map((business) => [business.id, business.business] as const),
  );
  const hasFilters =
    businessFilter !== undefined ||
    hostFilter !== undefined ||
    guestFilter !== undefined;
  const activeFilters = [
    businessFilter === undefined
      ? null
      : `Business: ${businessById.get(businessFilter) ?? "selected business"}`,
    hostFilter === undefined
      ? null
      : `Publisher: ${businessById.get(hostFilter) ?? "selected business"}`,
    guestFilter === undefined
      ? null
      : `Published for: ${businessById.get(guestFilter) ?? "selected business"}`,
  ].filter((value): value is string => value !== null);
  const totalBusinesses = relationshipRows.length;
  const visibleBusinessLabel = `${totalBusinesses} business${totalBusinesses === 1 ? "" : "es"}`;
  const relationshipsCount = relationshipRows.reduce(
    (count, row) => count + row.publishedFor.length,
    0,
  );
  const relationshipsLabel = `${relationshipsCount} publishing relationship${relationshipsCount === 1 ? "" : "s"}`;
  const totalPages = Math.max(1, Math.ceil(totalBusinesses / perPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStartIndex =
    totalBusinesses === 0 ? 0 : (currentPage - 1) * perPage;
  const pageEndIndex = Math.min(pageStartIndex + perPage, totalBusinesses);
  const paginatedRows = relationshipRows.slice(pageStartIndex, pageEndIndex);
  const paginationSummary =
    totalBusinesses === 0
      ? "Showing 0 businesses."
      : `Showing businesses ${pageStartIndex + 1}-${pageEndIndex} of ${totalBusinesses}.`;
  const previousPageQuery = buildMatchesQuery({
    business: businessFilter,
    host: hostFilter,
    guest: guestFilter,
    page: currentPage - 1,
    perPage,
  });
  const nextPageQuery = buildMatchesQuery({
    business: businessFilter,
    host: hostFilter,
    guest: guestFilter,
    page: currentPage + 1,
    perPage,
  });
  const exportHref = (() => {
    const exportQuery = buildMatchesQuery({
      business: businessFilter,
      host: hostFilter,
      guest: guestFilter,
    });

    return exportQuery.length === 0
      ? "/api/matches/export"
      : `/api/matches/export?${exportQuery}`;
  })();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-8xl flex-col gap-8 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
            Match Table
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Business publishing relationships
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted sm:text-lg">
            Each row shows the business, who published them, and who they were
            published for.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            className="inline-flex items-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            href="/rounds"
          >
            View Rounds
          </Link>
          <AddClientModal />
        </div>
      </section>

      <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
        <MatchesFilterControls
          businessFilter={businessFilter}
          businesses={businesses}
          exportHref={exportHref}
          guestFilter={guestFilter}
          hasFilters={hasFilters}
          hostFilter={hostFilter}
          key={`filters-${businessFilter ?? "all"}-${hostFilter ?? "all"}-${guestFilter ?? "all"}-${perPage}`}
          perPage={perPage}
        />

        <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm leading-7 text-muted">{paginationSummary}</p>
            <p className="text-sm leading-7 text-muted">
              {hasFilters
                ? `Showing ${visibleBusinessLabel} across ${relationshipsLabel} for ${activeFilters.join(" | ")}.`
                : `Showing ${visibleBusinessLabel} across ${relationshipsLabel}.`}
            </p>
          </div>
          <p className="text-sm leading-7 text-muted">
            {businesses.length} total businesses available.
          </p>
        </div>
      </section>

      <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
        {businesses.length === 0 ? (
          <div className="rounded-4xl border border-dashed border-border bg-white/60 px-6 py-14 text-center">
            <p className="text-lg font-medium text-foreground">
              No businesses available yet.
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              Add business records first, then create matches from the home
              page.
            </p>
          </div>
        ) : relationshipRows.length === 0 ? (
          <div className="rounded-4xl border border-dashed border-border bg-white/60 px-6 py-14 text-center">
            <p className="text-lg font-medium text-foreground">
              No businesses matched those filters.
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              Try a different publisher or published-for business, or clear the
              filters to see the full table.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-4xl border border-border bg-white/72">
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-brand-deep-soft/75 text-left text-sm font-medium tracking-[0.16em] text-muted uppercase">
                    <th className="px-6 py-4 sm:px-8">Business</th>
                    <th className="px-6 py-4 sm:px-8">Client Type</th>
                    <th className="px-6 py-4 sm:px-8">Published For</th>
                    <th className="px-6 py-4 sm:px-8">Published By</th>
                    <th className="px-6 py-4 sm:px-8">Forbidden Competitors</th>
                    <th className="w-42 px-6 py-4 text-right sm:px-8">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={row.id} className="bg-white/65 align-top">
                      <td className="border-t border-border px-6 py-5 sm:px-8">
                        <Link
                          className="font-semibold text-foreground transition hover:text-accent"
                          href={getBusinessProfileHref(row.id)}
                        >
                          {row.business}
                        </Link>
                      </td>
                      <td className="border-t border-border px-6 py-5 sm:px-8">
                        <BusinessRoleBadge role={row.clientType} />
                      </td>
                      <td className="border-t border-border px-6 py-5 sm:px-8">
                        <RelationshipPills
                          businesses={row.publishedFor}
                          emptyLabel="Not published for any businesses yet."
                          tone="accent"
                        />
                      </td>
                      <td className="border-t border-border px-6 py-5 sm:px-8">
                        <RelationshipPills
                          businesses={row.publishedBy}
                          emptyLabel="No publishers yet."
                          tone="neutral"
                        />
                      </td>
                      <td className="border-t border-border px-6 py-5 sm:px-8">
                        <RelationshipPills
                          businesses={row.forbiddenBusinesses}
                          emptyLabel="No forbidden competitors."
                          tone="danger"
                        />
                      </td>
                      <td className="w-42 border-t border-border px-6 py-5 text-right align-middle sm:px-8">
                        <div className="flex flex-nowrap justify-end gap-2 whitespace-nowrap">
                          <span className="group relative inline-flex">
                            <Link
                              aria-label="Find matches"
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/80 text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
                              href={`/matches/${row.id}`}
                              prefetch={false}
                            >
                              <FindMatchesIcon />
                            </Link>
                            <ActionTooltip label="Find matches" />
                          </span>
                          <EditBusinessModal
                            business={row}
                            contacts={businessContacts}
                            triggerVariant="icon"
                          />
                          <ManageBusinessRelationshipsModal
                            business={row}
                            businesses={allBusinesses}
                            publishedBy={row.publishedBy}
                            publishedFor={row.publishedFor}
                            triggerVariant="icon"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {relationshipRows.length > 0 && totalPages > 1 ? (
          <div className="mt-5 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-7 text-muted">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                aria-disabled={currentPage === 1}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent aria-disabled:pointer-events-none aria-disabled:opacity-45"
                href={currentPage === 1 ? "#" : `/matches?${previousPageQuery}`}
              >
                Previous
              </Link>
              <Link
                aria-disabled={currentPage >= totalPages}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent aria-disabled:pointer-events-none aria-disabled:opacity-45"
                href={
                  currentPage >= totalPages ? "#" : `/matches?${nextPageQuery}`
                }
              >
                Next
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
