"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ActionTooltip, DraftEmailIcon } from "@/components/action-icons";

type CreateEmailDraftButtonProps = {
  guestId: number;
  hostId: number;
  tooltipLabel?: string;
  triggerVariant?: "default" | "icon";
};

export function CreateEmailDraftButton({
  guestId,
  hostId,
  tooltipLabel = "Create email draft",
  triggerVariant = "icon",
}: CreateEmailDraftButtonProps) {
  const [isPending, startTransition] = useTransition();

  function createDraft() {
    startTransition(async () => {
      const response = await fetch("/api/email-drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ guestId, hostId }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "The email draft could not be created.");
        return;
      }

      toast.success(
        payload?.message ?? "Email draft created in your Gmail account.",
      );
    });
  }

  if (triggerVariant === "default") {
    return (
      <button
        className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={createDraft}
        type="button"
      >
        {isPending ? "Creating draft..." : "Create email draft"}
      </button>
    );
  }

  return (
    <span className="group relative inline-flex">
      <button
        aria-label={tooltipLabel}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/80 text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={createDraft}
        type="button"
      >
        <DraftEmailIcon />
      </button>
      <ActionTooltip label={isPending ? "Creating draft..." : tooltipLabel} />
    </span>
  );
}