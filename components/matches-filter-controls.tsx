"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ChangeEvent, type FormEvent } from "react";
import type { BusinessOption } from "@/lib/matches";

const RESULTS_PER_PAGE_OPTIONS = [5, 10, 20] as const;

type MatchesFilterControlsProps = {
  businessFilter?: number;
  businesses: BusinessOption[];
  exportHref: string;
  guestFilter?: number;
  hasFilters: boolean;
  hostFilter?: number;
  perPage: (typeof RESULTS_PER_PAGE_OPTIONS)[number];
};

function buildMatchesQuery(params: {
  business?: string;
  guest?: string;
  host?: string;
  perPage?: string;
}) {
  const searchParams = new URLSearchParams();

  if (params.business) {
    searchParams.set("business", params.business);
  }

  if (params.host) {
    searchParams.set("host", params.host);
  }

  if (params.guest) {
    searchParams.set("guest", params.guest);
  }

  if (params.perPage) {
    searchParams.set("perPage", params.perPage);
  }

  return searchParams.toString();
}

export function MatchesFilterControls({
  businessFilter,
  businesses,
  exportHref,
  guestFilter,
  hasFilters,
  hostFilter,
  perPage,
}: MatchesFilterControlsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const form = event.currentTarget.form;

    if (!form) {
      return;
    }

    const formData = new FormData(form);
    let business = formData.get("business")?.toString() ?? "";
    let host = formData.get("host")?.toString() ?? "";
    let guest = formData.get("guest")?.toString() ?? "";
    const nextPerPage =
      formData.get("perPage")?.toString() ?? perPage.toString();

    if (event.currentTarget.name === "business" && business) {
      host = "";
      guest = "";
    }

    if (
      (event.currentTarget.name === "host" ||
        event.currentTarget.name === "guest") &&
      (host || guest)
    ) {
      business = "";
    }

    const query = buildMatchesQuery({
      business,
      guest,
      host,
      perPage: nextPerPage,
    });

    startTransition(() => {
      router.replace(query.length === 0 ? pathname : `${pathname}?${query}`, {
        scroll: false,
      });
    });
  }

  return (
    <form
      className="grid items-end gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_180px_auto]"
      onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}
    >
      <label className="flex flex-col gap-2">
        <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
          Filter by business name
        </span>
        <select
          className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-muted"
          defaultValue={businessFilter?.toString() ?? ""}
          disabled={
            isPending || hostFilter !== undefined || guestFilter !== undefined
          }
          name="business"
          onChange={handleChange}
        >
          <option value="">All businesses</option>
          {businesses.map((business) => (
            <option key={`business-${business.id}`} value={business.id}>
              {business.business}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
          Filter by Published By
        </span>
        <select
          className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-muted"
          defaultValue={hostFilter?.toString() ?? ""}
          disabled={isPending || businessFilter !== undefined}
          name="host"
          onChange={handleChange}
        >
          <option value="">All publishers</option>
          {businesses.map((business) => (
            <option key={`host-${business.id}`} value={business.id}>
              {business.business}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
          Filter by Published For
        </span>
        <select
          className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-muted"
          defaultValue={guestFilter?.toString() ?? ""}
          disabled={isPending || businessFilter !== undefined}
          name="guest"
          onChange={handleChange}
        >
          <option value="">All Published For businesses</option>
          {businesses.map((business) => (
            <option key={`guest-${business.id}`} value={business.id}>
              {business.business}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
          Results per page
        </span>
        <select
          className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          defaultValue={perPage.toString()}
          disabled={isPending}
          name="perPage"
          onChange={handleChange}
        >
          {RESULTS_PER_PAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-end gap-3 lg:justify-end">
        {hasFilters ? (
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            href="/matches"
          >
            Clear
          </Link>
        ) : null}

        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
          href={exportHref}
        >
          Export CSV
        </Link>
      </div>
    </form>
  );
}
