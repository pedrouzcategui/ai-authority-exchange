export type RoundMatchMethod =
  | "same-subcategory"
  | "same-category"
  | "related-category"
  | "related-sector";

export type RoundMatchMethodBusiness = {
  businessCategoryId: number | null;
  relatedCategoryIds: readonly number[];
  sectorId: number | null;
  subcategory: string | null;
};

function normalizeSubcategory(value: string | null) {
  const normalizedValue = value?.trim().toLocaleLowerCase() ?? "";
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function hasRelatedCategoryMatch(
  leftBusiness: RoundMatchMethodBusiness,
  rightBusiness: RoundMatchMethodBusiness,
) {
  if (
    leftBusiness.businessCategoryId === null ||
    rightBusiness.businessCategoryId === null
  ) {
    return false;
  }

  return (
    leftBusiness.relatedCategoryIds.includes(rightBusiness.businessCategoryId) ||
    rightBusiness.relatedCategoryIds.includes(leftBusiness.businessCategoryId)
  );
}

export function getRoundMatchMethod(
  leftBusiness: RoundMatchMethodBusiness,
  rightBusiness: RoundMatchMethodBusiness,
): RoundMatchMethod | null {
  const leftSubcategory = normalizeSubcategory(leftBusiness.subcategory);
  const rightSubcategory = normalizeSubcategory(rightBusiness.subcategory);

  if (leftSubcategory && leftSubcategory === rightSubcategory) {
    return "same-subcategory";
  }

  if (
    leftBusiness.businessCategoryId !== null &&
    leftBusiness.businessCategoryId === rightBusiness.businessCategoryId
  ) {
    return "same-category";
  }

  if (hasRelatedCategoryMatch(leftBusiness, rightBusiness)) {
    return "related-category";
  }

  if (
    leftBusiness.sectorId !== null &&
    leftBusiness.sectorId === rightBusiness.sectorId
  ) {
    return "related-sector";
  }

  return null;
}