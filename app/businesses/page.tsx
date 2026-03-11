import Link from "next/link";
import { AddClientModal } from "@/components/add-client-modal";
import { BusinessDirectoryTable } from "@/components/business-directory-table";
import { getBusinessDirectoryRows } from "@/lib/matches";

export const dynamic = "force-dynamic";

export default async function BusinessesPage() {
  const businesses = await getBusinessDirectoryRows();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-8xl flex-col gap-8 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
            Businesses
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Business directory
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted sm:text-lg">
            Review every business in the database, including whether it is
            currently active in the exchange, its category, subcategory, and
            website URL.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            className="inline-flex items-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            href="/matches"
          >
            View Matches
          </Link>
          <AddClientModal />
        </div>
      </section>

      <BusinessDirectoryTable businesses={businesses} />
    </main>
  );
}