import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type CreateMatchPayload = {
  hostId?: unknown;
  guestId?: unknown;
  guestIds?: unknown;
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

  if (hostId === null || guestIds === null || guestIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "Please choose one publisher and at least one published-for business.",
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

  const [host, guests] = await Promise.all([
    prisma.business.findUnique({
      where: { id: hostId },
      select: { id: true, business: true },
    }),
    prisma.business.findMany({
      where: {
        id: {
          in: guestIds,
        },
      },
      select: { id: true, business: true },
    }),
  ]);

  if (!host || guests.length !== guestIds.length) {
    return NextResponse.json(
      { error: "One or both selected businesses do not exist." },
      { status: 404 },
    );
  }

  const guestsById = new Map(guests.map((guest) => [guest.id, guest] as const));
  const orderedGuestNames = guestIds
    .map((guestId) => guestsById.get(guestId)?.business)
    .filter(
      (guestBusiness): guestBusiness is string => guestBusiness !== undefined,
    );

  try {
    const creationResult = await prisma.match.createMany({
      data: guestIds.map((guestId) => ({
        hostId,
        guestId,
      })),
      skipDuplicates: true,
    });

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
      { error: "The match could not be saved." },
      { status: 500 },
    );
  }
}
