import { NextResponse } from "next/server";
import { type BusinessContactRoleType } from "@/generated/prisma/client";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

type UpdateContactBusinessesPayload = {
  businessIds?: unknown;
};

function parseNumericId(value: string) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function normalizeBusinessIds(value: unknown) {
  if (!Array.isArray(value)) {
    return { isValid: false, value: [] } as const;
  }

  const businessIds: number[] = [];
  const seenIds = new Set<number>();

  for (const item of value) {
    const parsedValue =
      typeof item === "number"
        ? item
        : typeof item === "string"
          ? Number.parseInt(item, 10)
          : Number.NaN;

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      return { isValid: false, value: [] } as const;
    }

    if (!seenIds.has(parsedValue)) {
      seenIds.add(parsedValue);
      businessIds.push(parsedValue);
    }
  }

  return { isValid: true, value: businessIds } as const;
}

function getConflictMessage(
  role: BusinessContactRoleType,
  conflictingBusinesses: Array<{ business: string }>,
) {
  const roleLabel = role === "marketer" ? "marketer" : "expert";
  const businessList = conflictingBusinesses
    .map((business) => business.business)
    .join(", ");

  return conflictingBusinesses.length === 1
    ? `${businessList} already has a ${roleLabel} assigned.`
    : `These businesses already have a ${roleLabel} assigned: ${businessList}.`;
}

function getSuccessMessage(role: BusinessContactRoleType, businessCount: number) {
  const roleLabel = role === "marketer" ? "Marketer" : "Expert";

  return businessCount === 0
    ? `${roleLabel} business assignments cleared.`
    : `${roleLabel} assigned to ${businessCount} business${businessCount === 1 ? "" : "es"}.`;
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { contactId: rawContactId } = await context.params;
  const contactId = parseNumericId(rawContactId);

  if (contactId === null) {
    return NextResponse.json(
      { error: "The selected contact is invalid." },
      { status: 400 },
    );
  }

  let payload: UpdateContactBusinessesPayload;

  try {
    payload = (await request.json()) as UpdateContactBusinessesPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const businessIds = normalizeBusinessIds(payload.businessIds);

  if (!businessIds.isValid) {
    return NextResponse.json(
      { error: "Please provide a valid list of business ids." },
      { status: 400 },
    );
  }

  const contact = await prisma.businessContact.findUnique({
    select: {
      id: true,
      role: true,
    },
    where: {
      id: contactId,
    },
  });

  if (!contact) {
    return NextResponse.json(
      { error: "The selected contact does not exist." },
      { status: 404 },
    );
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const selectedBusinesses =
        businessIds.value.length === 0
          ? []
          : await transaction.business.findMany({
              select:
                contact.role === "marketer"
                  ? {
                      business: true,
                      id: true,
                      marketerContactId: true,
                    }
                  : {
                      business: true,
                      expertContactId: true,
                      id: true,
                    },
              where: {
                id: {
                  in: businessIds.value,
                },
              },
            });

      if (selectedBusinesses.length !== businessIds.value.length) {
        throw new Error("One or more selected businesses do not exist.");
      }

      const conflictingBusinesses = selectedBusinesses.filter((business) =>
        contact.role === "marketer"
          ? business.marketerContactId !== null &&
            business.marketerContactId !== contactId
          : business.expertContactId !== null &&
            business.expertContactId !== contactId,
      );

      if (conflictingBusinesses.length > 0) {
        throw new Error(getConflictMessage(contact.role, conflictingBusinesses));
      }

      if (contact.role === "marketer") {
        await transaction.business.updateMany({
          data: {
            marketerContactId: null,
            marketerRole: null,
          },
          where: {
            ...(businessIds.value.length > 0
              ? {
                  id: {
                    notIn: businessIds.value,
                  },
                }
              : {}),
            marketerContactId: contactId,
            marketerRole: "marketer",
          },
        });

        if (businessIds.value.length > 0) {
          await transaction.business.updateMany({
            data: {
              marketerContactId: contactId,
              marketerRole: "marketer",
            },
            where: {
              id: {
                in: businessIds.value,
              },
            },
          });
        }
      } else {
        await transaction.business.updateMany({
          data: {
            expertContactId: null,
            expertRole: null,
          },
          where: {
            ...(businessIds.value.length > 0
              ? {
                  id: {
                    notIn: businessIds.value,
                  },
                }
              : {}),
            expertContactId: contactId,
            expertRole: "expert",
          },
        });

        if (businessIds.value.length > 0) {
          await transaction.business.updateMany({
            data: {
              expertContactId: contactId,
              expertRole: "expert",
            },
            where: {
              id: {
                in: businessIds.value,
              },
            },
          });
        }
      }
    });

    return NextResponse.json({
      message: getSuccessMessage(contact.role, businessIds.value.length),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      error instanceof Error &&
      (message.includes("already has") ||
        message.includes("already have") ||
        message.includes("do not exist"))
        ? 409
        : 500;

    return NextResponse.json(
      { error: `The business assignments could not be updated. ${message}` },
      { status },
    );
  }
}