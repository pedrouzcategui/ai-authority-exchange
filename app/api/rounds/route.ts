import { NextResponse } from "next/server";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { createRoundBatch } from "@/lib/rounds";

export async function POST() {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const batch = await createRoundBatch();

    return NextResponse.json(
      {
        batch,
        message: `Round ${batch.sequenceNumber} was created and is ready for draft generation or manual edits.`,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: `The round could not be created. ${message}` },
      { status: 400 },
    );
  }
}
