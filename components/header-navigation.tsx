"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type HeaderNavigationProps = {
  isAuthenticated: boolean;
};

const navigationItems = [
  {
    href: "/matches",
    label: "Matches",
    matches: (pathname: string) => pathname.startsWith("/matches"),
  },
  {
    href: "/businesses",
    label: "Businesses",
    matches: (pathname: string) =>
      pathname.startsWith("/businesses") || pathname.startsWith("/business/"),
  },
  {
    href: "/contacts",
    label: "Contacts",
    matches: (pathname: string) => pathname.startsWith("/contacts"),
  },
  {
    href: "/rounds",
    label: "Rounds",
    matches: (pathname: string) => pathname.startsWith("/rounds"),
  },
] as const;

export function HeaderNavigation({ isAuthenticated }: HeaderNavigationProps) {
  const pathname = usePathname();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav
      aria-label="Primary"
      className="flex flex-wrap items-center gap-2 md:col-span-2 lg:col-span-1"
    >
      {navigationItems.map((item) => {
        const isActive = item.matches(pathname);

        return (
          <Link
            key={item.href}
            className={
              isActive
                ? "inline-flex min-h-10 items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
                : "inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            }
            href={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
