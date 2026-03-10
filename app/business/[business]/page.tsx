import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessExchangeParticipationToggle } from "@/components/business-exchange-participation-toggle";
import { BusinessMatchesTable } from "@/components/business-matches-table";
import { BusinessRoleBadge } from "@/components/business-role-badge";
import { EditBusinessModal } from "@/components/edit-business-modal";
import { getBusinessByIdentifier, getBusinessMatchBoard } from "@/lib/matches";
import { getRoundBatchSummaries } from "@/lib/rounds";

export const dynamic = "force-dynamic";

type BusinessProfilePageProps = {
  params: Promise<{
    business: string;
  }>;
};

function formatSignedBalance(value: number | null) {
  if (value === null) {
    return "Not available";
  }

  if (value === 0) {
    return "0";
  }

  return `${value > 0 ? "+" : ""}${value}`;
}

function formatDomainRating(domainRating: number | null) {
  return domainRating === null ? "No DR" : `DR ${domainRating}`;
}

export default async function BusinessProfilePage({
  params,
}: BusinessProfilePageProps) {
  const resolvedParams = await params;
  const business = await getBusinessByIdentifier(resolvedParams.business);

  if (!business) {
    notFound();
  }

  const [rows, roundBatches] = await Promise.all([
    getBusinessMatchBoard(business.id),
    getRoundBatchSummaries(),
  ]);
  const businessDomainRating = business.domain_rating;
  const guestCount = rows.filter(
    (row) => row.counterpartRole === "guest",
  ).length;
  const hostCount = rows.filter((row) => row.counterpartRole === "host").length;
  const comparableRows =
    businessDomainRating === null
      ? []
      : rows.filter((row) => row.counterpart.domain_rating !== null);
  const hasMatchHistory = rows.length > 0;
  const authorityBalance =
    businessDomainRating === null || comparableRows.length === 0
      ? null
      : comparableRows.reduce(
          (sum, row) =>
            sum + businessDomainRating - row.counterpart.domain_rating!,
          0,
        );
  const authorityLabel = !hasMatchHistory
    ? "No match history"
    : authorityBalance === null
      ? "Awaiting DR data"
      : authorityBalance > 0
        ? "Authority Credit"
        : authorityBalance < 0
          ? "Authority Debt"
          : "Authority Balanced";
  const authorityToneClassName = !hasMatchHistory
    ? "border-[#c3ceda] bg-[#f1f5f8] text-[#55697e]"
    : authorityBalance === null
      ? "border-[#c3ceda] bg-[#f1f5f8] text-[#55697e]"
      : authorityBalance > 0
        ? "border-[#8cc6a7] bg-[#e9f8ef] text-[#276b4a]"
        : authorityBalance < 0
          ? "border-[#efb1a8] bg-[#fff0ec] text-[#b55247]"
          : "border-[#c3ceda] bg-[#f1f5f8] text-[#55697e]";
  const authorityGuidance = !hasMatchHistory
    ? "This business does not have any saved matches yet, so there is no authority balance to evaluate."
    : authorityBalance === null
      ? "Add a DR to this business and its matched counterparts to calculate the net authority balance."
      : authorityBalance > 0
        ? "This business has lent more authority than it borrowed and should next be the Guest on a higher-DR site."
        : authorityBalance < 0
          ? "This business has borrowed more authority than it lent and should next act as the Host for smaller sites."
          : "This business is currently balanced across comparable matches and does not need to correct its authority profile.";
  const authorityCoverageLabel = !hasMatchHistory
    ? "No saved matches yet."
    : businessDomainRating === null
      ? "Current business DR is missing."
      : comparableRows.length === rows.length
        ? `Based on ${comparableRows.length} matched ${comparableRows.length === 1 ? "business" : "businesses"} with DR data.`
        : `Based on ${comparableRows.length} of ${rows.length} matched ${rows.length === 1 ? "business" : "businesses"} with DR data.`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-8xl flex-col gap-8 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <Link
            className="inline-flex items-center rounded-full border border-border bg-white/70 px-4 py-1.5 text-sm font-medium tracking-[0.16em] text-accent uppercase transition hover:border-accent/35 hover:bg-white/85"
            href="/matches"
          >
            Back To Match Table
          </Link>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
                Business Profile
              </p>
              <BusinessRoleBadge role={business.clientType} />
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {business.business}
            </h1>

            {business.websiteUrl ? (
              <a
                className="inline-flex text-base font-medium text-accent transition hover:text-accent-strong"
                href={business.websiteUrl}
                rel="noreferrer"
                target="_blank"
              >
                {business.websiteUrl}
              </a>
            ) : (
              <p className="text-base text-muted">
                No website URL has been saved yet.
              </p>
            )}

            <p className="max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Track the match workflow for this business in one place. You can
              sort the table, filter to only guests or hosts, update status from
              the dropdown, and toggle whether the interview was sent or
              published.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <Link
            className="inline-flex items-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            href={`/matches/${business.id}`}
          >
            Find AI Matches
          </Link>
          <EditBusinessModal business={business} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-4xl border border-border bg-surface p-5 shadow-(--shadow) backdrop-blur-md sm:p-6">
          <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
            Total Matches
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            {rows.length}
          </p>
        </div>
        <div className="rounded-4xl border border-border bg-surface p-5 shadow-(--shadow) backdrop-blur-md sm:p-6">
          <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
            Guests
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            {guestCount}
          </p>
        </div>
        <div className="rounded-4xl border border-border bg-surface p-5 shadow-(--shadow) backdrop-blur-md sm:p-6">
          <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
            Hosts
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            {hostCount}
          </p>
        </div>
        <div className="rounded-4xl border border-accent bg-accent p-5 text-white shadow-(--shadow) sm:p-6">
          <p className="text-sm font-medium tracking-[0.16em] text-white/78 uppercase">
            Domain Rating
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
            {businessDomainRating ?? "N/A"}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/78">
            {businessDomainRating === null
              ? "No DR has been saved for this business yet."
              : formatDomainRating(businessDomainRating)}
          </p>
        </div>
      </section>

      <BusinessExchangeParticipationToggle
        businessId={business.id}
        businessName={business.business}
        initialStatus={business.aiAuthorityExchangeParticipationStatus}
      />

      <section className="rounded-4xl border border-accent/15 bg-[linear-gradient(135deg,rgba(232,93,79,0.08),rgba(255,255,255,0.92))] p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
              Domain Debt
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Net Authority Balance for {business.business}
            </h2>
            <p className="text-sm leading-7 text-muted sm:text-base">
              Each match contributes this business DR minus the counterpart DR.
              Hosting usually adds positive balance, while appearing as a guest
              on a stronger site usually pushes the balance negative.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <span
              className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${authorityToneClassName}`}
            >
              {authorityLabel}
            </span>
            <p className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {formatSignedBalance(authorityBalance)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-3xl border border-white/60 bg-white/75 p-5">
            <p className="text-sm font-medium text-foreground">
              What to do next
            </p>
            <p className="mt-2 text-sm leading-7 text-muted sm:text-base">
              {authorityGuidance}
            </p>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/75 p-5">
            <p className="text-sm font-medium text-foreground">Data coverage</p>
            <p className="mt-2 text-sm leading-7 text-muted sm:text-base">
              {authorityCoverageLabel}
            </p>
            <p className="mt-2 text-sm leading-7 text-muted sm:text-base">
              Current site: {formatDomainRating(businessDomainRating)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
        <BusinessMatchesTable
          business={business}
          roundBatches={roundBatches.map((batch) => ({
            id: batch.id,
            sequenceNumber: batch.sequenceNumber,
            status: batch.status,
          }))}
          rows={rows}
        />
      </section>
    </main>
  );
}
