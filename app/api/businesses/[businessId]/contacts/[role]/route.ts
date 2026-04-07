import { NextResponse } from "next/server";
import type { BusinessContactRoleType } from "@/generated/prisma/client";
import { replaceBusinessRoleAssignments } from "@/lib/business-contact-assignments";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    businessId: string;
    role: string;
  }>;
};

type UpdateBusinessContactPayload = {
  contactIds?: unknown;
  selectedContactId?: unknown;
};

function parseNumericId(value: string) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function normalizeRole(value: string): BusinessContactRoleType | null {
  if (value === "marketer" || value === "expert") {
    return value;
  }

  return null;
}

function parseNullableNumericId(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function parseNumericIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const contactIds: number[] = [];
  const seenIds = new Set<number>();

  for (const item of value) {
    const parsedValue = parseNullableNumericId(item);

    if (parsedValue === null) {
      return null;
    }

    if (!seenIds.has(parsedValue)) {
      seenIds.add(parsedValue);
      contactIds.push(parsedValue);
    }
  }

  return contactIds;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { businessId: rawBusinessId, role: rawRole } = await context.params;
  const businessId = parseNumericId(rawBusinessId);
  const role = normalizeRole(rawRole);

  if (businessId === null || role === null) {
    return NextResponse.json(
      { error: "The selected business contact is invalid." },
      { status: 400 },
    );
  }

  let payload: UpdateBusinessContactPayload;

  try {
    payload = (await request.json()) as UpdateBusinessContactPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const hasContactIds = Object.prototype.hasOwnProperty.call(payload, "contactIds");
  const parsedContactIds = hasContactIds
    ? parseNumericIdList(payload.contactIds)
    : null;
  const selectedContactId = hasContactIds
    ? null
    : parseNullableNumericId(payload.selectedContactId);
  const contactIds =
    parsedContactIds ?? (selectedContactId === null ? [] : [selectedContactId]);

  const business = await prisma.business.findUnique({
    select: {
      business: true,
      id: true,
    },
    where: {
      id: businessId,
    },
  });

  if (!business) {
    return NextResponse.json(
      { error: "The selected business does not exist." },
      { status: 404 },
    );
  }

  if (
    (hasContactIds && parsedContactIds === null) ||
    (!hasContactIds && payload.selectedContactId !== null && selectedContactId === null)
  ) {
    return NextResponse.json(
      { error: "Please select one or more valid contacts." },
      { status: 400 },
    );
  }

  let selectedContacts: Array<{
    id: number;
    role: BusinessContactRoleType;
  }> = [];

  if (contactIds.length > 0) {
    selectedContacts = await prisma.businessContact.findMany({
      select: {
        id: true,
        role: true,
      },
      where: {
        id: {
          in: contactIds,
        },
      },
    });

    const hasInvalidContact =
      selectedContacts.length !== contactIds.length ||
      selectedContacts.some((contact) => contact.role !== role);

    if (hasInvalidContact) {
      return NextResponse.json(
        { error: `One or more selected ${role}s are invalid for this business.` },
        { status: 400 },
      );
    }
  }

  const legacySelectedContactId = contactIds[0] ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        data:
          role === "marketer"
            ? {
                marketerContactId: legacySelectedContactId,
                marketerRole:
                  legacySelectedContactId === null ? null : "marketer",
              }
            : {
                expertContactId: legacySelectedContactId,
                expertRole:
                  legacySelectedContactId === null ? null : "expert",
              },
        where: {
          id: businessId,
        },
      });

      await replaceBusinessRoleAssignments({
        businessId,
        contactIds,
        role,
        tx,
      });
    });

    return NextResponse.json({
      message:
        contactIds.length === 0
          ? `${business.business} ${role} cleared successfully.`
          : `${business.business} ${role} updated successfully.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: `The ${role} could not be updated. ${message}` },
      { status: 500 },
    );
  }
}
