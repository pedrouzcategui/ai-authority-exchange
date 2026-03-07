"use client";

import {
  useDeferredValue,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BusinessRoleBadge } from "@/components/business-role-badge";
import type { BusinessOption } from "@/lib/matches";

type ManageBusinessRelationshipsModalProps = {
  business: BusinessOption;
  businesses: BusinessOption[];
  publishedBy: BusinessOption[];
  publishedFor: BusinessOption[];
};

type RelationshipSelectorProps = {
  description: string;
  emptyLabel: string;
  onQueryChange: Dispatch<SetStateAction<string>>;
  onToggleSelection: (businessId: string) => void;
  options: BusinessOption[];
  query: string;
  selectedIds: string[];
  title: string;
};

function RelationshipSelector({
  description,
  emptyLabel,
  onQueryChange,
  onToggleSelection,
  options,
  query,
  selectedIds,
  title,
}: RelationshipSelectorProps) {
  const selectedIdSet = new Set(selectedIds);

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-white/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium tracking-[0.16em] text-muted uppercase">
          {selectedIds.length} selected
        </span>
      </div>

      <input
        className="min-h-11 w-full rounded-2xl border border-border bg-white/90 px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search businesses"
        type="search"
        value={query}
      />

      {options.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm leading-7 text-muted">
          {emptyLabel}
        </p>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-2xl bg-[#f8f3eb] p-2">
          <div className="flex flex-wrap gap-2.5">
            {options.map((option) => {
              const optionId = option.id.toString();
              const isSelected = selectedIdSet.has(optionId);

              return (
                <button
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? "inline-flex items-center gap-2 rounded-full border border-accent bg-accent px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-accent-strong"
                      : "inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent"
                  }
                  key={option.id}
                  onClick={() => onToggleSelection(optionId)}
                  type="button"
                >
                  <span>{option.business}</span>
                  <BusinessRoleBadge
                    role={option.clientType}
                    tone={isSelected ? "inverse" : "default"}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export function ManageBusinessRelationshipsModal({
  business,
  businesses,
  publishedBy,
  publishedFor,
}: ManageBusinessRelationshipsModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [publishedByIds, setPublishedByIds] = useState<string[]>([]);
  const [publishedForIds, setPublishedForIds] = useState<string[]>([]);
  const [publishedByQuery, setPublishedByQuery] = useState("");
  const [publishedForQuery, setPublishedForQuery] = useState("");
  const deferredPublishedByQuery = useDeferredValue(publishedByQuery);
  const deferredPublishedForQuery = useDeferredValue(publishedForQuery);
  const portalTarget = typeof document === "undefined" ? null : document.body;

  const selectableBusinesses = businesses.filter(
    (candidate) => candidate.id !== business.id,
  );
  const filteredPublishedByOptions = selectableBusinesses.filter((candidate) =>
    candidate.business
      .toLocaleLowerCase()
      .includes(deferredPublishedByQuery.trim().toLocaleLowerCase()),
  );
  const filteredPublishedForOptions = selectableBusinesses.filter((candidate) =>
    candidate.business
      .toLocaleLowerCase()
      .includes(deferredPublishedForQuery.trim().toLocaleLowerCase()),
  );

  function openModal() {
    setPublishedByIds(publishedBy.map((item) => item.id.toString()));
    setPublishedForIds(publishedFor.map((item) => item.id.toString()));
    setPublishedByQuery("");
    setPublishedForQuery("");
    setIsOpen(true);
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setIsOpen(false);
  }

  function toggleSelection(
    businessId: string,
    setSelectedIds: Dispatch<SetStateAction<string[]>>,
  ) {
    setSelectedIds((currentIds) =>
      currentIds.includes(businessId)
        ? currentIds.filter((currentId) => currentId !== businessId)
        : [...currentIds, businessId],
    );
  }

  function handleSubmit() {
    startTransition(async () => {
      const response = await fetch("/api/business-relationships", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: business.id,
          publishedByIds,
          publishedForIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(
          payload?.error ?? "The business relationships could not be updated.",
        );
        return;
      }

      toast.success(payload?.message ?? "Business relationships updated.");
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
        Edit links
      </button>

      {portalTarget && isOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#122019]/45 px-4 py-8 backdrop-blur-sm">
              <div className="max-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-y-auto rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                      Manage Relationships
                    </p>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      Update publishing links for {business.business}
                    </h2>
                    <p className="max-w-3xl text-sm leading-7 text-muted sm:text-base">
                      Toggle businesses on or off to control who publishes this
                      business and who this business publishes for.
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

                <div className="mt-8 grid gap-5 lg:grid-cols-2">
                  <RelationshipSelector
                    description="Select the businesses that publish this business."
                    emptyLabel="No businesses matched that search."
                    onQueryChange={setPublishedByQuery}
                    onToggleSelection={(businessId) =>
                      toggleSelection(businessId, setPublishedByIds)
                    }
                    options={filteredPublishedByOptions}
                    query={publishedByQuery}
                    selectedIds={publishedByIds}
                    title="Published By"
                  />

                  <RelationshipSelector
                    description="Select the businesses this business publishes for."
                    emptyLabel="No businesses matched that search."
                    onQueryChange={setPublishedForQuery}
                    onToggleSelection={(businessId) =>
                      toggleSelection(businessId, setPublishedForIds)
                    }
                    options={filteredPublishedForOptions}
                    query={publishedForQuery}
                    selectedIds={publishedForIds}
                    title="Published For"
                  />
                </div>

                <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-7 text-muted">
                    {publishedByIds.length + publishedForIds.length} total
                    relationship selection
                    {publishedByIds.length + publishedForIds.length === 1
                      ? ""
                      : "s"}{" "}
                    across both lists.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={isPending}
                      onClick={() => {
                        setPublishedByIds([]);
                        setPublishedForIds([]);
                      }}
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
                      {isPending ? "Saving links..." : "Save relationships"}
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
