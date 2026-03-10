"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ExchangeParticipationStatus } from "@/lib/ai-authority-exchange";

type BusinessExchangeParticipationToggleProps = {
  businessId: number;
  businessName: string;
  initialStatus: ExchangeParticipationStatus;
};

function getStatusLabel(status: ExchangeParticipationStatus) {
  if (status === "active") {
    return "Active";
  }

  if (status === "retired") {
    return "Retired";
  }

  return "Not Participating";
}

function getStatusClassName(status: ExchangeParticipationStatus) {
  if (status === "active") {
    return "border-[#8cc6a7] bg-[#e9f8ef] text-[#276b4a]";
  }

  if (status === "retired") {
    return "border-[#efb1a8] bg-[#fff0ec] text-[#b55247]";
  }

  return "border-[#c3ceda] bg-[#f1f5f8] text-[#55697e]";
}

function getHelperText(status: ExchangeParticipationStatus) {
  if (status === "active") {
    return "This business can be included in future AI Authority Exchange rounds.";
  }

  if (status === "retired") {
    return "This business is currently retired. Turning the checkbox on will reactivate it. Use Edit business if you need to manage retirement details instead.";
  }

  return "This business is currently excluded from the AI Authority Exchange process.";
}

export function BusinessExchangeParticipationToggle({
  businessId,
  businessName,
  initialStatus,
}: BusinessExchangeParticipationToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const isChecked = status === "active";

  function handleCheckedChange(nextChecked: boolean) {
    const previousStatus = status;
    const nextStatus: ExchangeParticipationStatus = nextChecked
      ? "active"
      : "not-participating";

    setStatus(nextStatus);

    startTransition(async () => {
      const response = await fetch(
        `/api/businesses/${businessId}/exchange-status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ active: nextChecked }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        exchangeParticipationStatus?: ExchangeParticipationStatus;
        message?: string;
      } | null;

      if (!response.ok) {
        setStatus(previousStatus);
        toast.error(
          payload?.error ?? "The business status could not be updated.",
        );
        return;
      }

      setStatus(payload?.exchangeParticipationStatus ?? nextStatus);
      toast.success(
        payload?.message ??
          `${businessName} participation was updated successfully.`,
      );
      router.refresh();
    });
  }

  return (
    <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
            Exchange Participation
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Active in the process
          </h2>
          <p className="text-sm leading-7 text-muted sm:text-base">
            Use this checkbox for the quick active or inactive case. If you need
            to mark the business as retired and keep retirement details, use the
            Edit business flow.
          </p>
        </div>

        <span
          className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${getStatusClassName(status)}`}
        >
          {getStatusLabel(status)}
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/75 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm font-medium text-foreground">
            <input
              checked={isChecked}
              className="h-5 w-5 rounded border-border text-accent focus:ring-accent/25"
              disabled={isPending}
              onChange={(event) => handleCheckedChange(event.target.checked)}
              type="checkbox"
            />
            Active in AI Authority Exchange
          </label>
          <p className="text-sm leading-7 text-muted">
            {getHelperText(status)}
          </p>
        </div>

        <p className="text-sm leading-7 text-muted sm:max-w-sm sm:text-right">
          {isPending
            ? "Saving participation status..."
            : "Changes here update round eligibility immediately after refresh."}
        </p>
      </div>
    </section>
  );
}
