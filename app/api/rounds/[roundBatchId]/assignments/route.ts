import { NextResponse } from "next/server";
import { requireLegacyUserSession } from "@/lib/auth-session";
import {
  deleteRoundAssignmentRow,
  updateRoundAssignment,
  upsertRoundAssignmentRow,
} from "@/lib/rounds";

type RouteContext = {
  params: Promise<{
    roundBatchId: string;
  }>;
};

type UpdateRoundAssignmentPayload = {
  action?: unknown;
  assignmentId?: unknown;
  businessId?: unknown;
  counterpartBusinessId?: unknown;
  direction?: unknown;
  guestBusinessId?: unknown;
  hostBusinessId?: unknown;
};

function parseNumericId(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number.parseInt(value, 10);

    if (Number.isInteger(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  return undefined;
}

function parseDirection(value: unknown) {
  return value === "publishedBy" || value === "publishedFor" ? value : null;
}

function parseAction(value: unknown) {
  return value === "deleteRow" || value === "upsertRow" ? value : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { roundBatchId: rawRoundBatchId } = await context.params;
  const roundBatchId = parseNumericId(rawRoundBatchId);

  if (roundBatchId === undefined || roundBatchId === null) {
    return NextResponse.json(
      { error: "The selected round draft is invalid." },
      { status: 400 },
    );
  }

  let payload: UpdateRoundAssignmentPayload;

  try {
    payload = (await request.json()) as UpdateRoundAssignmentPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const businessId = parseNumericId(payload.businessId);
  const counterpartBusinessId = parseNumericId(payload.counterpartBusinessId);
  const direction = parseDirection(payload.direction);
  const action = parseAction(payload.action);
  const assignmentId = parseNumericId(payload.assignmentId);
  const guestBusinessId = parseNumericId(payload.guestBusinessId);
  const hostBusinessId = parseNumericId(payload.hostBusinessId);

  if (action === "upsertRow") {
    if (
      hostBusinessId === undefined ||
      hostBusinessId === null ||
      guestBusinessId === undefined ||
      guestBusinessId === null
    ) {
      return NextResponse.json(
        {
          error:
            "Please provide a valid publishing business and receiving business.",
        },
        { status: 400 },
      );
    }

    try {
      const result = await upsertRoundAssignmentRow({
        assignmentId: assignmentId ?? null,
        guestBusinessId,
        hostBusinessId,
        roundBatchId,
      });

      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return NextResponse.json(
        { error: `The round row could not be saved. ${message}` },
        { status: 400 },
      );
    }
  }

  if (action === "deleteRow") {
    if (assignmentId === undefined || assignmentId === null) {
      return NextResponse.json(
        { error: "Please provide a valid round row to delete." },
        { status: 400 },
      );
    }

    try {
      const result = await deleteRoundAssignmentRow({
        assignmentId,
        roundBatchId,
      });

      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return NextResponse.json(
        { error: `The round row could not be deleted. ${message}` },
        { status: 400 },
      );
    }
  }

  if (businessId === undefined || businessId === null || direction === null) {
    return NextResponse.json(
      {
        error:
          "Please provide a valid business, direction, and optional counterpart business.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await updateRoundAssignment({
      businessId,
      counterpartBusinessId: counterpartBusinessId ?? null,
      direction,
      roundBatchId,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: `The round draft could not be updated. ${message}` },
      { status: 400 },
    );
  }
}
