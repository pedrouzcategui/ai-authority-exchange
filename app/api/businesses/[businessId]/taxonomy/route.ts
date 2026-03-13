import { NextResponse } from "next/server";
import { requireLegacyUserSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    businessId: string;
  }>;
};

const categoryNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function parseNumericId(value: string) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function compareCategories(
  left: { id: number; name: string; sectorName: string | null },
  right: { id: number; name: string; sectorName: string | null },
) {
  const sectorComparison = categoryNameCollator.compare(
    left.sectorName ?? "",
    right.sectorName ?? "",
  );

  if (sectorComparison !== 0) {
    return sectorComparison;
  }

  const categoryComparison = categoryNameCollator.compare(left.name, right.name);

  if (categoryComparison !== 0) {
    return categoryComparison;
  }

  return left.id - right.id;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireLegacyUserSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { businessId: rawBusinessId } = await context.params;
  const businessId = parseNumericId(rawBusinessId);

  if (businessId === null) {
    return NextResponse.json(
      { error: "The selected business is invalid." },
      { status: 400 },
    );
  }

  const [business, categories] = await Promise.all([
    prisma.business.findUnique({
      select: {
        business_category_id: true,
        id: true,
        related_categories_reasoning: true,
        related_category_ids: true,
        subcategory: true,
      },
      where: {
        id: businessId,
      },
    }),
    prisma.business_categories.findMany({
      select: {
        economic_sectors: {
          select: {
            name: true,
          },
        },
        id: true,
        name: true,
      },
    }),
  ]);

  if (!business) {
    return NextResponse.json(
      { error: "The selected business does not exist." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    businessCategoryId: business.business_category_id,
    businessId: business.id,
    categories: categories
      .map((category) => ({
        id: category.id,
        name: category.name?.trim() || `Category ${category.id}`,
        sectorName: category.economic_sectors?.name ?? null,
      }))
      .toSorted(compareCategories),
    relatedCategoriesReasoning: business.related_categories_reasoning,
    relatedCategoryIds: business.related_category_ids,
    subcategory: business.subcategory,
  });
}