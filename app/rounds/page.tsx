import Link from "next/link";
import { RoundBatchPicker } from "@/components/round-batch-picker";
import { RoundBatchActions } from "@/components/round-batch-actions";
import { RoundDraftTable } from "@/components/round-draft-table";
import { getRoundBatchView } from "@/lib/rounds";

export const dynamic = "force-dynamic";

type RoundsPageProps = {
  searchParams?: Promise<{
    batch?: string | string[];
  }>;
};

function parseBatchId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate) {
    return undefined;
  }

  const parsedValue = Number.parseInt(candidate, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : undefined;
}

function formatBatchTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export default async function RoundsPage({ searchParams }: RoundsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedBatchId = parseBatchId(resolvedSearchParams.batch);
  const roundBatchView = await getRoundBatchView(requestedBatchId);
  const batchIsDraft = roundBatchView.batch?.status === "draft";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
              Round Drafts
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              AI Authority Exchange rounds
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted sm:text-lg">
              Create a round first, then generate a suggested draft into that
              batch or build it manually. Once the rows look right, you can
              finalize the round from the same view.
            </p>
          </div>

          <Link
            className="inline-flex items-center rounded-full border border-border bg-white/80 px-4 py-2.5 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            href="/matches"
          >
            Back To Match Table
          </Link>
        </div>

        <RoundBatchActions
          canApply={batchIsDraft}
          canClear={batchIsDraft}
          canDelete={Boolean(roundBatchView.batch)}
          canGenerate={batchIsDraft}
          roundBatchId={roundBatchView.batch?.id ?? null}
          roundSequenceNumber={roundBatchView.batch?.sequenceNumber ?? null}
          roundStatus={roundBatchView.batch?.status ?? null}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-4xl border border-border bg-surface p-5 shadow-(--shadow) backdrop-blur-md sm:p-6">
          <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
            Active Businesses
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            {roundBatchView.activeBusinessCount}
          </p>
        </div>
        <div className="rounded-4xl border border-border bg-surface p-5 shadow-(--shadow) backdrop-blur-md sm:p-6">
          <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
            Selected Batch
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            {roundBatchView.batch ? roundBatchView.batch.sequenceNumber : "-"}
          </p>
        </div>
        <div className="rounded-4xl border border-border bg-surface p-5 shadow-(--shadow) backdrop-blur-md sm:p-6">
          <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
            Directed Assignments
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            {roundBatchView.batch?.assignmentCount ?? 0}
          </p>
        </div>
        <div className="rounded-4xl border border-accent bg-accent p-5 text-white shadow-(--shadow) sm:p-6">
          <p className="text-sm font-medium tracking-[0.16em] text-white/78 uppercase">
            Unresolved Businesses
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
            {roundBatchView.unresolvedBusinessCount}
          </p>
        </div>
      </section>

      {roundBatchView.batches.length > 0 ? (
        <section className="rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) backdrop-blur-md sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium tracking-[0.16em] text-muted uppercase">
                Available Batches
              </p>
              <p className="mt-2 text-sm leading-7 text-muted sm:text-base">
                Use the picker for the full round history, then rely on the
                quick buttons for the most recent batches.
              </p>
            </div>
            <RoundBatchPicker
              batches={roundBatchView.batches}
              selectedBatchId={roundBatchView.batch?.id ?? null}
            />
          </div>

          {roundBatchView.batch ? (
            <div className="mt-5 rounded-3xl border border-border bg-white/70 p-5 text-sm leading-7 text-muted">
              <p>
                Batch status:{" "}
                <span className="font-semibold text-foreground">
                  {roundBatchView.batch.status}
                </span>
              </p>
              <p>
                Created: {formatBatchTimestamp(roundBatchView.batch.createdAt)}
              </p>
              {roundBatchView.batch.appliedAt ? (
                <p>
                  Applied:{" "}
                  {formatBatchTimestamp(roundBatchView.batch.appliedAt)}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {roundBatchView.batch ? (
        <RoundDraftTable
          assignmentRows={roundBatchView.assignmentRows}
          key={roundBatchView.batch.id}
          roundBatchId={roundBatchView.batch.id}
          rows={roundBatchView.rows}
          roundStatus={roundBatchView.batch.status}
          selectableBusinesses={roundBatchView.selectableBusinesses}
          unresolvedBusinessCount={roundBatchView.unresolvedBusinessCount}
        />
      ) : (
        <section className="rounded-4xl border border-dashed border-border bg-white/60 px-6 py-14 text-center">
          <p className="text-lg font-medium text-foreground">
            No round drafts have been created yet.
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Use Create Round to open the first batch, then generate a draft into
            it or start adding rows manually.
          </p>
        </section>
      )}
    </main>
  );
}
