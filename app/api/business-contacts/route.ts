import { NextResponse } from "next/server";
import {
  Prisma,
  type BusinessContactRoleType,
} from "@/generated/prisma/client";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

type CreateBusinessContactPayload = {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  role?: unknown;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export async function POST(request: Request) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: CreateBusinessContactPayload;

  try {
    payload = (await request.json()) as CreateBusinessContactPayload;
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

  try {
    const contact = await prisma.businessContact.create({
      data: {
        email,
        firstName,
        fullName: buildFullName(firstName, lastName),
        lastName,
        role,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json(
      {
        contact,
        message: `${role === "marketer" ? "Marketer" : "Expert"} created successfully.`,
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
          error: "A contact with that email already exists for that role.",
        },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: `The contact could not be created. ${message}` },
      { status: 500 },
    );
  }
}
