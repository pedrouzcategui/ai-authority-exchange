import { NextResponse } from "next/server";
import { Prisma, type MatchStatus } from "@/generated/prisma/client";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { formatDatabaseError, withDatabaseRetry } from "@/lib/prisma";

type CreateMatchPayload = {
  status?: unknown;
  hostId?: unknown;
  guestId?: unknown;
  guestIds?: unknown;
};

type UpdateMatchPayload = {
  businessId?: unknown;
  counterpartRole?: unknown;
  interviewPublished?: unknown;
  interviewSent?: unknown;
  matchId?: unknown;
  roundBatchId?: unknown;
  status?: unknown;
};

const invalidOptionalNumericId = Symbol("invalidOptionalNumericId");

const roundNotFoundErrorMessage = "The selected round does not exist.";
const roundConflictErrorMessage =
  "That round already uses one of these businesses in a different pairing.";

const matchStatusValues: MatchStatus[] = [
  "Not_Started",
  "In_Progress",
  "Done",
  "Leaving",
  "Partner_Leaving",
];

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

function parseOptionalNumericId(
  value: unknown,
): number | null | undefined | typeof invalidOptionalNumericId {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const parsedValue = parseNumericId(value);
  return parsedValue === null ? invalidOptionalNumericId : parsedValue;
}

function parseOptionalBoolean(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function parseMatchStatus(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return typeof value === "string" &&
    matchStatusValues.includes(value as MatchStatus)
    ? (value as MatchStatus)
    : null;
}

function parseCounterpartRole(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return value === "guest" || value === "host" ? value : null;
}

function parseNumericIdList(value: unknown) {
  if (value === undefined) {
    return [];
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const parsedValues: number[] = [];

  for (const rawValue of rawValues) {
    const parsedValue = parseNumericId(rawValue);

    if (parsedValue === null) {
      return null;
    }

    parsedValues.push(parsedValue);
  }

  return [...new Set(parsedValues)];
}

export async function POST(request: Request) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: CreateMatchPayload;

  try {
    payload = (await request.json()) as CreateMatchPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const hostId = parseNumericId(payload.hostId);
  const guestIds =
    payload.guestIds !== undefined
      ? parseNumericIdList(payload.guestIds)
      : parseNumericIdList(payload.guestId);
  const status = parseMatchStatus(payload.status);

  if (
    hostId === null ||
    guestIds === null ||
    guestIds.length === 0 ||
    status === null
  ) {
    return NextResponse.json(
      {
        error:
          "Please choose one publisher, at least one published-for business, and a valid status.",
      },
      { status: 400 },
    );
  }

  if (guestIds.includes(hostId)) {
    return NextResponse.json(
      {
        error: "The publisher and published-for businesses must be different.",
      },
      { status: 400 },
    );
  }

  try {
    const [host, guests, reverseMatches] = await withDatabaseRetry((database) =>
      Promise.all([
        database.business.findUnique({
          where: { id: hostId },
          select: { id: true, business: true },
        }),
        database.business.findMany({
          where: {
            id: {
              in: guestIds,
            },
          },
          select: { id: true, business: true },
        }),
        database.match.findMany({
          where: {
            OR: guestIds.map((guestId) => ({
              guestId: hostId,
              hostId: guestId,
            })),
          },
          select: {
            host: {
              select: { business: true, id: true },
            },
            guest: {
              select: { business: true, id: true },
            },
          },
        }),
      ]),
    );

    if (!host || guests.length !== guestIds.length) {
      return NextResponse.json(
        { error: "One or both selected businesses do not exist." },
        { status: 404 },
      );
    }

    if (reverseMatches.length > 0) {
      const blockedPairs = reverseMatches.map(
        (match) =>
          `${match.host.business} already publishes for ${match.guest.business}`,
      );

      return NextResponse.json(
        {
          error: `These reciprocal relationships are not allowed: ${blockedPairs.join("; ")}.`,
        },
        { status: 409 },
      );
    }

    const guestsById = new Map(
      guests.map((guest) => [guest.id, guest] as const),
    );
    const orderedGuestNames = guestIds
      .map((guestId) => guestsById.get(guestId)?.business)
      .filter(
        (guestBusiness): guestBusiness is string => guestBusiness !== undefined,
      );

    const creationResult = await withDatabaseRetry((database) =>
      database.match.createMany({
        data: guestIds.map((guestId) => ({
          hostId,
          guestId,
          ...(status === undefined ? {} : { status }),
        })),
        skipDuplicates: true,
      }),
    );

    if (creationResult.count === 0) {
      return NextResponse.json(
        {
          error:
            "All selected publisher and published-for pairs already exist.",
        },
        { status: 409 },
      );
    }

    const skippedCount = guestIds.length - creationResult.count;

    if (guestIds.length === 1) {
      return NextResponse.json(
        {
          message: `Match created successfully: ${host.business} published for ${orderedGuestNames[0]}.`,
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      {
        message:
          skippedCount > 0
            ? `Created ${creationResult.count} of ${guestIds.length} matches for ${host.business}. ${skippedCount} pair${skippedCount === 1 ? " was" : "s were"} already saved.`
            : `Created ${creationResult.count} matches for ${host.business}: ${orderedGuestNames.join(", ")}.`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "One or more selected publisher and published-for pairs already exist.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: `The match could not be saved. ${formatDatabaseError(error)}` },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: UpdateMatchPayload;

  try {
    payload = (await request.json()) as UpdateMatchPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const matchId = parseNumericId(payload.matchId);
  const businessId = parseOptionalNumericId(payload.businessId);
  const counterpartRole = parseCounterpartRole(payload.counterpartRole);
  const interviewSent = parseOptionalBoolean(payload.interviewSent);
  const interviewPublished = parseOptionalBoolean(payload.interviewPublished);
  const roundBatchId = parseOptionalNumericId(payload.roundBatchId);
  const status = parseMatchStatus(payload.status);

  if (
    matchId === null ||
    businessId === invalidOptionalNumericId ||
    counterpartRole === null ||
    interviewSent === null ||
    interviewPublished === null ||
    roundBatchId === invalidOptionalNumericId ||
    status === null
  ) {
    return NextResponse.json(
      {
        error:
          "Please provide a valid match id, round, status, and boolean interview values.",
      },
      { status: 400 },
    );
  }

  if (
    (counterpartRole !== undefined &&
      (businessId === undefined || businessId === null)) ||
    (interviewSent === undefined &&
      interviewPublished === undefined &&
      status === undefined &&
      counterpartRole === undefined &&
      roundBatchId === undefined)
  ) {
    return NextResponse.json(
      { error: "No match updates were provided." },
      { status: 400 },
    );
  }

  try {
    const updatedMatch = await withDatabaseRetry(async (database) => {
      const existingMatch = await database.match.findUnique({
        select: {
          guestId: true,
          hostId: true,
          id: true,
          roundBatchId: true,
        },
        where: {
          id: matchId,
        },
      });

      if (!existingMatch) {
        throw new Prisma.PrismaClientKnownRequestError(
          "The selected match does not exist.",
          {
            clientVersion: Prisma.prismaVersion.client,
            code: "P2025",
          },
        );
      }

      let nextHostId = existingMatch.hostId;
      let nextGuestId = existingMatch.guestId;
      const nextRoundBatchId =
        roundBatchId === undefined ? existingMatch.roundBatchId : roundBatchId;
      const shouldSyncRoundAssignment =
        roundBatchId !== undefined || counterpartRole !== undefined;

      if (counterpartRole !== undefined) {
        if (
          businessId === undefined ||
          businessId === null ||
          (existingMatch.hostId !== businessId &&
            existingMatch.guestId !== businessId)
        ) {
          return null;
        }

        const counterpartId =
          existingMatch.hostId === businessId
            ? existingMatch.guestId
            : existingMatch.hostId;

        if (counterpartRole === "guest") {
          nextHostId = businessId;
          nextGuestId = counterpartId;
        } else {
          nextHostId = counterpartId;
          nextGuestId = businessId;
        }

        if (
          (nextHostId !== existingMatch.hostId ||
            nextGuestId !== existingMatch.guestId) &&
          (await database.match.findFirst({
            select: { id: true },
            where: {
              guestId: nextGuestId,
              hostId: nextHostId,
              id: {
                not: matchId,
              },
            },
          }))
        ) {
          throw new Prisma.PrismaClientKnownRequestError(
            "A match with that orientation already exists.",
            {
              clientVersion: Prisma.prismaVersion.client,
              code: "P2002",
            },
          );
        }
      }

      const previousAssignment = !shouldSyncRoundAssignment ||
        existingMatch.roundBatchId === null
          ? null
          : await database.roundAssignment.findFirst({
              select: {
                id: true,
              },
              where: {
                guestBusinessId: existingMatch.guestId,
                hostBusinessId: existingMatch.hostId,
                roundBatchId: existingMatch.roundBatchId,
              },
            });

      let targetPairAssignment: { id: number } | null = null;

      if (shouldSyncRoundAssignment && nextRoundBatchId !== null) {
        const targetBatch = await database.roundBatch.findUnique({
          select: {
            id: true,
          },
          where: {
            id: nextRoundBatchId,
          },
        });

        if (!targetBatch) {
          throw new Error(roundNotFoundErrorMessage);
        }

        targetPairAssignment = await database.roundAssignment.findFirst({
          select: {
            id: true,
          },
          where: {
            guestBusinessId: nextGuestId,
            hostBusinessId: nextHostId,
            roundBatchId: nextRoundBatchId,
          },
        });

        const excludedAssignmentIds = [
          previousAssignment?.id,
          targetPairAssignment?.id,
        ].filter((assignmentId): assignmentId is number => assignmentId !== undefined);

        const [hostConflict, guestConflict] = await Promise.all([
          database.roundAssignment.findFirst({
            select: {
              id: true,
            },
            where: {
              hostBusinessId: nextHostId,
              id:
                excludedAssignmentIds.length === 0
                  ? undefined
                  : {
                      notIn: excludedAssignmentIds,
                    },
              roundBatchId: nextRoundBatchId,
            },
          }),
          database.roundAssignment.findFirst({
            select: {
              id: true,
            },
            where: {
              guestBusinessId: nextGuestId,
              id:
                excludedAssignmentIds.length === 0
                  ? undefined
                  : {
                      notIn: excludedAssignmentIds,
                    },
              roundBatchId: nextRoundBatchId,
            },
          }),
        ]);

        if (hostConflict || guestConflict) {
          throw new Error(roundConflictErrorMessage);
        }
      }

      const updatedMatch = await database.match.update({
        data: {
          ...(interviewSent === undefined
            ? {}
            : { interview_sent: interviewSent }),
          ...(interviewPublished === undefined
            ? {}
            : { interview_published: interviewPublished }),
          ...(roundBatchId === undefined
            ? {}
            : { roundBatchId: nextRoundBatchId }),
          ...(status === undefined ? {} : { status }),
          ...(nextHostId === existingMatch.hostId ? {} : { hostId: nextHostId }),
          ...(nextGuestId === existingMatch.guestId
            ? {}
            : { guestId: nextGuestId }),
        },
        select: {
          guestId: true,
          hostId: true,
          id: true,
          interview_published: true,
          interview_sent: true,
          roundBatch: {
            select: {
              id: true,
              sequenceNumber: true,
              status: true,
            },
          },
          roundBatchId: true,
          status: true,
        },
        where: {
          id: matchId,
        },
      });

      const roundAssignmentNeedsSync =
        existingMatch.roundBatchId !== nextRoundBatchId ||
        existingMatch.hostId !== nextHostId ||
        existingMatch.guestId !== nextGuestId;

      if (
        shouldSyncRoundAssignment &&
        previousAssignment &&
        (nextRoundBatchId === null || roundAssignmentNeedsSync)
      ) {
        await database.roundAssignment.delete({
          where: {
            id: previousAssignment.id,
          },
        });
      }

      if (shouldSyncRoundAssignment && nextRoundBatchId !== null) {
        if (targetPairAssignment) {
          await database.roundAssignment.update({
            data: {
              source: "manual",
            },
            where: {
              id: targetPairAssignment.id,
            },
          });
        } else {
          await database.roundAssignment.create({
            data: {
              guestBusinessId: nextGuestId,
              hostBusinessId: nextHostId,
              roundBatchId: nextRoundBatchId,
              source: "manual",
            },
          });
        }
      }

      return updatedMatch;
    });

    if (updatedMatch === null) {
      return NextResponse.json(
        {
          error: "The selected business is not part of this match.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        match: {
          counterpartRole:
            businessId === undefined || businessId === null
              ? undefined
              : updatedMatch.hostId === businessId
                ? "guest"
                : "host",
          id: updatedMatch.id,
          interviewPublished: updatedMatch.interview_published ?? false,
          interviewSent: updatedMatch.interview_sent ?? false,
          roundBatchId: updatedMatch.roundBatchId,
          roundSequenceNumber: updatedMatch.roundBatch?.sequenceNumber ?? null,
          roundStatus: updatedMatch.roundBatch?.status ?? null,
          status: updatedMatch.status,
        },
        message: "Match updated successfully.",
      },
      { status: 200 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "The selected match does not exist." },
        { status: 404 },
      );
    }


    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "That company role change would duplicate an existing match orientation.",
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === roundNotFoundErrorMessage) {
      return NextResponse.json(
        { error: roundNotFoundErrorMessage },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === roundConflictErrorMessage) {
      return NextResponse.json(
        { error: roundConflictErrorMessage },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: `The match could not be updated. ${formatDatabaseError(error)}`,
      },
      { status: 500 },
    );
  }
}
