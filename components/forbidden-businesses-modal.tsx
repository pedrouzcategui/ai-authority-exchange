"use client";

import { useDeferredValue, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BusinessRoleBadge } from "@/components/business-role-badge";
import type { BusinessOption } from "@/lib/matches";

type ForbiddenBusinessesModalProps = {
  business: BusinessOption;
  businesses: BusinessOption[];
  forbiddenBusinesses: BusinessOption[];
};

export function ForbiddenBusinessesModal({
  business,
  businesses,
  forbiddenBusinesses,
}: ForbiddenBusinessesModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query);
  const portalTarget = typeof document === "undefined" ? null : document.body;

  const filteredBusinesses = businesses.filter((candidate) => {
    if (candidate.id === business.id) {
      return false;
    }

    return candidate.business
      .toLocaleLowerCase()
      .includes(deferredQuery.trim().toLocaleLowerCase());
  });

  function openModal() {
    setSelectedIds(forbiddenBusinesses.map((item) => item.id.toString()));
    setQuery("");
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
        `/api/businesses/${business.id}/forbidden-businesses`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            forbiddenBusinessIds: selectedIds,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(
          payload?.error ?? "The forbidden competitors could not be updated.",
        );
        return;
      }

      toast.success(payload?.message ?? "Forbidden competitors updated.");
      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="inline-flex items-center rounded-full border border-border bg-white/80 px-4 py-2.5 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
        onClick={openModal}
        type="button"
      >
        Edit forbidden competitors
      </button>

      {portalTarget && isOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(51,71,91,0.36)] px-4 py-8 backdrop-blur-sm">
              <div className="max-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-y-auto rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                      Forbidden Competitors
                    </p>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      Update blocked pairings for {business.business}
                    </h2>
                    <p className="max-w-3xl text-sm leading-7 text-muted sm:text-base">
                      These selections block new manual matches from this
                      profile for this pair in either direction.
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

                <section className="mt-8 space-y-4 rounded-3xl border border-border bg-white/55 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        Forbidden competitors
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        Toggle businesses on or off to block them from new
                        manual matches with {business.business}.
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium tracking-[0.16em] text-muted uppercase">
                      {selectedIds.length} selected
                    </span>
                  </div>

                  <input
                    className="min-h-11 w-full rounded-2xl border border-border bg-white/90 px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search businesses"
                    type="search"
                    value={query}
                  />

                  {filteredBusinesses.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm leading-7 text-muted">
                      No businesses matched that search.
                    </p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto rounded-2xl bg-surface-muted p-2">
                      <div className="flex flex-wrap gap-2.5">
                        {filteredBusinesses.map((candidate) => {
                          const candidateId = candidate.id.toString();
                          const isSelected = selectedIds.includes(candidateId);

                          return (
                            <button
                              aria-pressed={isSelected}
                              className={
                                isSelected
                                  ? "inline-flex items-center gap-2 rounded-full border border-accent bg-accent px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-accent-strong"
                                  : "inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent"
                              }
                              key={candidate.id}
                              onClick={() => toggleSelection(candidateId)}
                              type="button"
                            >
                              <span>{candidate.business}</span>
                              <BusinessRoleBadge
                                role={candidate.clientType}
                                tone={isSelected ? "inverse" : "default"}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>

                <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-7 text-muted">
                    {selectedIds.length === 0
                      ? `No forbidden competitors are selected for ${business.business}.`
                      : `${selectedIds.length} forbidden competitor selection${selectedIds.length === 1 ? "" : "s"} will be saved for ${business.business}.`}
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={isPending}
                      onClick={closeModal}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent/45"
                      disabled={isPending}
                      onClick={handleSubmit}
                      type="button"
                    >
                      {isPending
                        ? "Saving forbidden competitors..."
                        : "Save forbidden competitors"}
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