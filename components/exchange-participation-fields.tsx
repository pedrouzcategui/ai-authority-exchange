"use client";

import type { ExchangeParticipationStatus } from "@/lib/ai-authority-exchange";

type ExchangeParticipationFieldsProps = {
  disabled: boolean;
  retiredAt: string;
  retiredRoundSequenceNumber: string;
  status: ExchangeParticipationStatus;
  onRetiredAtChange: (value: string) => void;
  onRetiredRoundSequenceNumberChange: (value: string) => void;
  onStatusChange: (value: ExchangeParticipationStatus) => void;
};

const statusOptions = [
  {
    description:
      "The business stays outside round generation until you opt it in.",
    label: "Not participating",
    value: "not-participating",
  },
  {
    description:
      "The business can appear in new AI Authority Exchange round drafts.",
    label: "Active in the exchange",
    value: "active",
  },
  {
    description:
      "The business has left the exchange and should be tracked historically.",
    label: "Retired from the exchange",
    value: "retired",
  },
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  value: ExchangeParticipationStatus;
}>;

export function ExchangeParticipationFields({
  disabled,
  retiredAt,
  retiredRoundSequenceNumber,
  status,
  onRetiredAtChange,
  onRetiredRoundSequenceNumberChange,
  onStatusChange,
}: ExchangeParticipationFieldsProps) {
  const selectedStatus =
    statusOptions.find((option) => option.value === status) ?? statusOptions[0];

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-white/55 p-4 sm:p-5">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          AI Authority Exchange status
        </p>
        <p className="text-sm leading-7 text-muted">
          {selectedStatus.description}
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Status</span>
        <select
          className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          disabled={disabled}
          onChange={(event) =>
            onStatusChange(event.target.value as ExchangeParticipationStatus)
          }
          value={status}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {status === "retired" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Retirement date
            </span>
            <input
              className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              disabled={disabled}
              onChange={(event) => onRetiredAtChange(event.target.value)}
              type="date"
              value={retiredAt}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Retirement round
            </span>
            <input
              className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              disabled={disabled}
              inputMode="numeric"
              min="1"
              onChange={(event) =>
                onRetiredRoundSequenceNumberChange(event.target.value)
              }
              placeholder="Optional"
              step="1"
              type="number"
              value={retiredRoundSequenceNumber}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}
