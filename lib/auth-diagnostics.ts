import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const requiredAuthTables = [
  "auth_accounts",
  "auth_sessions",
  "auth_users",
  "auth_verification_tokens",
] as const;

type AuthDiagnosticRecord = {
  code: string;
  details: string;
  recordedAt: string;
};

const redactedKeys = new Set([
  "access_token",
  "accessToken",
  "authorization",
  "clientSecret",
  "cookie",
  "id_token",
  "idToken",
  "refresh_token",
  "refreshToken",
  "token",
]);

const globalForAuthDiagnostics = globalThis as typeof globalThis & {
  lastAuthDiagnostic?: AuthDiagnosticRecord;
};

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        redactedKeys.has(key) ? "[REDACTED]" : sanitizeValue(entryValue),
      ]),
    );
  }

  return value;
}

export function recordAuthDiagnostic(code: string, payload: unknown) {
  globalForAuthDiagnostics.lastAuthDiagnostic = {
    code,
    details: JSON.stringify(sanitizeValue(payload), null, 2),
    recordedAt: new Date().toISOString(),
  };
}

export function getLastAuthDiagnostic() {
  return globalForAuthDiagnostics.lastAuthDiagnostic ?? null;
}

export async function getMissingAuthTables() {
  const existingTables = await prisma.$queryRaw<Array<{ table_name: string }>>(
    Prisma.sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (${Prisma.join(requiredAuthTables)})
    `,
  );

  const existingTableSet = new Set(
    existingTables.map((table) => table.table_name),
  );

  return requiredAuthTables.filter(
    (tableName) => !existingTableSet.has(tableName),
  );
}
