"use client";

import { useDeferredValue, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionTooltip, EditLinksIcon } from "@/components/action-icons";
import { BusinessRoleBadge } from "@/components/business-role-badge";
import type { BusinessContactDirectoryRow, BusinessOption } from "@/lib/matches";

type ManageContactBusinessesModalProps = {
  businesses: BusinessOption[];
  contact: BusinessContactDirectoryRow;
  triggerVariant?: "default" | "icon";
};

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase();
}

function getAssignedBusinesses(contact: BusinessContactDirectoryRow) {
  return contact.role === "marketer"
    ? contact.marketerForBusinesses
    : contact.expertForBusinesses;
}

function getContactDisplayName(contact: {
  email: string | null;
  firstName: string | null;
  fullName: string | null;
  id: number;
  lastName: string | null;
}) {
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

export function ManageContactBusinessesModal({
  businesses,
  contact,
  triggerVariant = "default",
}: ManageContactBusinessesModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const portalTarget = typeof document === "undefined" ? null : document.body;
  const roleLabel = contact.role === "marketer" ? "Marketer" : "Expert";
  const normalizedSearchQuery = normalizeSearchValue(deferredSearchQuery);
  const assignedBusinesses = getAssignedBusinesses(contact);
  const selectedIdSet = new Set(selectedIds);

  const filteredBusinesses = businesses.filter((business) => {
    if (normalizedSearchQuery.length === 0) {
      return true;
    }

    return business.business
      .toLocaleLowerCase()
      .includes(normalizedSearchQuery);
  });

  function openModal() {
    setSelectedIds(assignedBusinesses.map((business) => business.id.toString()));
    setSearchQuery("");
    setIsOpen(true);
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setIsOpen(false);
  }

  function toggleSelection(businessId: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(businessId)
        ? currentIds.filter((currentId) => currentId !== businessId)
        : [...currentIds, businessId],
    );
  }

  function handleSubmit() {
    startTransition(async () => {
      const response = await fetch(
        `/api/business-contacts/${contact.id}/businesses`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessIds: selectedIds,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(
          payload?.error ?? "The business assignments could not be updated.",
        );
        return;
      }

      toast.success(payload?.message ?? "Business assignments updated.");
      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {triggerVariant === "icon" ? (
        <span className="group relative inline-flex">
          <button
            aria-label="Edit businesses"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/80 text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
            onClick={openModal}
            type="button"
          >
            <EditLinksIcon />
          </button>
          <ActionTooltip label="Edit businesses" />
        </span>
      ) : (
        <button
          className="inline-flex items-center rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
          onClick={openModal}
          type="button"
        >
          Edit businesses
        </button>
      )}

      {portalTarget && isOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(51,71,91,0.36)] px-4 py-8 backdrop-blur-sm">
              <div className="max-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-y-auto rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                      Manage Businesses
                    </p>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      Update {roleLabel.toLocaleLowerCase()} assignments for{" "}
                      {getContactDisplayName(contact)}
                    </h2>
                    <p className="max-w-3xl text-sm leading-7 text-muted sm:text-base">
                      Select every business that should use this {roleLabel.toLocaleLowerCase()}.
                      Businesses already assigned to a different {roleLabel.toLocaleLowerCase()} are shown but disabled.
                    </p>
                  </div>

                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
                    onClick={closeModal}
                    type="button"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-8 space-y-4 rounded-3xl border border-border bg-white/55 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        Assigned businesses
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        Toggle businesses on or off to control who this {roleLabel.toLocaleLowerCase()} represents.
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium tracking-[0.16em] text-muted uppercase">
                      {selectedIds.length} selected
                    </span>
                  </div>

                  <input
                    className="min-h-11 w-full rounded-2xl border border-border bg-white/90 px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search businesses"
                    type="search"
                    value={searchQuery}
                  />

                  {filteredBusinesses.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm leading-7 text-muted">
                      No businesses matched that search.
                    </p>
                  ) : (
                    <div className="max-h-96 overflow-y-auto rounded-2xl bg-surface-muted p-2">
                      <div className="flex flex-wrap gap-2.5">
                        {filteredBusinesses.map((business) => {
                          const optionId = business.id.toString();
                          const isSelected = selectedIdSet.has(optionId);
                          const assignedContact =
                            contact.role === "marketer"
                              ? business.marketer
                              : business.expert;
                          const isDisabled =
                            !isSelected &&
                            assignedContact !== null &&
                            assignedContact.id !== contact.id;

                          return (
                            <button
                              aria-pressed={isSelected}
                              className={
                                isSelected
                                  ? "inline-flex items-center gap-2 rounded-full border border-accent bg-accent px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-accent-strong"
                                  : isDisabled
                                    ? "inline-flex items-center gap-2 rounded-full border border-border bg-white/55 px-3.5 py-2 text-sm font-medium text-muted opacity-60"
                                    : "inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent"
                              }
                              disabled={isDisabled}
                              key={business.id}
                              onClick={() => toggleSelection(optionId)}
                              type="button"
                            >
                              <span>{business.business}</span>
                              <BusinessRoleBadge
                                role={business.clientType}
                                tone={isSelected ? "inverse" : "default"}
                              />
                              {isDisabled ? (
                                <span className="text-xs font-medium">
                                  Assigned to {getContactDisplayName(assignedContact)}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-7 text-muted">
                    Saving replaces the current business assignments for this {roleLabel.toLocaleLowerCase()}.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={isPending || selectedIds.length === 0}
                      onClick={() => setSelectedIds([])}
                      type="button"
                    >
                      Clear all
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent/45"
                      disabled={isPending}
                      onClick={handleSubmit}
                      type="button"
                    >
                      {isPending ? "Saving businesses..." : "Save businesses"}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            portalTarget,
          )
        : null}
    </>
  );
}