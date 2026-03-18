"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { BusinessDirectoryContactControl } from "@/components/business-directory-contact-control";
import { BusinessDirectoryExchangeSelect } from "@/components/business-directory-exchange-select";
import { getBusinessProfileHref } from "@/lib/business-profile-route";
import type {
  BusinessContactOption,
  BusinessDirectoryRow,
} from "@/lib/matches";

type BusinessDirectoryTableProps = {
  businesses: BusinessDirectoryRow[];
  contacts: BusinessContactOption[];
};

type ContactFilter = "all" | "none" | `${number}`;
type ExchangeFilter = "all" | "active" | "inactive";
type SortDirection = "asc" | "desc";
type WebsiteFilter = "all" | "set" | "not-set";

const categoryCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const businessNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function formatCellValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "Not set";
}

function normalizeSearchValue(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function getContactFilterLabel(contact: BusinessContactOption) {
  if (contact.fullName && contact.fullName.trim().length > 0) {
    return contact.fullName.trim();
  }

  const fullName = [contact.firstName, contact.lastName]
    .filter((value): value is string => Boolean(value && value.trim().length > 0))
    .join(" ")
    .trim();

  if (fullName.length > 0) {
    return fullName;
  }

  if (contact.email && contact.email.trim().length > 0) {
    return contact.email.trim();
  }

  return `Contact ${contact.id}`;
}

function getCategoryFilterLabel(selectedCategories: string[]) {
  if (selectedCategories.length === 0) {
    return "All categories";
  }

  if (selectedCategories.length === 1) {
    return selectedCategories[0];
  }

  return `${selectedCategories.length} categories`;
}

function getSortButtonClassName(isActive: boolean) {
  return isActive
    ? "inline-flex items-center gap-1 rounded-sm bg-transparent p-0 text-foreground uppercase tracking-[0.16em] decoration-2 underline underline-offset-4 decoration-accent transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
    : "inline-flex items-center gap-1 rounded-sm bg-transparent p-0 text-muted uppercase tracking-[0.16em] transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20";
}

export function BusinessDirectoryTable({
  businesses,
  contacts,
}: BusinessDirectoryTableProps) {
  const [expertFilter, setExpertFilter] = useState<ContactFilter>("all");
  const [marketerFilter, setMarketerFilter] = useState<ContactFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>("all");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("all");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = normalizeSearchValue(deferredSearchQuery);
  const marketerContacts = contacts.filter(
    (contact) => contact.role === "marketer",
  );
  const expertContacts = contacts.filter(
    (contact) => contact.role === "expert",
  );

  const categories = Array.from(
    new Set(
      businesses
        .map((business) => business.businessCategoryName)
        .filter((category): category is string => Boolean(category)),
    ),
  ).toSorted(categoryCollator.compare);

  const selectedCategorySet = new Set(selectedCategories);
  const filteredBusinesses = businesses
    .filter((business) => {
      const matchesSearch =
        normalizedSearchQuery.length === 0 ||
        [
          business.business,
          business.businessCategoryName,
          business.expert?.email,
          business.expert?.firstName,
          business.expert?.fullName,
          business.expert?.lastName,
          business.marketer?.email,
          business.marketer?.firstName,
          business.marketer?.fullName,
          business.marketer?.lastName,
          business.subcategory,
          business.websiteUrl,
        ].some((value) =>
          normalizeSearchValue(value).includes(normalizedSearchQuery),
        );

      const matchesCategory =
        selectedCategorySet.size === 0 ||
        (business.businessCategoryName !== null &&
          selectedCategorySet.has(business.businessCategoryName));

      const matchesExchange =
        exchangeFilter === "all" ||
        (exchangeFilter === "active" && business.isActiveOnAiAuthorityExchange) ||
        (exchangeFilter === "inactive" &&
          !business.isActiveOnAiAuthorityExchange);

      const matchesWebsite =
        websiteFilter === "all" ||
        (websiteFilter === "set" && business.websiteUrl !== null) ||
        (websiteFilter === "not-set" && business.websiteUrl === null);

      const matchesMarketer =
        marketerFilter === "all" ||
        (marketerFilter === "none" && business.marketer === null) ||
        business.marketer?.id.toString() === marketerFilter;

      const matchesExpert =
        expertFilter === "all" ||
        (expertFilter === "none" && business.expert === null) ||
        business.expert?.id.toString() === expertFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesExchange &&
        matchesWebsite &&
        matchesMarketer &&
        matchesExpert
      );
    })
    .toSorted((left, right) => {
      const comparison = businessNameCollator.compare(
        left.business,
        right.business,
      );

      if (comparison !== 0) {
        return sortDirection === "asc" ? comparison : -comparison;
      }

      return left.id - right.id;
    });

  function toggleBusinessSort() {
    setSortDirection((currentDirection) =>
      currentDirection === "asc" ? "desc" : "asc",
    );
  }

  function getBusinessSortIndicator() {
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function toggleCategory(category: string) {
    setSelectedCategories((currentCategories) =>
      currentCategories.includes(category)
        ? currentCategories.filter(
            (currentCategory) => currentCategory !== category,
          )
        : [...currentCategories, category].toSorted(categoryCollator.compare),
    );
  }

  function clearFilters() {
    setExpertFilter("all");
    setMarketerFilter("all");
    setSearchQuery("");
    setSelectedCategories([]);
    setExchangeFilter("all");
    setWebsiteFilter("all");
  }

  return (
    <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
            All Businesses
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {filteredBusinesses.length} of {businesses.length} business
            {businesses.length === 1 ? "" : "es"}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base lg:text-right">
          Search by business, marketer, expert, category, subcategory, or
          website, then narrow the list by exchange participation and saved
          website status.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_220px_220px_220px_220px_auto]">
        <label className="flex flex-col gap-2">
          <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
            Search
          </span>
          <input
            className="min-h-12 w-full rounded-2xl border border-border bg-white/90 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search businesses"
            type="search"
            value={searchQuery}
          />
        </label>

        <div className="relative">
          <span className="mb-2 flex min-h-10 items-end text-sm font-medium text-foreground">
            Category
          </span>
          <details className="group relative">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-2xl border border-border bg-white/85 px-4 py-3 text-sm font-medium text-foreground outline-none transition hover:border-accent focus:border-accent focus:ring-2 focus:ring-accent/15">
              <span className="truncate">
                {getCategoryFilterLabel(selectedCategories)}
              </span>
              <svg
                aria-hidden="true"
                className="ml-3 h-4 w-4 shrink-0 text-current transition group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path d="m7 10 5 5 5-5" />
              </svg>
            </summary>

            <div className="absolute z-20 mt-2 w-full min-w-72 rounded-3xl border border-border bg-white p-4 shadow-[0_22px_60px_rgba(36,53,71,0.16)]">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <p className="text-sm font-semibold text-foreground">
                  Filter categories
                </p>
                {selectedCategories.length > 0 ? (
                  <button
                    className="text-sm font-medium text-accent transition hover:text-accent-strong"
                    onClick={(event) => {
                      event.preventDefault();
                      setSelectedCategories([]);
                    }}
                    type="button"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted">No categories available.</p>
                ) : (
                  categories.map((category) => {
                    const isChecked = selectedCategorySet.has(category);

                    return (
                      <label
                        key={category}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-white/80 px-3.5 py-2.5 transition hover:border-accent/35"
                      >
                        <input
                          checked={isChecked}
                          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/25"
                          onChange={() => toggleCategory(category)}
                          type="checkbox"
                        />
                        <span className="min-w-0 truncate text-sm text-foreground">
                          {category}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </details>
        </div>

        <label className="flex flex-col gap-2">
          <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
            Exchange
          </span>
          <select
            className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            onChange={(event) =>
              setExchangeFilter(event.target.value as ExchangeFilter)
            }
            value={exchangeFilter}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
            Website URL
          </span>
          <select
            className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            onChange={(event) =>
              setWebsiteFilter(event.target.value as WebsiteFilter)
            }
            value={websiteFilter}
          >
            <option value="all">All</option>
            <option value="set">Set</option>
            <option value="not-set">Not set</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
            Marketer
          </span>
          <select
            className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            onChange={(event) =>
              setMarketerFilter(event.target.value as ContactFilter)
            }
            value={marketerFilter}
          >
            <option value="all">All marketers</option>
            <option value="none">No marketer</option>
            {marketerContacts.map((contact) => (
              <option key={`marketer-filter-${contact.id}`} value={contact.id}>
                {getContactFilterLabel(contact)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
            Expert
          </span>
          <select
            className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            onChange={(event) =>
              setExpertFilter(event.target.value as ContactFilter)
            }
            value={expertFilter}
          >
            <option value="all">All experts</option>
            <option value="none">No expert</option>
            {expertContacts.map((contact) => (
              <option key={`expert-filter-${contact.id}`} value={contact.id}>
                {getContactFilterLabel(contact)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end justify-start lg:justify-end">
          <button
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              searchQuery.trim().length === 0 &&
              selectedCategories.length === 0 &&
              exchangeFilter === "all" &&
              websiteFilter === "all" &&
              marketerFilter === "all" &&
              expertFilter === "all"
            }
            onClick={clearFilters}
            type="button"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {filteredBusinesses.length === 0 ? (
        <div className="mt-6 rounded-4xl border border-dashed border-border bg-white/60 px-6 py-14 text-center">
          <p className="text-lg font-medium text-foreground">
            No businesses match the current filters.
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Adjust the search, selected categories, exchange state, or website
            filter.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-4xl border border-border bg-white/72">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-brand-deep-soft/75 text-left text-xs font-semibold tracking-[0.16em] text-muted uppercase">
                  <th className="px-5 py-4 sm:px-6">
                    <button
                      aria-label={`Sort by business ${sortDirection === "asc" ? "descending" : "ascending"}`}
                      className={getSortButtonClassName(true)}
                      onClick={toggleBusinessSort}
                      type="button"
                    >
                      <span>BUSINESS</span>
                      <span aria-hidden="true" className="text-accent">
                        {getBusinessSortIndicator()}
                      </span>
                    </button>
                  </th>
                  <th className="px-5 py-4 sm:px-6">Exchange</th>
                  <th className="px-5 py-4 sm:px-6">Marketer</th>
                  <th className="px-5 py-4 sm:px-6">Expert</th>
                  <th className="px-5 py-4 sm:px-6">Category</th>
                  <th className="px-5 py-4 sm:px-6">Subcategory</th>
                  <th className="px-5 py-4 sm:px-6">Website URL</th>
                </tr>
              </thead>
              <tbody>
                {filteredBusinesses.map((business) => (
                  <tr key={business.id} className="align-middle">
                    <td className="border-t border-border px-5 py-4 sm:px-6">
                      <Link
                        className="text-sm font-semibold text-foreground transition hover:text-accent"
                        href={getBusinessProfileHref(business.id)}
                      >
                        {business.business}
                      </Link>
                    </td>
                    <td className="border-t border-border px-5 py-4 sm:px-6">
                      <BusinessDirectoryExchangeSelect
                        businessId={business.id}
                        businessName={business.business}
                        initialIsActive={business.isActiveOnAiAuthorityExchange}
                      />
                    </td>
                    <td className="border-t border-border px-5 py-4 sm:px-6">
                      <BusinessDirectoryContactControl
                        availableContacts={marketerContacts}
                        businessId={business.id}
                        businessName={business.business}
                        initialContact={business.marketer}
                        role="marketer"
                      />
                    </td>
                    <td className="border-t border-border px-5 py-4 sm:px-6">
                      <BusinessDirectoryContactControl
                        availableContacts={expertContacts}
                        businessId={business.id}
                        businessName={business.business}
                        initialContact={business.expert}
                        role="expert"
                      />
                    </td>
                    <td className="border-t border-border px-5 py-4 text-sm text-foreground sm:px-6">
                      {formatCellValue(business.businessCategoryName)}
                    </td>
                    <td className="border-t border-border px-5 py-4 text-sm text-foreground sm:px-6">
                      {formatCellValue(business.subcategory)}
                    </td>
                    <td className="border-t border-border px-5 py-4 sm:px-6">
                      {business.websiteUrl ? (
                        <a
                          className="text-sm font-medium text-accent transition hover:text-accent-strong"
                          href={business.websiteUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {business.websiteUrl}
                        </a>
                      ) : (
                        <span className="text-sm text-muted">Not set</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
