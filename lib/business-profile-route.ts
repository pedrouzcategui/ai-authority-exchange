export function getBusinessProfileSlug(businessName: string) {
  return businessName
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getBusinessProfileHref(businessId: number) {
  return `/business/${businessId}`;
}