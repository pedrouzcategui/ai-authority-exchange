"use client";

import { useState } from "react";
import type { RoundBatchStatus } from "@/generated/prisma/client";
import { RoundDraftTable } from "@/components/round-draft-table";
import { RoundMatchStatusTable } from "@/components/round-match-status-table";
import type {
  RoundBatchMatchStatusRow,
  RoundDraftAssignmentRow,
  RoundDraftOption,
  RoundDraftRow,
} from "@/lib/rounds";

type RoundsViewToggleProps = {
  assignmentRows: RoundDraftAssignmentRow[];
  batchId: number;
  canDeleteAssignments: boolean;
  forbiddenBusinessIdsByBusinessId: Record<number, number[]>;
  pairedBusinessIdsByBusinessId: Record<number, number[]>;
  matchStatusRows: RoundBatchMatchStatusRow[];
  roundSequenceNumber: number | null;
  rows: RoundDraftRow[];
  roundStatus: RoundBatchStatus;
  selectableBusinesses: RoundDraftOption[];
  unresolvedBusinessCount: number;
};

type ViewMode = "email-drafting" | "match-status";

const viewOptions: Array<{ label: string; value: ViewMode }> = [
  { label: "Email Drafting", value: "email-drafting" },
  { label: "Match Status", value: "match-status" },
];

function getViewButtonClassName(active: boolean) {
  return active
    ? "border-accent bg-accent text-white shadow-sm"
    : "border-border bg-white/75 text-muted hover:border-accent hover:text-accent";
}

export function RoundsViewToggle({
  assignmentRows,
  batchId,
  canDeleteAssignments,
  forbiddenBusinessIdsByBusinessId,
  pairedBusinessIdsByBusinessId,
  matchStatusRows,
  roundSequenceNumber,
  rows,
  roundStatus,
  selectableBusinesses,
  unresolvedBusinessCount,
}: RoundsViewToggleProps) {
  const [activeView, setActiveView] = useState<ViewMode>("email-drafting");

  return (
    <div className="space-y-5">
      <section className="rounded-4xl border border-border bg-surface p-4 shadow-(--shadow) backdrop-blur-md sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
              Round Views
            </p>
            <p className="mt-2 text-sm leading-7 text-muted sm:text-base">
              Switch between the business-level email drafting overview and the
              per-match workflow table without scrolling through both.
            </p>
          </div>

          <div className="inline-flex w-full flex-wrap gap-2 rounded-full border border-border bg-white/70 p-1.5 lg:w-auto">
            {viewOptions.map((option) => {
              const isActive = activeView === option.value;

              return (
                <button
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${getViewButtonClassName(isActive)}`}
                  key={option.value}
                  onClick={() => setActiveView(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {activeView === "email-drafting" ? (
        <RoundDraftTable
          assignmentRows={assignmentRows}
          canDeleteAssignments={canDeleteAssignments}
          forbiddenBusinessIdsByBusinessId={forbiddenBusinessIdsByBusinessId}
          pairedBusinessIdsByBusinessId={pairedBusinessIdsByBusinessId}
          roundBatchId={batchId}
          roundSequenceNumber={roundSequenceNumber}
          rows={rows}
          roundStatus={roundStatus}
          selectableBusinesses={selectableBusinesses}
          unresolvedBusinessCount={unresolvedBusinessCount}
        />
      ) : (
        <RoundMatchStatusTable
          roundSequenceNumber={roundSequenceNumber}
          roundStatus={roundStatus}
          rows={matchStatusRows}
        />
      )}
    </div>
  );
}