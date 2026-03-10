import type { BusinessRoleType } from "@/generated/prisma/client";

type BusinessRoleBadgeProps = {
  role: BusinessRoleType | null | undefined;
  tone?: "default" | "inverse";
};

function formatBusinessRole(role: BusinessRoleType | null | undefined) {
  if (!role) {
    return "Unknown";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function BusinessRoleBadge({
  role,
  tone = "default",
}: BusinessRoleBadgeProps) {
  const isPartner = role === "partner";

  const className =
    tone === "inverse"
      ? isPartner
        ? "inline-flex items-center rounded-full border border-accent/35 bg-accent/20 px-2 py-[0.15rem] text-[10px] font-medium tracking-[0.14em] uppercase text-white"
        : "inline-flex items-center rounded-full bg-white/18 px-2 py-[0.15rem] text-[10px] font-medium tracking-[0.14em] uppercase text-white/90"
      : isPartner
        ? "inline-flex items-center rounded-full border border-accent/20 bg-accent-soft px-2.5 py-0.5 text-[13px] font-medium text-accent-strong"
        : "inline-flex items-center rounded-full border border-border bg-brand-deep-soft/55 px-2.5 py-0.5 text-[13px] font-medium text-foreground";

  return <span className={className}>{formatBusinessRole(role)}</span>;
}
