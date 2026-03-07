"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BusinessOption } from "@/lib/matches";

type MatchFormProps = {
  businesses: BusinessOption[];
};

export function MatchForm({ businesses }: MatchFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hostId, setHostId] = useState("");
  const [guestId, setGuestId] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hostId || !guestId) {
      toast.error("Choose both a host and a guest business.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hostId, guestId }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "The match could not be saved.");
        return;
      }

      toast.success(payload?.message ?? "Match saved successfully.");
      setHostId("");
      setGuestId("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
          Create Match
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Assign the businesses
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
          Pick a host business and a guest business, then submit the pair to
          save it to the matches table.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">
              Host business
            </span>
            <select
              className="w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              disabled={businesses.length === 0 || isPending}
              onChange={(event) => setHostId(event.target.value)}
              value={hostId}
            >
              <option value="">Select a host</option>
              {businesses.map((business) => (
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
              className="w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              disabled={businesses.length === 0 || isPending}
              onChange={(event) => setGuestId(event.target.value)}
              value={guestId}
            >
              <option value="">Select a guest</option>
              {businesses.map((business) => (
                <option
                  key={business.id}
                  disabled={business.id.toString() === hostId}
                  value={business.id}
                >
                  {business.business}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-7 text-muted">
            {businesses.length === 0
              ? "Add business records first, then create a match."
              : `${businesses.length} businesses available for selection.`}
          </p>

          <button
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent/45"
            disabled={businesses.length === 0 || isPending}
            type="submit"
          >
            {isPending ? "Saving match..." : "Submit match"}
          </button>
        </div>
      </form>
    </div>
  );
}
