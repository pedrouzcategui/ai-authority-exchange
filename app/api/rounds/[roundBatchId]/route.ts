import { NextResponse } from "next/server";
import { requireAuthSession } from "@/lib/auth-session";
import {
  applyRoundBatch,
  clearRoundBatch,
  deleteRoundBatch,
  generateRoundDraftForBatch,
} from "@/lib/rounds";
import { getUserRoleForSessionUser, isAdminRole } from "@/lib/user-role";

type RouteContext = {
  params: Promise<{
    roundBatchId: string;
  }>;
};

type ApplyRoundPayload = {
  action?: unknown;
};

function parseNumericId(value: string) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { roundBatchId: rawRoundBatchId } = await context.params;
  const roundBatchId = parseNumericId(rawRoundBatchId);

  if (roundBatchId === null) {
    return NextResponse.json(
      { error: "The selected round draft is invalid." },
      { status: 400 },
    );
  }

  let payload: ApplyRoundPayload;

  try {
    payload = (await request.json()) as ApplyRoundPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  if (
    payload.action !== "generate" &&
    payload.action !== "apply" &&
    payload.action !== "clear" &&
    payload.action !== "delete"
  ) {
    return NextResponse.json(
      { error: "Unsupported round action." },
      { status: 400 },
    );
  }

  const role = await getUserRoleForSessionUser(session.user);

  if (
    (payload.action === "clear" || payload.action === "delete") &&
    !isAdminRole(role)
  ) {
    return NextResponse.json(
      { error: "Only admins can clear or delete rounds." },
      { status: 403 },
    );
  }

  try {
    if (payload.action === "delete") {
      const result = await deleteRoundBatch(roundBatchId);

      return NextResponse.json({
        message:
          result.deletedMatchCount > 0
            ? `Round ${result.roundSequenceNumber} was deleted along with ${result.deletedMatchCount} linked match${result.deletedMatchCount === 1 ? "" : "es"}.`
            : `Round ${result.roundSequenceNumber} was deleted.`,
      });
    }

    if (payload.action === "clear") {
      const result = await clearRoundBatch(roundBatchId);

      return NextResponse.json({
        message:
          result.clearedCount === 0
            ? `Round ${result.roundSequenceNumber} was already empty.`
            : `Round ${result.roundSequenceNumber} was cleared of ${result.clearedCount} directed assignment${result.clearedCount === 1 ? "" : "s"}.`,
      });
    }

    if (payload.action === "generate") {
      const result = await generateRoundDraftForBatch(roundBatchId);

      return NextResponse.json({
        message:
          result.assignmentCount === 0
            ? `Round ${result.sequenceNumber} was generated, but no suggested assignments were available.`
            : `Round ${result.sequenceNumber} was generated with ${result.assignmentCount} directed assignment${result.assignmentCount === 1 ? "" : "s"}.`,
      });
    }

    const result = await applyRoundBatch(roundBatchId);

    return NextResponse.json({
      message: `Round ${result.roundSequenceNumber} was applied with ${result.appliedCount} finalized match${result.appliedCount === 1 ? "" : "es"}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const actionLabel =
      payload.action === "delete"
        ? "deleted"
        : payload.action === "generate"
          ? "generated"
          : payload.action === "clear"
            ? "cleared"
            : "applied";

    return NextResponse.json(
      { error: `The round could not be ${actionLabel}. ${message}` },
      { status: 400 },
    );
  }
}
