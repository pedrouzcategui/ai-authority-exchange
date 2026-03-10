import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessMatchAnalysisToast } from "@/components/business-match-analysis-toast";
import { getBusinessProfileHref } from "@/lib/business-profile-route";
import {
  findBusinessMatches,
  getLocalBusinessMatchCandidates,
  type BusinessMatchLookupResult,
  type LocalBusinessMatchCandidate,
  type MatchSearchScope,
} from "@/lib/business-match-finder";
import {
  getBusinessById,
  getBusinessRelationshipRows,
  type BusinessOption,
} from "@/lib/matches";

export const dynamic = "force-dynamic";

type BusinessMatchesPageProps = {
  params: Promise<{
    businessId: string;
  }>;
  searchParams?: Promise<{
    scope?: string | string[];
  }>;
};

function parseBusinessId(value: string) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function formatScore(score: number | null) {
  if (score === null) {
    return "Score unavailable";
  }

  if (Number.isInteger(score)) {
    return `${score}/100`;
  }

  return score.toString();
}

function getPartnerPreview(copy: {
  competitionRationale: string | null;
  editorialBridge: string | null;
  matchRationale: string | null;
}) {
  return (
    copy.matchRationale ??
    copy.editorialBridge ??
    copy.competitionRationale ??
    "Open to review the full rationale and suggested editorial angles."
  );
}

function formatDomainRating(domainRating: number | null) {
  return domainRating === null ? "No DR" : `DR ${domainRating}`;
}

function parseMatchSearchScope(
  value: string | string[] | undefined,
): MatchSearchScope {
  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate === "same-category-or-sector"
    ? "same-category-or-sector"
    : "same-category";
}

function buildBusinessMatchesHref(
  businessId: number,
  scope: MatchSearchScope,
) {
  const searchParams = new URLSearchParams();

  if (scope !== "same-category") {
    searchParams.set("scope", scope);
  }

  const query = searchParams.toString();

  return query.length === 0
    ? `/matches/${businessId}`
    : `/matches/${businessId}?${query}`;
}

function WaitingSparkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 text-accent"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3L13.9 8.1L19 10L13.9 11.9L12 17L10.1 11.9L5 10L10.1 8.1L12 3Z"
        fill="currentColor"
      />
      <path
        d="M18.5 3.5L19 5L20.5 5.5L19 6L18.5 7.5L18 6L16.5 5.5L18 5L18.5 3.5Z"
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  );
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function getCandidateForMatch(
  match: BusinessMatchLookupResult extends { matches: infer Matches }
    ? Matches extends Array<infer Match>
      ? Match
      : never
    : never,
  candidatesById: Map<number, LocalBusinessMatchCandidate>,
  candidatesByName: Map<string, LocalBusinessMatchCandidate>,
) {
  if (match.selectedPartnerId !== null) {
    const matchById = candidatesById.get(match.selectedPartnerId);

    if (matchById) {
      return matchById;
    }
  }

  return candidatesByName.get(normalizeName(match.partnerName));
}

function LocalShortlistTable({
  localCandidates,
}: {
  localCandidates: LocalBusinessMatchCandidate[];
}) {
  if (localCandidates.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-white/75 p-5 text-sm leading-7 text-muted">
        No businesses matched the selected search scope.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-4xl border border-border bg-white/75">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-brand-deep-soft/75 text-left text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              <th className="px-5 py-4 sm:px-6">Business Name</th>
              <th className="px-5 py-4 sm:px-6">Category Name</th>
              <th className="px-5 py-4 sm:px-6">Subcategory Name</th>
              <th className="px-5 py-4 sm:px-6">Domain Rating</th>
              <th className="px-5 py-4 sm:px-6">Related Categories</th>
            </tr>
          </thead>
          <tbody>
            {localCandidates.map((candidate) => (
              <tr key={`candidate-row-${candidate.id}`} className="align-top">
                <td className="border-t border-border px-5 py-4 text-sm font-semibold text-foreground sm:px-6">
                  <div className="space-y-2">
                    <Link
                      className="transition hover:text-accent"
                      href={getBusinessProfileHref(candidate.id)}
                    >
                      {candidate.name}
                    </Link>
                    {candidate.websiteUrl ? (
                      <a
                        className="block text-xs font-medium text-accent transition hover:text-accent-strong"
                        href={candidate.websiteUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Visit website
                      </a>
                    ) : null}
                  </div>
                </td>
                <td className="border-t border-border px-5 py-4 text-sm leading-7 text-foreground sm:px-6">
                  {candidate.categoryName ?? "Unknown"}
                </td>
                <td className="border-t border-border px-5 py-4 text-sm leading-7 text-foreground sm:px-6">
                  {candidate.subcategoryName ?? "Unknown"}
                </td>
                <td className="border-t border-border px-5 py-4 text-sm leading-7 text-foreground sm:px-6">
                  {candidate.domainRating ?? "Unknown"}
                </td>
                <td className="border-t border-border px-5 py-4 text-sm leading-7 text-foreground sm:px-6">
                  {candidate.relatedCategoryNames.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {candidate.relatedCategoryNames.map((categoryName) => (
                        <span
                          key={`${candidate.id}-${categoryName}`}
                          className="inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-sm font-medium text-accent-strong"
                        >
                          {categoryName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "None"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoricalMatchGroup({
  businesses,
  emptyLabel,
  label,
  tone,
}: {
  businesses: BusinessOption[];
  emptyLabel: string;
  label: string;
  tone: "accent" | "neutral";
}) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-white/72 p-5">
      <p className="text-sm font-medium tracking-[0.12em] text-muted uppercase">
        {label}
      </p>

      {businesses.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2.5">
          {businesses.map((business) => (
            <span
              key={`${label}-${business.id}`}
              className={
                tone === "accent"
                  ? "inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-3.5 py-2 text-sm font-medium text-accent-strong"
                  : "inline-flex items-center rounded-full border border-border bg-brand-deep-soft/55 px-3.5 py-2 text-sm font-medium text-foreground"
              }
            >
              {business.business}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-7 text-muted">{emptyLabel}</p>
      )}
    </div>
  );
}

function PreviousMatchHistory({
  businessName,
  publishedBy,
  publishedFor,
}: {
  businessName: string;
  publishedBy: BusinessOption[];
  publishedFor: BusinessOption[];
}) {
  return (
    <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
            Previous Match History
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Existing hosts and guests for {businessName}
          </h2>
        </div>

        <div className="inline-flex items-center gap-3 rounded-full border border-accent/15 bg-white/85 px-4 py-2 text-sm font-semibold text-accent-strong">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          {publishedBy.length + publishedFor.length} prior connection
          {publishedBy.length + publishedFor.length === 1 ? "" : "s"}
        </div>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">
        This business already appears in the exchange history below. Publishers
        are businesses that have matched with it as the host, and published-for
        businesses are the ones it has already hosted.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <HistoricalMatchGroup
          businesses={publishedBy}
          emptyLabel="No publishers have matched with this business yet."
          label="Published By"
          tone="neutral"
        />
        <HistoricalMatchGroup
          businesses={publishedFor}
          emptyLabel="This business has not published for any other business yet."
          label="Published For"
          tone="accent"
        />
      </div>
    </section>
  );
}

function PendingAnalysisSection({
  localCandidates,
  scope,
}: {
  localCandidates: LocalBusinessMatchCandidate[];
  scope: MatchSearchScope;
}) {
  return (
    <section className="rounded-4xl border border-accent/15 bg-[linear-gradient(135deg,rgba(232,93,79,0.08),rgba(255,255,255,0.92))] p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
      <div className="inline-flex items-center gap-3 rounded-full border border-accent/15 bg-white/80 px-4 py-2 text-sm font-medium tracking-[0.16em] text-accent uppercase">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
        <span className="inline-flex animate-pulse items-center justify-center rounded-full bg-accent/10 p-1">
          <WaitingSparkIcon />
        </span>
        Waiting For AI Analysis
      </div>

      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Local shortlist is ready
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">
        {scope === "same-category"
          ? `The table above was built from businesses in the same category. ${localCandidates.length} candidate${localCandidates.length === 1 ? " is" : "s are"} ready, and the only pending step now is the LLM-generated rationale, scoring, and topic suggestions.`
          : `The table above was built from businesses in the same category or the same sector. ${localCandidates.length} candidate${localCandidates.length === 1 ? " is" : "s are"} ready, and the only pending step now is the LLM-generated rationale, scoring, and topic suggestions.`}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white/80 px-4 py-2 font-medium text-accent-strong">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          {localCandidates.length} shortlisted candidate
          {localCandidates.length === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-warning-strong/20 bg-warning-soft px-4 py-2 font-medium text-warning-strong">
          <WaitingSparkIcon />
          Waiting for AI enrichment
        </span>
      </div>
    </section>
  );
}

async function ResolvedAnalysisSection({
  businessName,
  localCandidates,
  matchLookupPromise,
  scope,
}: {
  businessName: string;
  localCandidates: LocalBusinessMatchCandidate[];
  matchLookupPromise: Promise<BusinessMatchLookupResult>;
  scope: MatchSearchScope;
}) {
  const matchLookup = await matchLookupPromise;
  const candidatesById = new Map(
    localCandidates.map((candidate) => [candidate.id, candidate] as const),
  );
  const candidatesByName = new Map(
    localCandidates.map((candidate) => [normalizeName(candidate.name), candidate] as const),
  );

  return (
    <>
      <BusinessMatchAnalysisToast
        businessName={businessName}
        matchesCount={matchLookup.matches.length}
        status={matchLookup.status}
      />

      <section className="space-y-6">
        <div className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
          <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
            Generated Response
          </p>

          {matchLookup.status === "success" ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-4xl border border-accent/15 bg-[linear-gradient(135deg,rgba(232,93,79,0.10),rgba(255,255,255,0.9))] p-6">
                <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                  Shortlist Ready
                </p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      AI analysis for {businessName}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-muted sm:text-base">
                      {matchLookup.matches.length > 0
                        ? scope === "same-category"
                          ? "The shortlist was loaded from the same business category, and the AI rationale is now attached to each partner below."
                          : "The shortlist was loaded from the same business category or sector, and the AI rationale is now attached to each partner below."
                        : "The workflow returned a response successfully. You can review the full transcript below."}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-3 self-start rounded-full border border-accent/15 bg-white/85 px-4 py-2 text-sm font-semibold text-accent-strong">
                    <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                    {matchLookup.matches.length} enriched partner
                    {matchLookup.matches.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              <details className="group rounded-4xl border border-border bg-white/75 transition open:bg-white/85">
                <summary className="flex list-none cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left [&::-webkit-details-marker]:hidden sm:px-6">
                  <div>
                    <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
                      Workflow Transcript
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      View the raw formatted text returned from the n8n workflow.
                    </p>
                  </div>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground transition group-open:rotate-180">
                    <svg
                      aria-hidden="true"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M6 9L12 15L18 9"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </span>
                </summary>

                <div className="border-t border-border px-5 py-5 sm:px-6">
                  <div className="overflow-x-auto whitespace-pre-wrap rounded-3xl border border-border/80 bg-white/92 p-5 font-mono text-sm leading-8 text-foreground/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    {matchLookup.summaryText}
                  </div>
                </div>
              </details>
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-warning-strong/20 bg-warning-soft p-5 text-sm leading-7 text-warning-strong">
              {matchLookup.userMessage}
            </div>
          )}
        </div>
      </section>

      {matchLookup.status === "success" && matchLookup.matches.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                Partner Breakdown
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                AI-enriched recommendations
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-muted">
              The shortlist came from Postgres first. These accordions now layer
              the AI rationale on top of those candidates.
            </p>
          </div>

          {matchLookup.matches.map((match, index) => {
            const candidate = getCandidateForMatch(
              match,
              candidatesById,
              candidatesByName,
            );

            return (
              <details
                open={index === 0}
                key={`${businessName}-${match.partnerName}-${index}`}
                className="group overflow-hidden rounded-4xl border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,245,249,0.92))] shadow-(--shadow) backdrop-blur-md transition open:border-accent/25"
              >
                <summary className="list-none cursor-pointer px-5 py-5 [&::-webkit-details-marker]:hidden sm:px-6 sm:py-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-base font-semibold text-white shadow-[0_10px_24px_rgba(232,93,79,0.22)]">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
                          Recommended Partner
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                          {match.partnerName}
                        </h3>
                        <p className="mt-3 max-w-4xl text-sm leading-7 text-muted">
                          {getPartnerPreview(match)}
                        </p>
                        {candidate ? (
                          <div className="mt-3 flex flex-wrap gap-2.5">
                            <span className="inline-flex items-center rounded-full border border-accent/20 bg-white/85 px-3 py-1.5 text-sm font-medium text-accent-strong">
                              {formatDomainRating(candidate.domainRating)}
                            </span>
                            {candidate.categoryName ? (
                              <span className="inline-flex items-center rounded-full border border-accent/20 bg-white/85 px-3 py-1.5 text-sm font-medium text-accent-strong">
                                {candidate.categoryName}
                              </span>
                            ) : null}
                            {candidate.sectorName ? (
                              <span className="inline-flex items-center rounded-full border border-accent/20 bg-white/85 px-3 py-1.5 text-sm font-medium text-accent-strong">
                                {candidate.sectorName}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start lg:pl-6">
                      <span className="inline-flex rounded-full border border-accent/20 bg-white/80 px-4 py-2 text-sm font-semibold text-accent-strong">
                        {formatScore(match.matchScore)}
                      </span>
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/80 text-foreground transition group-open:rotate-180">
                        <svg
                          aria-hidden="true"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M6 9L12 15L18 9"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </summary>

                <div className="border-t border-border/80 bg-white/55 px-5 py-5 sm:px-6 sm:py-6">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                    <div className="grid gap-4">
                      <div className="rounded-3xl border border-border/80 bg-white/88 p-5">
                        <p className="text-sm font-medium tracking-[0.12em] text-muted uppercase">
                          Why This Match Works
                        </p>
                        <p className="mt-3 text-sm leading-7 text-foreground">
                          {match.matchRationale ?? "Not provided."}
                        </p>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-3xl border border-border/80 bg-[#f9f1ec] p-5">
                          <p className="text-sm font-medium tracking-[0.12em] text-muted uppercase">
                            Editorial Bridge
                          </p>
                          <p className="mt-3 text-sm leading-7 text-foreground">
                            {match.editorialBridge ?? "Not provided."}
                          </p>
                        </div>

                        <div className="rounded-3xl border border-border/80 bg-[#edf3fa] p-5">
                          <p className="text-sm font-medium tracking-[0.12em] text-muted uppercase">
                            Competitor Rationale
                          </p>
                          <p className="mt-3 text-sm leading-7 text-foreground">
                            {match.competitionRationale ?? "Not provided."}
                          </p>
                        </div>
                      </div>

                      {candidate ? (
                        <div className="rounded-3xl border border-border/80 bg-white/92 p-5">
                          <p className="text-sm font-medium tracking-[0.12em] text-muted uppercase">
                            Candidate Snapshot
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm text-foreground">
                              <span className="block text-sm font-medium text-muted">
                                Category
                              </span>
                              <span className="mt-1 block">
                                {candidate.categoryName ?? "Unknown"}
                              </span>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm text-foreground">
                              <span className="block text-sm font-medium text-muted">
                                Subcategory
                              </span>
                              <span className="mt-1 block">
                                {candidate.subcategoryName ?? "Unknown"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-4 content-start">
                      <div className="rounded-3xl border border-accent/15 bg-[linear-gradient(180deg,rgba(232,93,79,0.08),rgba(255,255,255,0.96))] p-5">
                        <p className="text-sm font-medium tracking-[0.12em] text-accent uppercase">
                          Suggested Topics
                        </p>
                        {match.suggestedTopics.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2.5">
                            {match.suggestedTopics.map((topic) => (
                              <span
                                key={`${match.partnerName}-${topic}`}
                                className="inline-flex items-center rounded-full border border-accent/20 bg-white/88 px-3.5 py-2 text-sm font-medium text-accent-strong shadow-[0_4px_12px_rgba(232,93,79,0.08)]"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm leading-7 text-foreground">
                            Not provided.
                          </p>
                        )}
                      </div>

                      <div className="rounded-3xl border border-border/80 bg-white/88 p-5">
                        <p className="text-sm font-medium tracking-[0.12em] text-muted uppercase">
                          Match Metadata
                        </p>
                        <div className="mt-3 grid gap-3">
                          {match.selectedPartnerId !== null ? (
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface px-4 py-3">
                              <span className="text-sm text-muted">Partner ID</span>
                              <span className="text-sm font-semibold text-foreground">
                                {match.selectedPartnerId}
                              </span>
                            </div>
                          ) : null}
                          {candidate && candidate.relatedCategoryNames.length > 0 ? (
                            <div className="rounded-2xl border border-border/70 bg-surface px-4 py-3 text-sm leading-7 text-foreground">
                              <span className="block text-sm font-medium text-muted">
                                Related Categories
                              </span>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {candidate.relatedCategoryNames.map((categoryName) => (
                                  <span
                                    key={`${candidate.id}-${categoryName}-related`}
                                    className="inline-flex items-center rounded-full border border-accent/20 bg-white/85 px-3 py-1 text-sm font-medium text-accent-strong"
                                  >
                                    {categoryName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {candidate?.websiteUrl ? (
                            <a
                              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/85 px-4 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
                              href={candidate.websiteUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Visit Candidate Website
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </section>
      ) : null}
    </>
  );
}

export default async function BusinessMatchesPage({
  params,
  searchParams,
}: BusinessMatchesPageProps) {
  const { businessId: rawBusinessId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const businessId = parseBusinessId(rawBusinessId);
  const scope = parseMatchSearchScope(resolvedSearchParams.scope);

  if (businessId === null) {
    notFound();
  }

  const business = await getBusinessById(businessId);

  if (!business) {
    notFound();
  }

  const matchLookupPromise = findBusinessMatches(business);
  const [localCandidates, relationshipRows] = await Promise.all([
    getLocalBusinessMatchCandidates(business.id, scope),
    getBusinessRelationshipRows(undefined, undefined, business.id),
  ]);
  const relationshipRow = relationshipRows[0] ?? null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <p className="inline-flex rounded-full border border-border bg-white/70 px-4 py-1.5 text-sm font-medium tracking-[0.16em] text-accent uppercase backdrop-blur-sm">
            Match Results
          </p>
          <div className="space-y-3">
            <h1 className="max-w-4xl text-4xl leading-tight font-semibold tracking-tight text-foreground sm:text-5xl">
              Matches for {business.business}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted sm:text-lg">
              This page runs your n8n match-finder workflow for the selected
              business and renders the response using the schema you shared.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            href={buildBusinessMatchesHref(business.id, "same-category")}
          >
            Same Category
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            href={buildBusinessMatchesHref(
              business.id,
              "same-category-or-sector",
            )}
          >
            Same Category or Sector
          </Link>
          {business.websiteUrl ? (
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
              href={business.websiteUrl}
              rel="noreferrer"
              target="_blank"
            >
              Visit Website
            </a>
          ) : null}
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            href="/matches"
          >
            Back to Match Table
          </Link>
        </div>
      </section>

      <PreviousMatchHistory
        businessName={business.business}
        publishedBy={relationshipRow?.publishedBy ?? []}
        publishedFor={relationshipRow?.publishedFor ?? []}
      />

      <section>
        <div className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
          <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
            Local Shortlist
          </p>

          <div className="mt-5 space-y-4">
            <div className="rounded-4xl border border-accent/15 bg-[linear-gradient(135deg,rgba(232,93,79,0.10),rgba(255,255,255,0.9))] p-6">
              <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                Immediate Results
              </p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Candidate partners for {business.business}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-muted sm:text-base">
                    {scope === "same-category"
                      ? "These candidates come directly from the database using the same-category and historical-blocklist rules."
                      : "These candidates come directly from the database using the same-category-or-sector and historical-blocklist rules."} AI scoring and rationale load separately below.
                  </p>
                </div>
                <div className="inline-flex items-center gap-3 self-start rounded-full border border-accent/15 bg-white/85 px-4 py-2 text-sm font-semibold text-accent-strong">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                  {localCandidates.length} candidate
                  {localCandidates.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <LocalShortlistTable localCandidates={localCandidates} />
          </div>
        </div>
      </section>

      <Suspense fallback={<PendingAnalysisSection localCandidates={localCandidates} scope={scope} />}>
        <ResolvedAnalysisSection
          businessName={business.business}
          localCandidates={localCandidates}
          matchLookupPromise={matchLookupPromise}
          scope={scope}
        />
      </Suspense>
    </main>
  );
}
