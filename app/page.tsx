import Link from "next/link";
import { MatchForm } from "@/components/match-form";
import { getBusinesses } from "@/lib/matches";

export const dynamic = "force-dynamic";

export default async function Home() {
  const businesses = await getBusinesses();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div className="space-y-5">
          <p className="inline-flex rounded-full border border-border bg-white/70 px-4 py-1.5 text-sm font-medium tracking-[0.16em] text-accent uppercase backdrop-blur-sm">
            Match Intake
          </p>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Pair one business as the host and another as the guest.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted sm:text-xl">
              Choose both businesses, submit the match, and get immediate toast
              feedback for success or failure.
            </p>
          </div>
        </div>

        <div className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md">
          <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
            Snapshot
          </p>
          <div className="mt-4 flex items-end justify-between gap-6">
            <div>
              <p className="text-5xl font-semibold tracking-tight text-foreground">
                {businesses.length}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                available businesses ready to be matched.
              </p>
            </div>
            <Link
              className="inline-flex items-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
              href="/matches"
            >
              View Matches
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
          <MatchForm businesses={businesses} />
        </div>

        <aside className="rounded-4xl border border-border bg-[#1a2d24] p-6 text-[#ecf0e8] shadow-(--shadow) sm:p-8">
          <p className="text-sm font-medium tracking-[0.16em] text-[#c2d2c1] uppercase">
            Notes
          </p>
          <div className="mt-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                What this screen does
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#d3ddd1]">
                The form writes a single host and guest pair into the matches
                table. Duplicate pairs and invalid selections are blocked on the
                backend.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/6 p-5">
              <p className="text-sm font-medium text-[#f5cf9b]">
                Backend details
              </p>
              <p className="mt-2 text-sm leading-7 text-[#d3ddd1]">
                Prisma handles the schema and queries, and the app expects the
                Neon connection string in the DATABASE_URL environment variable.
              </p>
            </div>

            <Link
              className="inline-flex items-center rounded-full bg-[#f0c78c] px-5 py-3 text-sm font-semibold text-[#132019] transition hover:-translate-y-0.5 hover:bg-[#f5d6aa]"
              href="/matches"
            >
              Open Match Table
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
