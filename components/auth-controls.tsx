"use client";

import { useTransition } from "react";
import { signIn, signOut } from "next-auth/react";

type AuthControlsProps = {
  user: {
    email?: string | null;
    name?: string | null;
  } | null;
  variant?: "header" | "page";
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M21.8 12.23c0-.77-.07-1.5-.2-2.2H12v4.16h5.49a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.05-4.4 3.05-7.6Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.75 0 5.06-.91 6.75-2.47l-3.3-2.56c-.92.62-2.09.99-3.45.99-2.66 0-4.92-1.8-5.73-4.22H2.86v2.64A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.27 13.74A5.96 5.96 0 0 1 5.95 12c0-.6.11-1.18.32-1.74V7.62H2.86A10 10 0 0 0 2 12c0 1.59.38 3.09 1.06 4.38l3.21-2.64Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.04c1.5 0 2.84.51 3.9 1.52l2.92-2.92C17.05 2.99 14.74 2 12 2 8.09 2 4.73 4.24 2.86 7.62l3.41 2.64c.81-2.42 3.07-4.22 5.73-4.22Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function getDisplayName(user: AuthControlsProps["user"]) {
  if (!user) {
    return null;
  }

  return user.name?.trim() || user.email?.trim() || "Approved user";
}

export function AuthControls({ user, variant = "header" }: AuthControlsProps) {
  const [isPending, startTransition] = useTransition();
  const isPageVariant = variant === "page";

  if (!user) {
    return (
      <button
        className={
          isPageVariant
            ? "inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            : "inline-flex min-h-11 items-center justify-center gap-3 rounded-full border border-border bg-white/86 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
        }
        disabled={isPending}
        onClick={() => {
          startTransition(() => {
            void signIn("google", { callbackUrl: "/matches" });
          });
        }}
        type="button"
      >
        <GoogleMark />
        <span>{isPending ? "Redirecting..." : "Sign in with Google"}</span>
      </button>
    );
  }

  const displayName = getDisplayName(user);

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="rounded-3xl border border-border bg-white/78 px-4 py-3 text-right shadow-sm backdrop-blur-sm">
        <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">
          Approved Access
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {displayName}
        </p>
        {user.email ? (
          <p className="mt-0.5 text-xs text-muted">{user.email}</p>
        ) : null}
      </div>

      <button
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={() => {
          startTransition(() => {
            void signOut({ callbackUrl: "/" });
          });
        }}
        type="button"
      >
        {isPending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
