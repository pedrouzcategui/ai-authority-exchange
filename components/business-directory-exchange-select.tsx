"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type BusinessDirectoryExchangeSelectProps = {
  businessId: number;
  businessName: string;
  initialIsActive: boolean;
};

type ExchangeOption = "active" | "inactive";

function getSelectClassName(option: ExchangeOption) {
  return option === "active"
    ? "border-[#8cc6a7] bg-[#e9f8ef] text-[#276b4a] focus:border-[#4eab78] focus:ring-[#4eab78]/20"
    : "border-[#c3ceda] bg-[#f1f5f8] text-[#55697e] focus:border-brand-deep focus:ring-brand-deep/15";
}

export function BusinessDirectoryExchangeSelect({
  businessId,
  businessName,
  initialIsActive,
}: BusinessDirectoryExchangeSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticValue, setOptimisticValue] = useState<ExchangeOption | null>(
    null,
  );
  const value: ExchangeOption =
    optimisticValue ?? (initialIsActive ? "active" : "inactive");

  function handleChange(nextValue: ExchangeOption) {
    const previousValue = value;
    const nextIsActive = nextValue === "active";

    setOptimisticValue(nextValue);

    startTransition(async () => {
      const response = await fetch(
        `/api/businesses/${businessId}/exchange-status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ active: nextIsActive }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setOptimisticValue(previousValue);
        toast.error(
          payload?.error ?? "The business status could not be updated.",
        );
        return;
      }

      toast.success(
        payload?.message ??
          `${businessName} participation was updated successfully.`,
      );
      setOptimisticValue(null);
      router.refresh();
    });
  }

  return (
    <div className="relative inline-flex min-w-36">
      <select
        aria-label={`Exchange status for ${businessName}`}
        className={`min-h-10 w-full appearance-none rounded-full border px-4 pr-10 pl-4 text-sm font-semibold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${getSelectClassName(
          value,
        )}`}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value as ExchangeOption)}
        value={value}
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-current"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="m7 10 5 5 5-5" />
      </svg>
    </div>
  );
}