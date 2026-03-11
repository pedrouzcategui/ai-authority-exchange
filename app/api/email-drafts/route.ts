import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-session";
import {
  createEmailDraftForMatch,
  GmailDraftError,
} from "@/lib/gmail-drafts";

type CreateEmailDraftPayload = {
  guestId?: unknown;
  hostId?: unknown;
  roundBatchId?: unknown;
};

function parseNumericId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number.parseInt(value, 10);

    if (Number.isInteger(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: CreateEmailDraftPayload;

  try {
    payload = (await request.json()) as CreateEmailDraftPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const hostId = parseNumericId(payload.hostId);
  const guestId = parseNumericId(payload.guestId);
  const roundBatchId = parseNumericId(payload.roundBatchId);

  if (hostId === null || guestId === null || hostId === guestId) {
    return NextResponse.json(
      { error: "Please provide two different businesses to draft the email." },
      { status: 400 },
    );
  }

  try {
    const draft = await createEmailDraftForMatch({
      guestId,
      hostId,
      roundBatchId,
      userId: session.user.id,
    });

    return NextResponse.json(
      {
        draftId: draft.draftId,
        message: `Email draft created for ${draft.hostBusiness.business} and ${draft.guestBusiness.business}. Match status updated to Draft Created.`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof GmailDraftError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { error: "The email draft could not be created." },
      { status: 500 },
    );
  }
}