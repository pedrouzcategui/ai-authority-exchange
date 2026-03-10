"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RoundBatchSummary } from "@/lib/rounds";

type RoundBatchPickerProps = {
  batches: RoundBatchSummary[];
  selectedBatchId: number | null;
};

function formatBatchLabel(batch: RoundBatchSummary) {
  const statusLabel = batch.status === "draft" ? "Draft" : "Applied";
  return `Round ${batch.sequenceNumber} · ${statusLabel}`;
}

export function RoundBatchPicker({
  batches,
  selectedBatchId,
}: RoundBatchPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const recentBatches = batches.slice(0, 4);
  const selectedValue = selectedBatchId?.toString() ?? "";

  function selectBatch(batchId: string) {
    if (!batchId) {
      return;
    }

    startTransition(() => {
      router.push(`/rounds?batch=${batchId}`);
    });
  }

  return (
    <div className="flex w-full flex-col gap-3 lg:max-w-md lg:items-end">
      <label className="w-full lg:max-w-md">
        <span className="sr-only">Select round batch</span>
        <select
          aria-label="Select round batch"
          className="min-h-11 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-muted"
          disabled={isPending}
          onChange={(event) => selectBatch(event.target.value)}
          value={selectedValue}
        >
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {formatBatchLabel(batch)}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        {recentBatches.map((batch) => (
          <button
            key={batch.id}
            className={
              batch.id === selectedBatchId
                ? "inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
                : "inline-flex items-center rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            }
            disabled={isPending || batch.id === selectedBatchId}
            onClick={() => selectBatch(batch.id.toString())}
            type="button"
          >
            Round {batch.sequenceNumber}
          </button>
        ))}
      </div>
    </div>
  );
}
