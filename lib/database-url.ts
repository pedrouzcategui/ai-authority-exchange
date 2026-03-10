const SSL_MODE_ALIASES = new Set(["prefer", "require", "verify-ca"]);

function normalizePostgresSslMode(connectionString: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(connectionString);
  } catch {
    return connectionString;
  }

  if (
    parsedUrl.protocol !== "postgres:" &&
    parsedUrl.protocol !== "postgresql:"
  ) {
    return connectionString;
  }

  const sslMode = parsedUrl.searchParams.get("sslmode")?.toLowerCase();

  if (!sslMode || !SSL_MODE_ALIASES.has(sslMode)) {
    return connectionString;
  }

  parsedUrl.searchParams.set("sslmode", "verify-full");

  return parsedUrl.toString();
}

export function getNormalizedDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  return normalizePostgresSslMode(databaseUrl);
}