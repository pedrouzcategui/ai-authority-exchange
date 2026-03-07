import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const schemaFingerprint = createHash("sha1")
  .update(readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8"))
  .digest("hex");

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const globalForPrisma = globalThis as typeof globalThis & {
  prismaAdapter?: PrismaPg;
  prisma?: PrismaClient;
  prismaSchemaFingerprint?: string;
};

function createPrismaClient() {
  const nextAdapter = new PrismaPg({
    connectionString,
  });

  const nextPrisma = new PrismaClient({
    adapter: nextAdapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return { nextAdapter, nextPrisma };
}

function syncGlobalPrismaState(
  nextAdapter: PrismaPg,
  nextPrisma: PrismaClient,
) {
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaAdapter = nextAdapter;
    globalForPrisma.prisma = nextPrisma;
    globalForPrisma.prismaSchemaFingerprint = schemaFingerprint;
  }
}

const shouldReuseCachedClient =
  globalForPrisma.prisma !== undefined &&
  globalForPrisma.prismaAdapter !== undefined &&
  globalForPrisma.prismaSchemaFingerprint === schemaFingerprint;

let adapter: PrismaPg;
let prisma: PrismaClient;

if (shouldReuseCachedClient) {
  adapter = globalForPrisma.prismaAdapter!;
  prisma = globalForPrisma.prisma!;
} else {
  const { nextAdapter, nextPrisma } = createPrismaClient();

  adapter = nextAdapter;
  prisma = nextPrisma;
}

syncGlobalPrismaState(adapter, prisma);

function isRetryableDatabaseError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /can't reach database server|econnreset|econnrefused|connection terminated unexpectedly|server closed the connection unexpectedly|timed out/i.test(
    error.message,
  );
}

function formatDatabaseError(error: unknown) {
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

async function resetPrismaClient() {
  await prisma.$disconnect().catch(() => undefined);

  const { nextAdapter, nextPrisma } = createPrismaClient();

  adapter = nextAdapter;
  prisma = nextPrisma;
  syncGlobalPrismaState(adapter, prisma);

  return prisma;
}

async function withDatabaseRetry<T>(
  operation: (database: PrismaClient) => Promise<T>,
) {
  try {
    return await operation(prisma);
  } catch (error) {
    if (!isRetryableDatabaseError(error)) {
      throw error;
    }

    const nextPrisma = await resetPrismaClient();
    return operation(nextPrisma);
  }
}

export { formatDatabaseError, prisma, withDatabaseRetry };
