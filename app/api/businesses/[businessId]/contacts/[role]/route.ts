import { NextResponse } from "next/server";
import type { BusinessContactRoleType } from "@/generated/prisma/client";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    businessId: string;
    role: string;
  }>;
};

type UpdateBusinessContactPayload = {
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

  const selectedContactId = parseNullableNumericId(payload.selectedContactId);

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

  if (payload.selectedContactId !== null && selectedContactId === null) {
    return NextResponse.json(
      { error: "Please select a valid contact." },
      { status: 400 },
    );
  }

  let selectedContact: {
    role: BusinessContactRoleType;
  } | null = null;

  if (selectedContactId !== null) {
    selectedContact = await prisma.businessContact.findUnique({
      select: {
        role: true,
      },
      where: {
        id: selectedContactId,
      },
    });

    if (!selectedContact || selectedContact.role !== role) {
      return NextResponse.json(
        { error: `The selected ${role} is invalid for this business.` },
        { status: 400 },
      );
    }
  }

  try {
    await prisma.business.update({
      data:
        role === "marketer"
          ? {
              marketerContactId: selectedContactId,
              marketerRole: selectedContactId === null ? null : "marketer",
            }
          : {
              expertContactId: selectedContactId,
              expertRole: selectedContactId === null ? null : "expert",
            },
      where: {
        id: businessId,
      },
    });

    return NextResponse.json({
      message:
        selectedContactId === null
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
