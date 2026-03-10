import { NextResponse } from "next/server";
import { Prisma, type BusinessRoleType } from "@/generated/prisma/client";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

type CreateBusinessPayload = {
  name?: unknown;
  role?: unknown;
  websiteUrl?: unknown;
};

type UpdateBusinessPayload = CreateBusinessPayload & {
  businessId?: unknown;
};

const hasProtocolPattern = /^[a-z][a-z\d+.-]*:\/\//i;

function formatErrorDetails(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const metaDetails = error.meta
      ? ` Meta: ${JSON.stringify(error.meta)}.`
      : "";
    return `Prisma error ${error.code}: ${error.message}.${metaDetails}`;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeWebsiteUrl(value: unknown) {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    return null;
  }

  const candidateUrl = hasProtocolPattern.test(normalizedValue)
    ? normalizedValue
    : `https://${normalizedValue}`;

  try {
    const parsedUrl = new URL(candidateUrl);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function normalizeRole(value: unknown): BusinessRoleType | null {
  if (value === "client" || value === "partner") {
    return value;
  }

  return null;
}

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

export async function POST(request: Request) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: CreateBusinessPayload;

  try {
    payload = (await request.json()) as CreateBusinessPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const name = normalizeString(payload.name);
  const role = normalizeRole(payload.role);
  const websiteUrl = normalizeWebsiteUrl(payload.websiteUrl);

  if (!name || !websiteUrl || !role) {
    return NextResponse.json(
      {
        error:
          "Please provide a business name, a valid website URL, and a role.",
      },
      { status: 400 },
    );
  }

  try {
    const [business] = await prisma.$queryRaw<
      Array<{ business: string; id: number }>
    >(
      Prisma.sql`
        INSERT INTO businesses (name, website_url, role)
        VALUES (${name}, ${websiteUrl}, ${role}::business_role_type)
        RETURNING id, name AS business
      `,
    );

    if (!business) {
      throw new Error(
        "The database insert completed without returning the new business.",
      );
    }

    return NextResponse.json(
      {
        business,
        message: `${business.business} was added successfully as a ${role}.`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A business with that name already exists." },
        { status: 409 },
      );
    }

    const errorDetails = formatErrorDetails(error);

    return NextResponse.json(
      { error: `The business could not be created. ${errorDetails}` },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: UpdateBusinessPayload;

  try {
    payload = (await request.json()) as UpdateBusinessPayload;
  } catch {
    return NextResponse.json(
      { error: "The request body could not be parsed." },
      { status: 400 },
    );
  }

  const businessId = parseNumericId(payload.businessId);
  const name = normalizeString(payload.name);
  const role = normalizeRole(payload.role);
  const websiteUrl = normalizeWebsiteUrl(payload.websiteUrl);

  if (businessId === null || !name || !role || !websiteUrl) {
    return NextResponse.json(
      {
        error:
          "Please provide a valid business, business name, website URL, and role.",
      },
      { status: 400 },
    );
  }

  try {
    const [business] = await prisma.$queryRaw<
      Array<{ business: string; id: number }>
    >(
      Prisma.sql`
        UPDATE businesses
        SET name = ${name},
            website_url = ${websiteUrl},
            role = ${role}::business_role_type
        WHERE id = ${businessId}
        RETURNING id, name AS business
      `,
    );

    if (!business) {
      return NextResponse.json(
        { error: "The selected business does not exist." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        business,
        message: `${business.business} was updated successfully.`,
      },
      { status: 200 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A business with that name already exists." },
        { status: 409 },
      );
    }

    const errorDetails = formatErrorDetails(error);

    return NextResponse.json(
      { error: `The business could not be updated. ${errorDetails}` },
      { status: 500 },
    );
  }
}
