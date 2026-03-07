import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { formatDatabaseError, withDatabaseRetry } from "@/lib/prisma";

type UpdateBusinessRelationshipsPayload = {
  businessId?: unknown;
  publishedByIds?: unknown;
  publishedForIds?: unknown;
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

export async function PUT(request: Request) {
  let payload: UpdateBusinessRelationshipsPayload;

  try {
    payload = (await request.json()) as UpdateBusinessRelationshipsPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const businessId = parseNumericId(payload.businessId);
  const publishedByIds = parseNumericIdList(payload.publishedByIds);
  const publishedForIds = parseNumericIdList(payload.publishedForIds);

  if (
    businessId === null ||
    publishedByIds === null ||
    publishedForIds === null
  ) {
    return NextResponse.json(
      {
        error:
          "Please choose a valid business and valid related business selections.",
      },
      { status: 400 },
    );
  }

  if (
    publishedByIds.includes(businessId) ||
    publishedForIds.includes(businessId)
  ) {
    return NextResponse.json(
      { error: "A business cannot be published by or published for itself." },
      { status: 400 },
    );
  }

  try {
    const relatedBusinessIds = [
      ...new Set([...publishedByIds, ...publishedForIds]),
    ];
    const [business, relatedBusinesses] = await withDatabaseRetry((database) =>
      Promise.all([
        database.business.findUnique({
          where: { id: businessId },
          select: { business: true, id: true },
        }),
        relatedBusinessIds.length === 0
          ? Promise.resolve([])
          : database.business.findMany({
              where: {
                id: {
                  in: relatedBusinessIds,
                },
              },
              select: { business: true, id: true },
            }),
      ]),
    );

    if (!business) {
      return NextResponse.json(
        { error: "The selected business does not exist." },
        { status: 404 },
      );
    }

    if (relatedBusinesses.length !== relatedBusinessIds.length) {
      return NextResponse.json(
        { error: "One or more selected related businesses do not exist." },
        { status: 404 },
      );
    }

    const overlappingIds = publishedByIds.filter((candidateId) =>
      publishedForIds.includes(candidateId),
    );

    if (overlappingIds.length > 0) {
      const businessNamesById = new Map(
        relatedBusinesses.map(
          (relatedBusiness) =>
            [relatedBusiness.id, relatedBusiness.business] as const,
        ),
      );
      const overlappingNames = overlappingIds.map(
        (overlappingId) =>
          businessNamesById.get(overlappingId) ?? `Business ${overlappingId}`,
      );

      return NextResponse.json(
        {
          error: `${overlappingNames.join(", ")} cannot appear in both Published By and Published For for ${business.business}.`,
        },
        { status: 409 },
      );
    }

    const summary = await withDatabaseRetry((database) =>
      database.$transaction(async (transaction) => {
        const existingPublishedFor = await transaction.match.findMany({
          where: { hostId: businessId },
          select: { guestId: true },
        });
        const existingPublishedBy = await transaction.match.findMany({
          where: { guestId: businessId },
          select: { hostId: true },
        });

        const currentPublishedForIds = new Set(
          existingPublishedFor.map((match) => match.guestId),
        );
        const currentPublishedByIds = new Set(
          existingPublishedBy.map((match) => match.hostId),
        );
        const desiredPublishedForIds = new Set(publishedForIds);
        const desiredPublishedByIds = new Set(publishedByIds);

        const publishedForIdsToCreate = publishedForIds.filter(
          (guestId) => !currentPublishedForIds.has(guestId),
        );
        const publishedByIdsToCreate = publishedByIds.filter(
          (hostId) => !currentPublishedByIds.has(hostId),
        );
        const publishedForIdsToDelete = [...currentPublishedForIds].filter(
          (guestId) => !desiredPublishedForIds.has(guestId),
        );
        const publishedByIdsToDelete = [...currentPublishedByIds].filter(
          (hostId) => !desiredPublishedByIds.has(hostId),
        );

        let createdCount = 0;
        let deletedCount = 0;

        if (publishedForIdsToDelete.length > 0) {
          const result = await transaction.match.deleteMany({
            where: {
              guestId: {
                in: publishedForIdsToDelete,
              },
              hostId: businessId,
            },
          });

          deletedCount += result.count;
        }

        if (publishedByIdsToDelete.length > 0) {
          const result = await transaction.match.deleteMany({
            where: {
              guestId: businessId,
              hostId: {
                in: publishedByIdsToDelete,
              },
            },
          });

          deletedCount += result.count;
        }

        if (publishedForIdsToCreate.length > 0) {
          const result = await transaction.match.createMany({
            data: publishedForIdsToCreate.map((guestId) => ({
              guestId,
              hostId: businessId,
            })),
            skipDuplicates: true,
          });

          createdCount += result.count;
        }

        if (publishedByIdsToCreate.length > 0) {
          const result = await transaction.match.createMany({
            data: publishedByIdsToCreate.map((hostId) => ({
              guestId: businessId,
              hostId,
            })),
            skipDuplicates: true,
          });

          createdCount += result.count;
        }

        return { createdCount, deletedCount };
      }),
    );

    const message =
      summary.createdCount === 0 && summary.deletedCount === 0
        ? `No relationship changes were needed for ${business.business}.`
        : `Updated ${business.business}: added ${summary.createdCount} relationship${summary.createdCount === 1 ? "" : "s"} and removed ${summary.deletedCount} relationship${summary.deletedCount === 1 ? "" : "s"}.`;

    return NextResponse.json({ message }, { status: 200 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "One or more relationship pairs already exist." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: `The business relationships could not be updated. ${formatDatabaseError(error)}`,
      },
      { status: 500 },
    );
  }
}
