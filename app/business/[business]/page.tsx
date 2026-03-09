import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessMatchesTable } from "@/components/business-matches-table";
import { BusinessRoleBadge } from "@/components/business-role-badge";
import { EditBusinessModal } from "@/components/edit-business-modal";
import {
  getBusinessByIdentifier,
  getBusinessMatchBoard,
} from "@/lib/matches";

export const dynamic = "force-dynamic";

type BusinessProfilePageProps = {
  params: Promise<{
    business: string;
  }>;
};

export default async function BusinessProfilePage({
  params,
}: BusinessProfilePageProps) {
  const resolvedParams = await params;
  const business = await getBusinessByIdentifier(resolvedParams.business);

  if (!business) {
    notFound();
  }

  const rows = await getBusinessMatchBoard(business.id);
  const guestCount = rows.filter(
    (row) => row.counterpartRole === "guest",
  ).length;
  const hostCount = rows.filter((row) => row.counterpartRole === "host").length;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
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
              <p className="text-base text-muted">No website URL has been saved yet.</p>
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

      <section className="grid gap-4 md:grid-cols-3">
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
      </section>

      <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
        <BusinessMatchesTable businessName={business.business} rows={rows} />
      </section>
    </main>
  );
}