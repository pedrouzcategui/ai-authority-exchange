import { NextResponse } from "next/server";
import {
  Prisma,
  type BusinessContactRoleType,
} from "@/generated/prisma/client";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

type UpdateBusinessContactPayload = {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  role?: unknown;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseNumericId(value: string) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function normalizeRole(value: unknown): BusinessContactRoleType | null {
  if (value === "marketer" || value === "expert") {
    return value;
  }

  return null;
}

function normalizeRequiredText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeRequiredEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim().toLocaleLowerCase();

  if (!trimmedValue || !emailPattern.test(trimmedValue)) {
    return null;
  }

  return trimmedValue;
}

function buildFullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

export async function PATCH(request: Request, context: RouteContext) {
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

  let payload: UpdateBusinessContactPayload;

  try {
    payload = (await request.json()) as UpdateBusinessContactPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const firstName = normalizeRequiredText(payload.firstName);
  const lastName = normalizeRequiredText(payload.lastName);
  const email = normalizeRequiredEmail(payload.email);
  const role = normalizeRole(payload.role);

  if (!firstName || !lastName || !email || !role) {
    return NextResponse.json(
      {
        error:
          "Please provide the contact role, first name, last name, and a valid email address.",
      },
      { status: 400 },
    );
  }

  const contact = await prisma.businessContact.findUnique({
    select: {
      expertForBusinesses: {
        select: {
          id: true,
        },
      },
      id: true,
      marketerForBusinesses: {
        select: {
          id: true,
        },
      },
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

  const currentAssignments =
    contact.role === "marketer"
      ? contact.marketerForBusinesses
      : contact.expertForBusinesses;

  if (contact.role !== role && currentAssignments.length > 0) {
    return NextResponse.json(
      {
        error:
          "This contact is currently assigned to one or more businesses. Clear those assignments before changing the role.",
      },
      { status: 400 },
    );
  }

  try {
    await prisma.businessContact.update({
      data: {
        email,
        firstName,
        fullName: buildFullName(firstName, lastName),
        lastName,
        role,
      },
      where: {
        id: contactId,
      },
    });

    return NextResponse.json({
      message: "Contact updated successfully.",
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "A contact with that email already exists for that role.",
        },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: `The contact could not be updated. ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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

  const contact = await prisma.businessContact.findUnique({
    select: {
      expertForBusinesses: {
        select: {
          id: true,
        },
      },
      id: true,
      marketerForBusinesses: {
        select: {
          id: true,
        },
      },
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

  const assignedBusinesses =
    contact.role === "marketer"
      ? contact.marketerForBusinesses
      : contact.expertForBusinesses;

  try {
    await prisma.$transaction(async (transaction) => {
      if (contact.role === "marketer") {
        await transaction.business.updateMany({
          data: {
            marketerContactId: null,
            marketerRole: null,
          },
          where: {
            marketerContactId: contactId,
            marketerRole: "marketer",
          },
        });
      } else {
        await transaction.business.updateMany({
          data: {
            expertContactId: null,
            expertRole: null,
          },
          where: {
            expertContactId: contactId,
            expertRole: "expert",
          },
        });
      }

      await transaction.businessContact.delete({
        where: {
          id: contactId,
        },
      });
    });

    return NextResponse.json({
      message:
        assignedBusinesses.length > 0
          ? `Contact deleted and cleared from ${assignedBusinesses.length} business${assignedBusinesses.length === 1 ? "" : "es"}.`
          : "Contact deleted successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: `The contact could not be deleted. ${message}` },
      { status: 500 },
    );
  }
}
