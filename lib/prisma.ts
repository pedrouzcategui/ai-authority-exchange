import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

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
  adapter = new PrismaPg({
    connectionString,
  });

  prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export { prisma };

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaAdapter = adapter;
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaFingerprint = schemaFingerprint;
}
