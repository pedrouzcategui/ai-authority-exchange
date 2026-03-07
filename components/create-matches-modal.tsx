"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BusinessRoleBadge } from "@/components/business-role-badge";
import type { BusinessOption } from "@/lib/matches";

type CreateMatchesModalProps = {
  businesses: BusinessOption[];
};

export function CreateMatchesModal({ businesses }: CreateMatchesModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hostId, setHostId] = useState("");
  const [guestIds, setGuestIds] = useState<string[]>([]);

  const availableGuests = businesses.filter(
    (business) => business.id.toString() !== hostId,
  );
  const selectedGuestCount = guestIds.length;

  function resetForm() {
    setHostId("");
    setGuestIds([]);
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    resetForm();
  }

  function toggleGuest(guestId: string) {
    setGuestIds((currentGuestIds) =>
      currentGuestIds.includes(guestId)
        ? currentGuestIds.filter((currentGuestId) => currentGuestId !== guestId)
        : [...currentGuestIds, guestId],
    );
  }

  function handleHostChange(nextHostId: string) {
    setHostId(nextHostId);
    setGuestIds((currentGuestIds) =>
      currentGuestIds.filter((guestId) => guestId !== nextHostId),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hostId || guestIds.length === 0) {
      toast.error(
        "Choose one publisher and at least one published-for business.",
      );
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hostId, guestIds }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "The matches could not be saved.");
        return;
      }

      toast.success(payload?.message ?? "Matches saved successfully.");
      setIsOpen(false);
      resetForm();
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="inline-flex items-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Create Another Match
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#122019]/45 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                  Create Matches
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Select one publisher and multiple published-for businesses
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                  One submission will create one match record for each selected
                  published-for business.
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
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Publisher
                </span>
                <select
                  className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  disabled={businesses.length === 0 || isPending}
                  onChange={(event) => handleHostChange(event.target.value)}
                  value={hostId}
                >
                  <option value="">Select a publisher</option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.business}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">
                    Published-for businesses
                  </span>
                  <span className="text-sm leading-7 text-muted">
                    {selectedGuestCount} selected
                  </span>
                </div>

                <div className="max-h-88 overflow-y-auto rounded-3xl border border-border bg-white/45 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {availableGuests.map((business) => {
                      const businessId = business.id.toString();
                      const isChecked = guestIds.includes(businessId);

                      return (
                        <label
                          key={business.id}
                          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-white/80 px-4 py-3 transition hover:border-accent/45"
                        >
                          <input
                            checked={isChecked}
                            className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                            disabled={!hostId || isPending}
                            onChange={() => toggleGuest(businessId)}
                            type="checkbox"
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-foreground">
                              {business.business}
                            </span>
                            <span className="mt-1 block">
                              <BusinessRoleBadge role={business.clientType} />
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-muted">
                  {businesses.length === 0
                    ? "Add business records first, then create matches."
                    : `${availableGuests.length} businesses available to publish for.`}
                </p>

                <button
                  className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent/45"
                  disabled={
                    businesses.length === 0 ||
                    !hostId ||
                    guestIds.length === 0 ||
                    isPending
                  }
                  type="submit"
                >
                  {isPending
                    ? "Saving matches..."
                    : `Create ${selectedGuestCount || ""} ${selectedGuestCount === 1 ? "match" : "matches"}`.trim()}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
