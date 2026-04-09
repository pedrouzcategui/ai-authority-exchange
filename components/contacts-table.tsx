"use client";

import Link from "next/link";
import { useDeferredValue, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { EditBusinessContactModal } from "@/components/edit-business-contact-modal";
import { ManageContactBusinessesModal } from "@/components/manage-contact-businesses-modal";
import type { BusinessContactDirectoryRow, BusinessOption } from "@/lib/matches";
import { useRouter } from "next/navigation";

type ContactsTableProps = {
  businesses: BusinessOption[];
  contacts: BusinessContactDirectoryRow[];
};

type FieldPresenceFilter = "all" | "is-set" | "not-set";
type PageSize = 20 | 50 | 100;
type RoleFilter = "all" | "marketer" | "expert";
type SortColumn = "contact" | "email";
type SortDirection = "asc" | "desc";

const sortCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function normalizeSearchValue(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function normalizeSortValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue && normalizedValue.length > 0
    ? normalizedValue
    : "Not set";
}

function matchesFieldPresence(
  value: string | null | undefined,
  filter: FieldPresenceFilter,
) {
  if (filter === "all") {
    return true;
  }

  const isSet = Boolean(value && value.trim().length > 0);
  return filter === "is-set" ? isSet : !isSet;
}

function getContactDisplayName(contact: BusinessContactDirectoryRow) {
  if (contact.fullName && contact.fullName.trim().length > 0) {
    return contact.fullName.trim();
  }

  const fullName = [contact.firstName, contact.lastName]
    .filter((value): value is string =>
      Boolean(value && value.trim().length > 0),
    )
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

function getAssignedBusinesses(contact: BusinessContactDirectoryRow) {
  return contact.role === "marketer"
    ? contact.marketerForBusinesses
    : contact.expertForBusinesses;
}

function getRoleClassName(role: RoleFilter) {
  return role === "marketer"
    ? "border-[#e7b16a] bg-[#fff2de] text-[#9a5613]"
    : "border-[#c7d5f1] bg-[#eef4ff] text-[#325188]";
}

function getAssignedBusinessClassName(isActiveOnAiAuthorityExchange: boolean) {
  return isActiveOnAiAuthorityExchange
    ? "border-[#8cc6a7] bg-[#e9f8ef] text-[#276b4a] hover:border-[#4eab78] hover:text-[#1f5a3e] focus-visible:ring-[#4eab78]/20"
    : "border-[#c3ceda] bg-[#f1f5f8] text-[#55697e] hover:border-[#97a8ba] hover:text-[#334659] focus-visible:ring-brand-deep/15";
}

function getSortButtonClassName(isActive: boolean) {
  return isActive
    ? "inline-flex items-center gap-1 rounded-sm bg-transparent p-0 text-foreground uppercase tracking-[0.16em] decoration-2 underline underline-offset-4 decoration-accent transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
    : "inline-flex items-center gap-1 rounded-sm bg-transparent p-0 text-muted uppercase tracking-[0.16em] transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20";
}

export function ContactsTable({ businesses, contacts }: ContactsTableProps) {
  const router = useRouter();
  const [emailFilter, setEmailFilter] = useState<FieldPresenceFilter>("all");
  const [firstNameFilter, setFirstNameFilter] =
    useState<FieldPresenceFilter>("all");
  const [lastNameFilter, setLastNameFilter] =
    useState<FieldPresenceFilter>("all");
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("contact");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [contactPendingDelete, setContactPendingDelete] =
    useState<BusinessContactDirectoryRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = normalizeSearchValue(deferredSearchQuery);
  const businessExchangeStatusById = new Map(
    businesses.map((business) =>
      [business.id, business.isActiveOnAiAuthorityExchange] as const,
    ),
  );

  const filteredContacts = contacts
    .filter((contact) => {
      const assignedBusinesses = getAssignedBusinesses(contact);
      const matchesSearch =
        normalizedSearchQuery.length === 0 ||
        [
          contact.email,
          contact.firstName,
          contact.fullName,
          contact.lastName,
          ...assignedBusinesses.map((business) => business.business),
        ].some((value) =>
          normalizeSearchValue(value).includes(normalizedSearchQuery),
        );

      const matchesRole = roleFilter === "all" || contact.role === roleFilter;
      const matchesFirstName = matchesFieldPresence(
        contact.firstName,
        firstNameFilter,
      );
      const matchesLastName = matchesFieldPresence(
        contact.lastName,
        lastNameFilter,
      );
      const matchesEmail = matchesFieldPresence(contact.email, emailFilter);

      return (
        matchesSearch &&
        matchesRole &&
        matchesFirstName &&
        matchesLastName &&
        matchesEmail
      );
    })
    .toSorted((left, right) => {
      const leftValue =
        sortColumn === "contact"
          ? getContactDisplayName(left)
          : normalizeSortValue(left.email);
      const rightValue =
        sortColumn === "contact"
          ? getContactDisplayName(right)
          : normalizeSortValue(right.email);

      const comparison = sortCollator.compare(leftValue, rightValue);

      if (comparison !== 0) {
        return sortDirection === "asc" ? comparison : -comparison;
      }

      return left.id - right.id;
    });

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedContacts = filteredContacts.slice(
    pageStartIndex,
    pageStartIndex + pageSize,
  );
  const visibleStart = filteredContacts.length === 0 ? 0 : pageStartIndex + 1;
  const visibleEnd = Math.min(pageStartIndex + pageSize, filteredContacts.length);

  function toggleSort(nextColumn: SortColumn) {
    if (sortColumn === nextColumn) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortColumn(nextColumn);
    setSortDirection("asc");
  }

  function getSortIndicator(column: SortColumn) {
    if (sortColumn !== column) {
      return "";
    }

    return sortDirection === "asc" ? "↑" : "↓";
  }

  function clearFilters() {
    setEmailFilter("all");
    setFirstNameFilter("all");
    setLastNameFilter("all");
    setCurrentPage(1);
    setSearchQuery("");
    setRoleFilter("all");
  }

  function requestDeleteContact(contact: BusinessContactDirectoryRow) {
    setContactPendingDelete(contact);
  }

  function confirmDeleteContact() {
    if (!contactPendingDelete) {
      return;
    }

    startDeleteTransition(async () => {
      const response = await fetch(
        `/api/business-contacts/${contactPendingDelete.id}`,
        {
          method: "DELETE",
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "The contact could not be deleted.");
        return;
      }

      toast.success(payload?.message ?? "Contact deleted successfully.");
      setContactPendingDelete(null);
      router.refresh();
    });
  }

  const deleteContactName = contactPendingDelete
    ? getContactDisplayName(contactPendingDelete)
    : "this contact";
  const deleteAssignmentsCount = contactPendingDelete
    ? getAssignedBusinesses(contactPendingDelete).length
    : 0;

  return (
    <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
            All Contacts
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {filteredContacts.length} of {contacts.length} contact
            {contacts.length === 1 ? "" : "s"}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base lg:text-right">
          Search by contact name, email, or assigned business, then filter by
          role.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_220px_180px_180px_180px_auto]">
        <label className="flex flex-col gap-2">
          <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
            Search
          </span>
          <input
            className="min-h-12 w-full rounded-2xl border border-border bg-white/90 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            onChange={(event) => {
              setCurrentPage(1);
              setSearchQuery(event.target.value);
            }}
            placeholder="Search contacts"
            type="search"
            value={searchQuery}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
            Role
          </span>
          <select
            className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            onChange={(event) => {
              setCurrentPage(1);
              setRoleFilter(event.target.value as RoleFilter);
            }}
            value={roleFilter}
          >
            <option value="all">All</option>
            <option value="marketer">Marketers</option>
            <option value="expert">Experts</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
            First Name
          </span>
          <select
            className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            onChange={(event) => {
              setCurrentPage(1);
              setFirstNameFilter(event.target.value as FieldPresenceFilter);
            }}
            value={firstNameFilter}
          >
            <option value="all">All</option>
            <option value="is-set">Is Set</option>
            <option value="not-set">Not Set</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
            Last Name
          </span>
          <select
            className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            onChange={(event) => {
              setCurrentPage(1);
              setLastNameFilter(event.target.value as FieldPresenceFilter);
            }}
            value={lastNameFilter}
          >
            <option value="all">All</option>
            <option value="is-set">Is Set</option>
            <option value="not-set">Not Set</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex min-h-10 items-end text-sm font-medium text-foreground">
            Email
          </span>
          <select
            className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            onChange={(event) => {
              setCurrentPage(1);
              setEmailFilter(event.target.value as FieldPresenceFilter);
            }}
            value={emailFilter}
          >
            <option value="all">All</option>
            <option value="is-set">Is Set</option>
            <option value="not-set">Not Set</option>
          </select>
        </label>

        <div className="flex items-end justify-start lg:justify-end">
          <button
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              searchQuery.trim().length === 0 &&
              roleFilter === "all" &&
              firstNameFilter === "all" &&
              lastNameFilter === "all" &&
              emailFilter === "all"
            }
            onClick={clearFilters}
            type="button"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {filteredContacts.length === 0 ? (
        <div className="mt-6 rounded-4xl border border-dashed border-border bg-white/60 px-6 py-14 text-center">
          <p className="text-lg font-medium text-foreground">
            No contacts match the current filters.
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Adjust the search or role filter.
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
                      aria-label={`Sort by contact${sortColumn === "contact" ? ` ${sortDirection === "asc" ? "descending" : "ascending"}` : " ascending"}`}
                      className={getSortButtonClassName(sortColumn === "contact")}
                      onClick={() => toggleSort("contact")}
                      type="button"
                    >
                      <span>CONTACT</span>
                      <span aria-hidden="true" className="text-accent">
                        {getSortIndicator("contact")}
                      </span>
                    </button>
                  </th>
                  <th className="px-5 py-4 sm:px-6">ROLE</th>
                  <th className="px-5 py-4 sm:px-6">
                    <button
                      aria-label={`Sort by email${sortColumn === "email" ? ` ${sortDirection === "asc" ? "descending" : "ascending"}` : " ascending"}`}
                      className={getSortButtonClassName(sortColumn === "email")}
                      onClick={() => toggleSort("email")}
                      type="button"
                    >
                      <span>EMAIL</span>
                      <span aria-hidden="true" className="text-accent">
                        {getSortIndicator("email")}
                      </span>
                    </button>
                  </th>
                  <th className="px-5 py-4 sm:px-6">ASSIGNED BUSINESSES</th>
                  <th className="px-5 py-4 text-right sm:px-6">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedContacts.map((contact) => {
                  const assignedBusinesses = getAssignedBusinesses(contact);

                  return (
                    <tr key={contact.id} className="align-middle">
                      <td className="border-t border-border px-5 py-4 text-sm font-semibold text-foreground sm:px-6">
                        {getContactDisplayName(contact)}
                      </td>
                      <td className="border-t border-border px-5 py-4 sm:px-6">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase ${getRoleClassName(
                            contact.role,
                          )}`}
                        >
                          {contact.role}
                        </span>
                      </td>
                      <td className="border-t border-border px-5 py-4 text-sm text-foreground sm:px-6">
                        {contact.email?.trim() || "Not set"}
                      </td>
                      <td className="border-t border-border px-5 py-4 sm:px-6">
                        {assignedBusinesses.length === 0 ? (
                          <span className="text-sm text-muted">Unassigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {assignedBusinesses.map((business) => {
                              const isActiveOnAiAuthorityExchange =
                                businessExchangeStatusById.get(business.id) ===
                                true;
                              const exchangeStatusLabel =
                                isActiveOnAiAuthorityExchange
                                  ? "Active in exchange"
                                  : "Inactive in exchange";

                              return (
                                <Link
                                  aria-label={`${business.business} (${exchangeStatusLabel})`}
                                  key={`${contact.id}-${business.id}`}
                                  className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 ${getAssignedBusinessClassName(
                                    isActiveOnAiAuthorityExchange,
                                  )}`}
                                  href={`/business/${business.id}`}
                                  title={`${business.business} (${exchangeStatusLabel})`}
                                >
                                  {business.business}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="border-t border-border px-5 py-4 text-right sm:px-6">
                        <div className="flex items-center justify-end gap-3">
                          <ManageContactBusinessesModal
                            businesses={businesses}
                            contact={contact}
                            triggerVariant="icon"
                          />
                          <EditBusinessContactModal contact={contact} />
                          <button
                            className="inline-flex items-center rounded-full border border-[#e3beb9] bg-[#fff4f2] px-4 py-2 text-sm font-medium text-[#8f2e2a] transition hover:-translate-y-0.5 hover:border-[#c85c56] hover:text-[#7a211d]"
                            onClick={() => requestDeleteContact(contact)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-border bg-white/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <p className="text-sm text-muted">
                Showing {visibleStart}-{visibleEnd} of {filteredContacts.length}
              </p>

              <label className="flex items-center gap-3 text-sm text-foreground">
                <span className="font-medium">Rows per page</span>
                <select
                  className="min-h-11 rounded-2xl border border-border bg-white/85 px-4 py-2 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  onChange={(event) => {
                    setCurrentPage(1);
                    setPageSize(Number(event.target.value) as PageSize);
                  }}
                  value={pageSize}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                type="button"
              >
                Previous
              </button>
              <span className="text-sm font-medium text-foreground">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45"
                disabled={safeCurrentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        confirmLabel="Delete Contact"
        description={
          deleteAssignmentsCount > 0
            ? `Delete ${deleteContactName}? This will also clear the assigned ${contactPendingDelete?.role ?? "contact"} field on ${deleteAssignmentsCount} business${deleteAssignmentsCount === 1 ? "" : "es"}.`
            : `Delete ${deleteContactName}? This action cannot be undone.`
        }
        isBusy={isDeleting}
        isOpen={contactPendingDelete !== null}
        onClose={() => {
          if (!isDeleting) {
            setContactPendingDelete(null);
          }
        }}
        onConfirm={confirmDeleteContact}
        title={`Delete ${deleteContactName}?`}
        tone="danger"
      />
    </section>
  );
}
