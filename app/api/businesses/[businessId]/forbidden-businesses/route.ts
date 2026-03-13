import { NextResponse } from "next/server";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { replaceForbiddenBusinessesForBusiness } from "@/lib/forbidden-business-pairs";
import { formatDatabaseError, withDatabaseRetry } from "@/lib/prisma";

type UpdateForbiddenBusinessesPayload = {
  forbiddenBusinessIds?: unknown;
};

function parsePositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number.parseInt(value, 10);

    if (Number.isInteger(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  return null;
}

function parsePositiveIntegerList(value: unknown) {
  if (value === undefined) {
    return [];
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const parsedValues: number[] = [];

  for (const rawValue of rawValues) {
    const parsedValue = parsePositiveInteger(rawValue);

    if (parsedValue === null) {
      return null;
    }

    parsedValues.push(parsedValue);
  }

  return [...new Set(parsedValues)];
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const resolvedParams = await params;
  const businessId = parsePositiveInteger(resolvedParams.businessId);

  let payload: UpdateForbiddenBusinessesPayload;

  try {
    payload = (await request.json()) as UpdateForbiddenBusinessesPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const forbiddenBusinessIds = parsePositiveIntegerList(
    payload.forbiddenBusinessIds,
  );

  if (businessId === null || forbiddenBusinessIds === null) {
    return NextResponse.json(
      {
        error:
          "Please choose a valid business and valid forbidden competitor selections.",
      },
      { status: 400 },
    );
  }

  if (forbiddenBusinessIds.includes(businessId)) {
    return NextResponse.json(
      {
        error:
          "A business cannot be marked as a forbidden competitor for itself.",
      },
      { status: 400 },
    );
  }

  try {
    const [business, relatedBusinesses] = await withDatabaseRetry((database) =>
      Promise.all([
        database.business.findUnique({
          where: { id: businessId },
          select: { business: true, id: true },
        }),
        forbiddenBusinessIds.length === 0
          ? Promise.resolve([])
          : database.business.findMany({
              where: {
                id: {
                  in: forbiddenBusinessIds,
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

    if (relatedBusinesses.length !== forbiddenBusinessIds.length) {
      return NextResponse.json(
        { error: "One or more selected forbidden competitors do not exist." },
        { status: 404 },
      );
    }

    await withDatabaseRetry((database) =>
      database.$transaction(async (transaction) => {
        await replaceForbiddenBusinessesForBusiness(
          {
            businessId,
            forbiddenBusinessIds,
          },
          transaction,
        );
      }),
    );

    const message =
      forbiddenBusinessIds.length === 0
        ? `Cleared forbidden competitors for ${business.business}.`
        : `Updated forbidden competitors for ${business.business}.`;

    return NextResponse.json({ message }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: `The forbidden competitors could not be updated. ${formatDatabaseError(error)}`,
      },
      { status: 500 },
    );
  }
}