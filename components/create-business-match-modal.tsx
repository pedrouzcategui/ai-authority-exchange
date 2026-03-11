"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BusinessRoleBadge } from "@/components/business-role-badge";
import type { RoundBatchStatus } from "@/generated/prisma/client";
import type { BusinessOption } from "@/lib/matches";

type SelectableBusiness = Pick<BusinessOption, "business" | "clientType" | "id">;

type RoundOption = {
  id: number;
  sequenceNumber: number;
  status: RoundBatchStatus;
};

type CreateBusinessMatchModalProps = {
  currentBusiness: SelectableBusiness;
  existingCounterpartIds: number[];
  roundBatches: RoundOption[];
  selectableBusinesses: SelectableBusiness[];
};

type CurrentBusinessRole = "guest" | "host";

export function CreateBusinessMatchModal({
  currentBusiness,
  existingCounterpartIds,
  roundBatches,
  selectableBusinesses,
}: CreateBusinessMatchModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [counterpartId, setCounterpartId] = useState("");
  const [roundBatchId, setRoundBatchId] = useState("");
  const [currentBusinessRole, setCurrentBusinessRole] =
    useState<CurrentBusinessRole>("host");
  const portalTarget = typeof document === "undefined" ? null : document.body;

  const existingCounterpartIdSet = new Set(existingCounterpartIds);
  const availableCounterparts = selectableBusinesses.filter(
    (business) =>
      business.id !== currentBusiness.id &&
      !existingCounterpartIdSet.has(business.id),
  );
  const selectedCounterpart =
    availableCounterparts.find(
      (business) => business.id.toString() === counterpartId,
    ) ?? null;

  function resetForm() {
    setCounterpartId("");
    setCurrentBusinessRole("host");
    setRoundBatchId("");
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    resetForm();
  }

  function openModal() {
    if (availableCounterparts.length === 0) {
      return;
    }

    setIsOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCounterpart) {
      toast.error("Choose the business to match with this profile.");
      return;
    }

    const hostId =
      currentBusinessRole === "host"
        ? currentBusiness.id
        : selectedCounterpart.id;
    const guestId =
      currentBusinessRole === "guest"
        ? currentBusiness.id
        : selectedCounterpart.id;

    startTransition(async () => {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guestId,
          hostId,
          roundBatchId: roundBatchId || undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "The match could not be created.");
        return;
      }

      toast.success(payload?.message ?? "Match created successfully.");
      setIsOpen(false);
      resetForm();
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="inline-flex items-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
        disabled={availableCounterparts.length === 0}
        onClick={openModal}
        title={
          availableCounterparts.length === 0
            ? "This business is already matched with every other available business."
            : undefined
        }
        type="button"
      >
        Add Match
      </button>

      {portalTarget && isOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(51,71,91,0.36)] px-4 py-8 backdrop-blur-sm">
              <div className="h-[min(760px,calc(100vh-4rem))] w-full max-w-2xl overflow-y-auto rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                  Add Match
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Create a match for {currentBusiness.business}
                </h2>
                <p className="max-w-xl text-sm leading-7 text-muted sm:text-base">
                  Choose the counterpart business and whether this business should
                  act as the host or the guest for the new match.
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

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="rounded-3xl border border-accent/15 bg-[linear-gradient(135deg,rgba(232,93,79,0.08),rgba(255,255,255,0.92))] p-5">
                <p className="text-sm font-medium tracking-[0.12em] text-accent uppercase">
                  Current Business
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-white/85 px-3.5 py-2 text-sm font-medium text-foreground">
                  <span>{currentBusiness.business}</span>
                  <BusinessRoleBadge role={currentBusiness.clientType} />
                </div>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  {currentBusiness.business} should act as
                </span>
                <select
                  className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  disabled={isPending}
                  onChange={(event) =>
                    setCurrentBusinessRole(
                      event.target.value as CurrentBusinessRole,
                    )
                  }
                  value={currentBusinessRole}
                >
                  <option value="host">Host</option>
                  <option value="guest">Guest</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Counterpart business
                </span>
                <select
                  className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  disabled={availableCounterparts.length === 0 || isPending}
                  onChange={(event) => setCounterpartId(event.target.value)}
                  value={counterpartId}
                >
                  <option value="">Select a business</option>
                  {availableCounterparts.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.business}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Round
                </span>
                <select
                  className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  disabled={isPending}
                  onChange={(event) => setRoundBatchId(event.target.value)}
                  value={roundBatchId}
                >
                  <option value="">No round</option>
                  {roundBatches.map((roundBatch) => (
                    <option key={roundBatch.id} value={roundBatch.id}>
                      {`Round ${roundBatch.sequenceNumber} (${roundBatch.status === "draft" ? "Draft" : "Applied"})`}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-3xl border border-border bg-white/55 p-5 text-sm leading-7 text-muted">
                {selectedCounterpart ? (
                  <>
                    Host: {currentBusinessRole === "host" ? currentBusiness.business : selectedCounterpart.business}. Guest: {currentBusinessRole === "guest" ? currentBusiness.business : selectedCounterpart.business}.
                  </>
                ) : (
                  <>Select a counterpart business to preview the match pair.</>
                )}
              </div>

              <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-muted">
                  {availableCounterparts.length === 0
                    ? "No additional businesses are available for a new match from this profile."
                    : `${availableCounterparts.length} businesses are available to match with ${currentBusiness.business}.${roundBatchId ? " The new match will be linked to the selected round." : ""}`}
                </p>

                <button
                  className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent/45"
                  disabled={!selectedCounterpart || isPending}
                  type="submit"
                >
                  {isPending ? "Creating match..." : "Create match"}
                </button>
              </div>
            </form>
          </div>
        </div>,
            portalTarget,
          )
        : null}
    </>
  );
}