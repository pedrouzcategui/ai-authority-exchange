export default function BusinessMatchesLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
      <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
        <div className="inline-flex items-center gap-3 rounded-full border border-accent/15 bg-white/75 px-4 py-2 text-sm font-medium tracking-[0.16em] text-accent uppercase">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <span className="inline-flex animate-pulse items-center justify-center rounded-full bg-accent/10 p-1">
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
          </span>
          Loading match page
        </div>
        <div className="mt-5 h-12 w-full max-w-3xl animate-pulse rounded-3xl bg-brand-deep-soft" />
        <div className="mt-4 h-5 w-full max-w-2xl animate-pulse rounded-full bg-brand-deep-soft/75" />
        <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">
          The app is loading the business context and building the local
          shortlist before the AI enrichment step begins.
        </p>
      </section>

      <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
        <div className="flex flex-wrap gap-3">
          <div className="h-12 w-44 animate-pulse rounded-full bg-brand-deep-soft" />
          <div className="h-12 w-60 animate-pulse rounded-full bg-surface-muted" />
          <div className="h-12 w-40 animate-pulse rounded-full bg-accent-soft/65" />
        </div>
        <div className="mt-5 h-24 animate-pulse rounded-4xl bg-surface-muted" />
      </section>

      <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
        <div className="h-5 w-44 animate-pulse rounded-full bg-brand-deep-soft" />
        <div className="mt-4 h-10 w-full max-w-2xl animate-pulse rounded-3xl bg-surface-muted" />
        <div className="mt-4 h-5 w-full max-w-3xl animate-pulse rounded-full bg-brand-deep-soft/75" />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="h-32 animate-pulse rounded-[1.75rem] border border-border bg-white/72" />
          <div className="h-32 animate-pulse rounded-[1.75rem] border border-border bg-white/68" />
        </div>
      </section>

      <section className="space-y-4">
        <div className="h-8 w-full max-w-md animate-pulse rounded-full bg-brand-deep-soft" />
        <div className="overflow-hidden rounded-4xl border border-border bg-white/70">
          <div className="h-14 animate-pulse border-b border-border bg-brand-deep-soft/75" />
          <div className="space-y-0">
            <div className="h-18 animate-pulse border-b border-border bg-white/80" />
            <div className="h-18 animate-pulse border-b border-border bg-white/72" />
            <div className="h-18 animate-pulse border-b border-border bg-white/66" />
            <div className="h-18 animate-pulse bg-white/60" />
          </div>
        </div>
      </section>
    </main>
  );
}
