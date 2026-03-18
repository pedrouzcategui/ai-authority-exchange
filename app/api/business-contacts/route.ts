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

function normalizeOptionalText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { isValid: true, value: null } as const;
  }

  if (typeof value !== "string") {
    return { isValid: false, value: null } as const;
  }

  const trimmedValue = value.trim();

  return {
    isValid: true,
    value: trimmedValue.length > 0 ? trimmedValue : null,
  } as const;
}

function normalizeOptionalEmail(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { isValid: true, value: null } as const;
  }

  if (typeof value !== "string") {
    return { isValid: false, value: null } as const;
  }

  const trimmedValue = value.trim().toLocaleLowerCase();

  if (!trimmedValue) {
    return { isValid: true, value: null } as const;
  }

  if (!emailPattern.test(trimmedValue)) {
    return { isValid: false, value: null } as const;
  }

  return { isValid: true, value: trimmedValue } as const;
}

function buildFullName(firstName: string, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
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
  const lastName = normalizeOptionalText(payload.lastName);
  const email = normalizeOptionalEmail(payload.email);
  const role = normalizeRole(payload.role);

  if (!firstName || !role || !lastName.isValid || !email.isValid) {
    return NextResponse.json(
      {
        error:
          "Please provide the contact role and first name. If you include an email address, it must be valid.",
      },
      { status: 400 },
    );
  }

  try {
    const contact = await prisma.businessContact.create({
      data: {
        email: email.value,
        firstName,
        fullName: buildFullName(firstName, lastName.value),
        lastName: lastName.value,
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
