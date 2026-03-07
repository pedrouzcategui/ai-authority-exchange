import { getBusinessRelationshipRows } from "@/lib/matches";

function parseFilterId(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return undefined;
  }

  return parsedValue;
}

function escapeCsvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatClientType(clientType: string | null | undefined) {
  if (!clientType) {
    return "unknown";
  }

  return clientType;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessFilter = parseFilterId(searchParams.get("business"));
  const hostFilter = parseFilterId(searchParams.get("host"));
  const guestFilter = parseFilterId(searchParams.get("guest"));
  const rows = await getBusinessRelationshipRows(
    businessFilter === undefined ? hostFilter : undefined,
    businessFilter === undefined ? guestFilter : undefined,
    businessFilter,
  );
  const csvRows = [
    ["business", "client_type", "published_by", "published_for"],
    ...rows.map((row) => [
      row.business,
      formatClientType(row.clientType),
      row.publishedBy.map((business) => business.business).join(" | "),
      row.publishedFor.map((business) => business.business).join(" | "),
    ]),
  ];
  const csv = csvRows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Disposition":
        'attachment; filename="business-publishing-relationships.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
