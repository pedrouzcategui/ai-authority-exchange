import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type BusinessContactRoleType,
} from "../generated/prisma/client";
import { getNormalizedDatabaseUrl } from "../lib/database-url";

type CliOptions = {
  companyNameColumn?: string;
  dryRun: boolean;
  emailColumn?: string;
  expertNameColumn?: string;
  filePath: string;
};

type CsvRow = Record<string, string>;

type HeaderMap = Map<string, string>;

type BusinessLookupRecord = {
  business: string;
  expertContactId: number | null;
  expertRole: BusinessContactRoleType | null;
  id: number;
};

type ExpertContactLookupRecord = {
  email: string;
  id: number;
};

type RowReport = {
  companyName: string | null;
  email: string | null;
  message: string;
  rowNumber: number;
};

type NormalizedExpertReference = {
  email: string | null;
  expertName: string | null;
  reason: "blank-expert" | "invalid-email" | "missing-email" | "ok";
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const invalidEmailPlaceholders = new Set([
  "partner not found",
  "not found",
  "n/a",
  "na",
  "none",
  "null",
  "unknown",
]);

function printHelp() {
  console.log(`
Import expert assignments from the Experts View CSV.

Usage:
  npm run experts:import -- --dry-run
  npm run experts:import -- --file ./scripts/experts_view.csv

Optional flags:
  --file <path>                 Defaults to ./scripts/experts_view.csv
  --company-name-column <name> Defaults to company_name, then business, then name
  --expert-name-column <name>  Defaults to expert_name
  --email-column <name>        Defaults to Email, then email
  --dry-run                    Parse and validate without writing changes
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

  return {
    companyNameColumn: optionValues.get("--company-name-column"),
    dryRun,
    emailColumn: optionValues.get("--email-column"),
    expertNameColumn: optionValues.get("--expert-name-column"),
    filePath: optionValues.get("--file") ?? "./scripts/experts_view.csv",
  };
}

function normalizeEmail(value: string | null) {
  if (value === null) {
    return null;
  }

  const normalizedValue = value
    .trim()
    .replace(/^mailto:/i, "")
    .toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  if (invalidEmailPlaceholders.has(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

function isValidEmail(value: string) {
  return emailPattern.test(value);
}

function normalizeExpertReference(params: {
  rawEmail: string | null;
  rawExpertName: string | null;
}): NormalizedExpertReference {
  const normalizedEmail = normalizeEmail(params.rawEmail);
  const normalizedExpertName = normalizeCell(params.rawExpertName);

  if (normalizedEmail) {
    if (isValidEmail(normalizedEmail)) {
      return {
        email: normalizedEmail,
        expertName: normalizedExpertName,
        reason: "ok",
      };
    }

    return {
      email: normalizedEmail,
      expertName: normalizedExpertName,
      reason: "invalid-email",
    };
  }

  if (!normalizedExpertName) {
    return {
      email: null,
      expertName: null,
      reason: "blank-expert",
    };
  }

  const derivedEmail = normalizeEmail(normalizedExpertName);

  if (!derivedEmail) {
    return {
      email: null,
      expertName: normalizedExpertName,
      reason: "missing-email",
    };
  }

  if (!isValidEmail(derivedEmail)) {
    return {
      email: derivedEmail,
      expertName: null,
      reason: "invalid-email",
    };
  }

  return {
    email: derivedEmail,
    expertName: null,
    reason: "ok",
  };
}

function createBusinessMap(businesses: BusinessLookupRecord[]) {
  const businessByName = new Map<string, BusinessLookupRecord>();

  for (const business of businesses) {
    businessByName.set(normalizeLookupKey(business.business), business);
  }

  return businessByName;
}

function createExpertContactMap(expertContacts: ExpertContactLookupRecord[]) {
  const expertByEmail = new Map<string, ExpertContactLookupRecord>();

  for (const expertContact of expertContacts) {
    expertByEmail.set(normalizeLookupKey(expertContact.email), expertContact);
  }

  return expertByEmail;
}

function createRowReport(
  rowNumber: number,
  companyName: string | null,
  email: string | null,
  message: string,
) {
  return {
    companyName,
    email,
    message,
    rowNumber,
  } satisfies RowReport;
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
    const [businesses, expertContacts] = await Promise.all([
      prisma.business.findMany({
        select: {
          business: true,
          expertContactId: true,
          expertRole: true,
          id: true,
        },
      }),
      prisma.businessContact.findMany({
        select: {
          email: true,
          id: true,
        },
        where: {
          email: {
            not: null,
          },
          role: "expert",
        },
      }),
    ]);

    const businessByName = createBusinessMap(businesses);
    const expertByEmail = createExpertContactMap(
      expertContacts.flatMap((contact) =>
        contact.email
          ? [
              {
                email: contact.email,
                id: contact.id,
              } satisfies ExpertContactLookupRecord,
            ]
          : [],
      ),
    );

    const updatedRows: RowReport[] = [];
    const unchangedRows: RowReport[] = [];
    const skippedBlankExpertRows: RowReport[] = [];
    const skippedInvalidEmailRows: RowReport[] = [];
    const skippedMissingBusinessRows: RowReport[] = [];
    const skippedMissingExpertRows: RowReport[] = [];
    const failedRows: RowReport[] = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const companyName = getHeaderValue(
        row,
        headerMap,
        options.companyNameColumn,
        ["company_name", "business", "name"],
      );
      const rawExpertName = getHeaderValue(
        row,
        headerMap,
        options.expertNameColumn,
        ["expert_name"],
      );
      const rawEmail = getHeaderValue(row, headerMap, options.emailColumn, [
        "Email",
        "email",
      ]);
      const expertReference = normalizeExpertReference({
        rawEmail,
        rawExpertName,
      });

      if (!companyName) {
        failedRows.push(
          createRowReport(
            rowNumber,
            null,
            expertReference.email,
            "The row is missing company_name.",
          ),
        );
        continue;
      }

      if (expertReference.reason === "blank-expert") {
        skippedBlankExpertRows.push(
          createRowReport(
            rowNumber,
            companyName,
            null,
            "No expert data was provided for this company.",
          ),
        );
        continue;
      }

      if (expertReference.reason === "missing-email") {
        skippedInvalidEmailRows.push(
          createRowReport(
            rowNumber,
            companyName,
            null,
            "An expert name was provided, but no usable email was available for email-only matching.",
          ),
        );
        continue;
      }

      if (expertReference.reason === "invalid-email") {
        skippedInvalidEmailRows.push(
          createRowReport(
            rowNumber,
            companyName,
            expertReference.email,
            "The expert email is invalid or uses a placeholder value.",
          ),
        );
        continue;
      }

      const expertEmail = expertReference.email;

      if (!expertEmail) {
        failedRows.push(
          createRowReport(
            rowNumber,
            companyName,
            null,
            "The row could not be normalized to a usable expert email.",
          ),
        );
        continue;
      }

      const business = businessByName.get(normalizeLookupKey(companyName));

      if (!business) {
        skippedMissingBusinessRows.push(
          createRowReport(
            rowNumber,
            companyName,
            expertEmail,
            "No business with this company name exists in the database.",
          ),
        );
        continue;
      }

      const expertContact = expertByEmail.get(normalizeLookupKey(expertEmail));

      if (!expertContact) {
        skippedMissingExpertRows.push(
          createRowReport(
            rowNumber,
            companyName,
            expertEmail,
            "No existing expert contact with this email was found.",
          ),
        );
        continue;
      }

      if (
        business.expertContactId === expertContact.id &&
        business.expertRole === "expert"
      ) {
        unchangedRows.push(
          createRowReport(
            rowNumber,
            companyName,
            expertEmail,
            "The business is already assigned to this expert.",
          ),
        );
        continue;
      }

      if (options.dryRun) {
        updatedRows.push(
          createRowReport(
            rowNumber,
            companyName,
            expertEmail,
            "Dry run: the business would be updated to this expert.",
          ),
        );
        continue;
      }

      try {
        await prisma.business.update({
          data: {
            expertContactId: expertContact.id,
            expertRole: "expert",
          },
          where: {
            id: business.id,
          },
        });

        updatedRows.push(
          createRowReport(
            rowNumber,
            companyName,
            expertEmail,
            "The business expert was updated successfully.",
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        failedRows.push(
          createRowReport(
            rowNumber,
            companyName,
            expertEmail,
            `The business could not be updated. ${message}`,
          ),
        );
      }
    }

    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          filePath: absoluteFilePath,
          summary: {
            failed: failedRows.length,
            skippedBlankExpert: skippedBlankExpertRows.length,
            skippedInvalidEmail: skippedInvalidEmailRows.length,
            skippedMissingBusiness: skippedMissingBusinessRows.length,
            skippedMissingExpert: skippedMissingExpertRows.length,
            totalRows: rows.length,
            unchanged: unchangedRows.length,
            updated: updatedRows.length,
          },
          details: {
            failedRows,
            skippedBlankExpertRows,
            skippedInvalidEmailRows,
            skippedMissingBusinessRows,
            skippedMissingExpertRows,
            unchangedRows,
            updatedRows,
          },
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
