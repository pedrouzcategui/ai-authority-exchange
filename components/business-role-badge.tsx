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
        ? "inline-flex items-center rounded-full border border-[#a785f0]/45 bg-[#7c4ad9]/22 px-2 py-0.5 text-[11px] font-medium tracking-[0.14em] uppercase text-[#f3ecff]"
        : "inline-flex items-center rounded-full bg-white/18 px-2 py-0.5 text-[11px] font-medium tracking-[0.14em] uppercase text-white/90"
      : isPartner
        ? "inline-flex items-center rounded-full border border-[#ceb5ff] bg-[#f2eaff] px-3 py-1 text-sm font-medium text-[#6f42c1]"
        : "inline-flex items-center rounded-full border border-border bg-[#efe3d2]/45 px-3 py-1 text-sm font-medium text-foreground";

  return <span className={className}>{formatBusinessRole(role)}</span>;
}
