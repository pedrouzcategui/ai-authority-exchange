import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth-session";

export default async function Home() {
  const session = await getAuthSession();

  if (session?.user?.legacyUserId) {
    redirect("/matches");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
      <section className="w-full rounded-4xl border border-border bg-surface p-8 shadow-(--shadow) backdrop-blur-md sm:p-10 lg:p-14">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Pair one business as the host and another as the guest.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted sm:text-xl">
            Choose both businesses, submit the match, and get immediate toast
            feedback for success or failure.
          </p>
          <Link
            className="inline-flex items-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong"
            href="/matches"
          >
            See Match Table
          </Link>
        </div>
      </section>
    </main>
  );
}
