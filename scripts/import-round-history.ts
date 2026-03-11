import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type RoundBatchStatus,
} from "../generated/prisma/client";
import { getNormalizedDatabaseUrl } from "../lib/database-url";

type CliOptions = {
  activeColumn?: string;
  appliedAt?: string;
  companyNameColumn?: string;
  companyWebsiteColumn?: string;
  dryRun: boolean;
  filePath: string;
  publishedByColumn?: string;
  publishedByWebsiteColumn?: string;
  publishedForColumn?: string;
  publishedForWebsiteColumn?: string;
  roundSequenceNumber: number;
  status: RoundBatchStatus;
  statusColumn?: string;
};

type CsvRow = Record<string, string>;

type BusinessLookupRecord = {
  business: string;
  id: number;
  websiteUrl: string | null;
};

type BusinessReference = {
  label: string | null;
  websiteUrl: string | null;
};

type ImportedAssignment = {
  guestBusinessId: number;
  guestBusinessName: string;
  hostBusinessId: number;
  hostBusinessName: string;
};

type HeaderMap = Map<string, string>;

function printHelp() {
  console.log(`
Import one historical round from a CSV.

Usage:
  npm run rounds:import -- --file ./imports/round-2.csv --round 2

Important flags:
  --file <path>                     CSV file to import
  --round <number>                 Round sequence number to create or replace
  --published-for-column <name>    CSV column for the business this row publishes for
  --published-by-column <name>     CSV column for the business publishing this row

Optional flags:
  --company-name-column <name>         Defaults to company_name, then business, then name
  --company-website-column <name>      Optional website column for the row business
  --published-for-website-column <name>
  --published-by-website-column <name>
  --active-column <name>               Optional boolean-like round activity column
  --status-column <name>               Optional status column, skips rows marked not active
  --status <draft|applied>             Defaults to applied
  --applied-at <iso-date>              Defaults to now when status=applied
  --dry-run                            Parse and validate without writing changes

Examples:
  npm run rounds:import -- --file ./imports/round-1.csv --round 1 --published-for-column published_for --published-by-column published_by

  npm run rounds:import -- --file ./imports/round-2.csv --round 2 --company-name-column company_name --published-for-column r2_publishing --published-by-column r2_published_by --active-column r2_active
`);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCell(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase();
}

function parseBooleanLike(value: string | null) {
  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (["true", "yes", "y", "1", "active"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "no", "n", "0", "inactive"].includes(normalizedValue)) {
    return false;
  }

  return null;
}

function shouldSkipRow(activeValue: string | null, statusValue: string | null) {
  const parsedActive = parseBooleanLike(activeValue);

  if (parsedActive === false) {
    return true;
  }

  const normalizedStatus = statusValue?.trim().toLowerCase() ?? null;

  if (normalizedStatus && normalizedStatus.includes("not active")) {
    return true;
  }

  return false;
}

function parseRoundSequenceNumber(value: string | undefined) {
  if (!value) {
    throw new Error("The --round flag is required.");
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error("The --round value must be a positive integer.");
  }

  return parsedValue;
}

function parseRoundStatus(value: string | undefined): RoundBatchStatus {
  if (!value) {
    return "applied";
  }

  if (value === "draft" || value === "applied") {
    return value;
  }

  throw new Error("The --status value must be either draft or applied.");
}

function getHeaderValue(
  row: CsvRow,
  headerMap: HeaderMap,
  requestedColumn?: string,
  fallbackColumns: string[] = [],
) {
  const requestedHeaders = [requestedColumn, ...fallbackColumns].filter(
    (value): value is string => Boolean(value),
  );

  for (const requestedHeader of requestedHeaders) {
    const actualHeader = headerMap.get(normalizeHeader(requestedHeader));

    if (actualHeader) {
      return normalizeCell(row[actualHeader]);
    }
  }

  return null;
}

function parseArgs(argv: string[]): CliOptions {
  const optionValues = new Map<string, string>();
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      printHelp();
      process.exit(0);
    }

    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const nextValue = argv[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      throw new Error(`Missing value for ${argument}.`);
    }

    optionValues.set(argument, nextValue);
    index += 1;
  }

  const filePath = optionValues.get("--file");

  if (!filePath) {
    throw new Error("The --file flag is required.");
  }

  return {
    activeColumn: optionValues.get("--active-column"),
    appliedAt: optionValues.get("--applied-at"),
    companyNameColumn: optionValues.get("--company-name-column"),
    companyWebsiteColumn: optionValues.get("--company-website-column"),
    dryRun,
    filePath,
    publishedByColumn: optionValues.get("--published-by-column"),
    publishedByWebsiteColumn: optionValues.get("--published-by-website-column"),
    publishedForColumn: optionValues.get("--published-for-column"),
    publishedForWebsiteColumn: optionValues.get(
      "--published-for-website-column",
    ),
    roundSequenceNumber: parseRoundSequenceNumber(optionValues.get("--round")),
    status: parseRoundStatus(optionValues.get("--status")),
    statusColumn: optionValues.get("--status-column"),
  };
}

function createBusinessMaps(businesses: BusinessLookupRecord[]) {
  const businessByName = new Map<string, BusinessLookupRecord>();
  const businessByWebsiteUrl = new Map<string, BusinessLookupRecord>();

  for (const business of businesses) {
    businessByName.set(normalizeLookupKey(business.business), business);

    if (business.websiteUrl) {
      businessByWebsiteUrl.set(
        normalizeLookupKey(business.websiteUrl),
        business,
      );
    }
  }

  return { businessByName, businessByWebsiteUrl };
}

function resolveBusiness(
  reference: BusinessReference,
  businessMaps: ReturnType<typeof createBusinessMaps>,
  contextLabel: string,
) {
  if (reference.websiteUrl) {
    const businessByWebsite = businessMaps.businessByWebsiteUrl.get(
      normalizeLookupKey(reference.websiteUrl),
    );

    if (businessByWebsite) {
      return businessByWebsite;
    }
  }

  if (reference.label) {
    const businessByName = businessMaps.businessByName.get(
      normalizeLookupKey(reference.label),
    );

    if (businessByName) {
      return businessByName;
    }
  }

  const referenceDescription = reference.websiteUrl
    ? `${reference.label ?? "(no name provided)"} [${reference.websiteUrl}]`
    : (reference.label ?? "(empty value)");

  throw new Error(
    `Could not resolve ${contextLabel}: ${referenceDescription}.`,
  );
}

function buildImportedAssignments(
  rows: CsvRow[],
  headerMap: HeaderMap,
  businessMaps: ReturnType<typeof createBusinessMaps>,
  options: CliOptions,
) {
  const assignmentsByPairKey = new Map<string, ImportedAssignment>();
  let skippedInactiveRowCount = 0;

  function registerAssignment(
    hostBusiness: BusinessLookupRecord,
    guestBusiness: BusinessLookupRecord,
    rowNumber: number,
  ) {
    if (hostBusiness.id === guestBusiness.id) {
      throw new Error(
        `Row ${rowNumber} assigns ${hostBusiness.business} to itself, which is invalid.`,
      );
    }

    const pairKey = `${hostBusiness.id}:${guestBusiness.id}`;
    const reversePairKey = `${guestBusiness.id}:${hostBusiness.id}`;
    const existingAssignment = assignmentsByPairKey.get(pairKey);

    if (existingAssignment) {
      return;
    }

    if (assignmentsByPairKey.has(reversePairKey)) {
      throw new Error(
        `Row ${rowNumber} creates a reversed duplicate pair between ${hostBusiness.business} and ${guestBusiness.business}.`,
      );
    }

    const importedAssignment = {
      guestBusinessId: guestBusiness.id,
      guestBusinessName: guestBusiness.business,
      hostBusinessId: hostBusiness.id,
      hostBusinessName: hostBusiness.business,
    } satisfies ImportedAssignment;

    assignmentsByPairKey.set(pairKey, importedAssignment);
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const activeValue = getHeaderValue(row, headerMap, options.activeColumn);
    const statusValue = getHeaderValue(row, headerMap, options.statusColumn);

    if (shouldSkipRow(activeValue, statusValue)) {
      skippedInactiveRowCount += 1;
      return;
    }

    const companyReference = {
      label: getHeaderValue(row, headerMap, options.companyNameColumn, [
        "company_name",
        "business",
        "name",
      ]),
      websiteUrl: getHeaderValue(row, headerMap, options.companyWebsiteColumn, [
        "company_website_url",
        "website_url",
      ]),
    } satisfies BusinessReference;

    if (!companyReference.label && !companyReference.websiteUrl) {
      throw new Error(`Row ${rowNumber} is missing the company reference.`);
    }

    const companyBusiness = resolveBusiness(
      companyReference,
      businessMaps,
      `row ${rowNumber} company`,
    );

    const publishedByReference = {
      label: getHeaderValue(row, headerMap, options.publishedByColumn, [
        "published_by",
      ]),
      websiteUrl: getHeaderValue(
        row,
        headerMap,
        options.publishedByWebsiteColumn,
        ["published_by_website_url"],
      ),
    } satisfies BusinessReference;
    const publishedForReference = {
      label: getHeaderValue(row, headerMap, options.publishedForColumn, [
        "published_for",
        "publishing",
      ]),
      websiteUrl: getHeaderValue(
        row,
        headerMap,
        options.publishedForWebsiteColumn,
        ["published_for_website_url", "publishing_website_url"],
      ),
    } satisfies BusinessReference;

    if (publishedByReference.label || publishedByReference.websiteUrl) {
      const publishedByBusiness = resolveBusiness(
        publishedByReference,
        businessMaps,
        `row ${rowNumber} published_by`,
      );

      registerAssignment(publishedByBusiness, companyBusiness, rowNumber);
    }

    if (publishedForReference.label || publishedForReference.websiteUrl) {
      const publishedForBusiness = resolveBusiness(
        publishedForReference,
        businessMaps,
        `row ${rowNumber} published_for`,
      );

      registerAssignment(companyBusiness, publishedForBusiness, rowNumber);
    }
  });

  return {
    assignments: Array.from(assignmentsByPairKey.values()),
    skippedInactiveRowCount,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const absoluteFilePath = path.resolve(process.cwd(), options.filePath);
  const csvContents = await readFile(absoluteFilePath, "utf8");
  const rows = parse(csvContents, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];

  if (rows.length === 0) {
    throw new Error("The provided CSV file is empty.");
  }

  const headerMap = new Map<string, string>();

  for (const headerName of Object.keys(rows[0])) {
    headerMap.set(normalizeHeader(headerName), headerName);
  }

  const connectionString = getNormalizedDatabaseUrl();
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const businesses = await prisma.business.findMany({
      select: {
        business: true,
        id: true,
        websiteUrl: true,
      },
    });
    const businessMaps = createBusinessMaps(businesses);
    const { assignments, skippedInactiveRowCount } = buildImportedAssignments(
      rows,
      headerMap,
      businessMaps,
      options,
    );

    if (assignments.length === 0) {
      throw new Error("No directed assignments were found in the CSV.");
    }

    if (options.dryRun) {
      console.log(
        JSON.stringify(
          {
            assignmentCount: assignments.length,
            dryRun: true,
            roundSequenceNumber: options.roundSequenceNumber,
            skippedInactiveRowCount,
          },
          null,
          2,
        ),
      );
      return;
    }

    const appliedAt =
      options.status === "applied"
        ? new Date(options.appliedAt ?? Date.now())
        : null;

    if (appliedAt && Number.isNaN(appliedAt.getTime())) {
      throw new Error("The --applied-at value is not a valid date.");
    }

    const result = await prisma.$transaction(async (transaction) => {
      const roundBatch = await transaction.roundBatch.upsert({
        create: {
          appliedAt,
          sequenceNumber: options.roundSequenceNumber,
          status: options.status,
        },
        update: {
          appliedAt,
          status: options.status,
        },
        where: {
          sequenceNumber: options.roundSequenceNumber,
        },
      });

      const detachedMatches = await transaction.match.updateMany({
        data: {
          roundBatchId: null,
        },
        where: {
          roundBatchId: roundBatch.id,
        },
      });

      await transaction.roundAssignment.deleteMany({
        where: {
          roundBatchId: roundBatch.id,
        },
      });

      await transaction.roundAssignment.createMany({
        data: assignments.map((assignment) => ({
          guestBusinessId: assignment.guestBusinessId,
          hostBusinessId: assignment.hostBusinessId,
          roundBatchId: roundBatch.id,
          source: "manual",
        })),
      });

      let createdMatchCount = 0;
      let linkedExistingMatchCount = 0;

      for (const assignment of assignments) {
        const existingMatch = await transaction.match.findUnique({
          select: {
            id: true,
          },
          where: {
            hostId_guestId: {
              guestId: assignment.guestBusinessId,
              hostId: assignment.hostBusinessId,
            },
          },
        });

        if (existingMatch) {
          await transaction.match.update({
            data: {
              roundBatchId: roundBatch.id,
            },
            where: {
              id: existingMatch.id,
            },
          });
          linkedExistingMatchCount += 1;
          continue;
        }

        await transaction.match.create({
          data: {
            guestId: assignment.guestBusinessId,
            hostId: assignment.hostBusinessId,
            roundBatchId: roundBatch.id,
          },
        });
        createdMatchCount += 1;
      }

      return {
        batchId: roundBatch.id,
        createdMatchCount,
        detachedMatchCount: detachedMatches.count,
        linkedExistingMatchCount,
      };
    });

    console.log(
      JSON.stringify(
        {
          assignmentCount: assignments.length,
          batchId: result.batchId,
          createdMatchCount: result.createdMatchCount,
          detachedMatchCount: result.detachedMatchCount,
          linkedExistingMatchCount: result.linkedExistingMatchCount,
          roundSequenceNumber: options.roundSequenceNumber,
          skippedInactiveRowCount,
          status: options.status,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
