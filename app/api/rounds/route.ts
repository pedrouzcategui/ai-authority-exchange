import { NextResponse } from "next/server";
import { requireAuthSession } from "@/lib/auth-session";
import { createRoundDraftBatch } from "@/lib/rounds";

export async function POST() {
  const session = await requireAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const batch = await createRoundDraftBatch();

    return NextResponse.json(
      {
        batch,
        message:
          batch.assignmentCount === 0
            ? `Round ${batch.sequenceNumber} was created as a draft, but no suggested assignments were available.`
            : batch.isComplete
              ? `Round ${batch.sequenceNumber} was created with ${batch.assignmentCount} directed assignment${batch.assignmentCount === 1 ? "" : "s"}. Every active business received a full placement.`
              : `Round ${batch.sequenceNumber} was created with ${batch.assignmentCount} directed assignment${batch.assignmentCount === 1 ? "" : "s"}, but ${batch.unresolvedBusinessCount} business${batch.unresolvedBusinessCount === 1 ? " still needs" : "es still need"} a complete placement because the remaining pairings are blocked by current rules.`,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: `The round draft could not be created. ${message}` },
      { status: 400 },
    );
  }
}
