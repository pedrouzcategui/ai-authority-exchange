"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionTooltip, CreateMatchIcon } from "@/components/action-icons";
import { BusinessRoleBadge } from "@/components/business-role-badge";
import type { BusinessOption } from "@/lib/matches";

type CreateSuggestedMatchModalProps = {
  parentBusiness: BusinessOption;
  suggestedBusiness: BusinessOption;
};

function getOtherBusinessId(
  selectedBusinessId: string,
  parentBusinessId: string,
  suggestedBusinessId: string,
) {
  return selectedBusinessId === parentBusinessId
    ? suggestedBusinessId
    : parentBusinessId;
}

export function CreateSuggestedMatchModal({
  parentBusiness,
  suggestedBusiness,
}: CreateSuggestedMatchModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const parentBusinessId = parentBusiness.id.toString();
  const suggestedBusinessId = suggestedBusiness.id.toString();
  const [hostId, setHostId] = useState(parentBusinessId);
  const [guestId, setGuestId] = useState(suggestedBusinessId);
  const portalTarget = typeof document === "undefined" ? null : document.body;
  const selectableBusinesses = [parentBusiness, suggestedBusiness];

  function selectedHostBusiness() {
    return (
      selectableBusinesses.find((business) => business.id.toString() === hostId) ??
      null
    );
  }

  function selectedGuestBusiness() {
    return (
      selectableBusinesses.find((business) => business.id.toString() === guestId) ??
      null
    );
  }

  function resetForm() {
    setHostId(parentBusinessId);
    setGuestId(suggestedBusinessId);
  }

  function openModal() {
    resetForm();
    setIsOpen(true);
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    resetForm();
  }

  function handleHostChange(nextHostId: string) {
    setHostId(nextHostId);
    setGuestId(
      getOtherBusinessId(nextHostId, parentBusinessId, suggestedBusinessId),
    );
  }

  function handleGuestChange(nextGuestId: string) {
    setGuestId(nextGuestId);
    setHostId(
      getOtherBusinessId(nextGuestId, parentBusinessId, suggestedBusinessId),
    );
  }

  function handleAction(action: "match-only" | "match-and-draft") {
    if (!hostId || !guestId || hostId === guestId) {
      toast.error("Choose one host and one guest business.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guestId,
          hostId,
          status: "In_Progress",
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

      if (action === "match-and-draft") {
        const draftResponse = await fetch("/api/email-drafts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ guestId, hostId }),
        });

        const draftPayload = (await draftResponse.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;

        if (!draftResponse.ok) {
          toast.error(
            draftPayload?.error ??
              "The match was created, but the email draft could not be created.",
          );
          router.refresh();
          setIsOpen(false);
          resetForm();
          return;
        }

        toast.success(
          draftPayload?.message ??
            "Match created and email draft added to your Gmail account.",
        );
      } else {
        toast.success(payload?.message ?? "Match created successfully.");
      }

      setIsOpen(false);
      resetForm();
      router.refresh();
    });
  }

  return (
    <>
      <span className="group relative inline-flex">
        <button
          aria-label={`Create match between ${parentBusiness.business} and ${suggestedBusiness.business}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/80 text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
          onClick={openModal}
          type="button"
        >
          <CreateMatchIcon />
        </button>
        <ActionTooltip label="Create match" />
      </span>

      {portalTarget && isOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(51,71,91,0.36)] px-4 py-8 backdrop-blur-sm">
              <div className="h-[min(760px,calc(100vh-4rem))] w-full max-w-2xl overflow-y-auto rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                      Create Match
                    </p>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      Match {suggestedBusiness.business} with {parentBusiness.business}
                    </h2>
                    <p className="max-w-xl text-sm leading-7 text-muted sm:text-base">
                      Choose which business should act as the host and which one should act as the guest. New matches created here start in In Progress automatically.
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

                <form className="mt-8 space-y-6">
                  <div className="rounded-3xl border border-accent/15 bg-[linear-gradient(135deg,rgba(232,93,79,0.08),rgba(255,255,255,0.92))] p-5">
                    <p className="text-sm font-medium tracking-[0.12em] text-accent uppercase">
                      Selected Pair
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {selectableBusinesses.map((business) => (
                        <span
                          key={business.id}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-white/85 px-3.5 py-2 text-sm font-medium text-foreground"
                        >
                          <span>{business.business}</span>
                          <BusinessRoleBadge role={business.clientType} />
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">
                        Host business
                      </span>
                      <select
                        className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                        disabled={isPending}
                        onChange={(event) => handleHostChange(event.target.value)}
                        value={hostId}
                      >
                        {selectableBusinesses.map((business) => (
                          <option key={business.id} value={business.id}>
                            {business.business}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">
                        Guest business
                      </span>
                      <select
                        className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                        disabled={isPending}
                        onChange={(event) => handleGuestChange(event.target.value)}
                        value={guestId}
                      >
                        {selectableBusinesses.map((business) => (
                          <option key={business.id} value={business.id}>
                            {business.business}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="rounded-3xl border border-border bg-white/55 p-5 text-sm leading-7 text-muted">
                    The new match will be created with status set to <span className="font-semibold text-foreground">In Progress</span> so it appears in the workflow table immediately.
                  </div>

                  <div className="rounded-3xl border border-border bg-white/55 p-5 text-sm leading-7 text-muted">
                    Email drafts are created in the signed-in user&apos;s Gmail account. Because this workspace does not currently store company contact emails, the draft is created without recipients so you can review and address it before sending.
                  </div>

                  <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-7 text-muted">
                      Host: {selectedHostBusiness()?.business ?? "Not selected"}. Guest: {selectedGuestBusiness()?.business ?? "Not selected"}.
                    </p>

                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isPending || !hostId || !guestId || hostId === guestId}
                        onClick={() => handleAction("match-only")}
                        type="button"
                      >
                        {isPending ? "Creating..." : "Create match"}
                      </button>
                      <button
                        className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent/45"
                        disabled={isPending || !hostId || !guestId || hostId === guestId}
                        onClick={() => handleAction("match-and-draft")}
                        type="button"
                      >
                        {isPending ? "Creating..." : "Create match and create email draft"}
                      </button>
                    </div>
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