import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthControls } from "@/components/auth-controls";
import {
  getLastAuthDiagnostic,
  getMissingAuthTables,
} from "@/lib/auth-diagnostics";
import { getAuthSession } from "@/lib/auth-session";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

function getErrorMessage(
  error: string | undefined,
  missingAuthTables: string[],
) {
  if (error === "AccessDenied") {
    return "This Google account is not approved for access. Your email must already exist in the internal users table.";
  }

  if (error === "Callback") {
    if (missingAuthTables.length > 0) {
      return `Google sign-in reached the callback, but the auth database tables are still missing: ${missingAuthTables.join(", ")}. Apply the SQL in prisma/manual/20260309_add_google_auth.sql first, then try again.`;
    }

    return "Google sign-in reached the callback stage, but the server could not finish the login. Check the terminal logs for the [next-auth] error details.";
  }

  if (error === "OAuthSignin" || error === "OAuthCallback") {
    return "Google sign-in could not be completed. Check the Google OAuth callback settings and try again.";
  }

  if (error === "Configuration") {
    return "Authentication is not configured correctly yet. Check the auth environment variables and provider settings.";
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, resolvedSearchParams, missingAuthTables, authDiagnostic] = await Promise.all([
    getAuthSession(),
    searchParams,
    getMissingAuthTables(),
    Promise.resolve(getLastAuthDiagnostic()),
  ]);

  if (session?.user?.legacyUserId) {
    redirect("/matches");
  }

  const resolvedError = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams?.error;
  const errorMessage = getErrorMessage(resolvedError, missingAuthTables);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="rounded-4xl border border-border bg-surface p-8 shadow-(--shadow) backdrop-blur-md sm:p-10">
          <p className="inline-flex rounded-full border border-border bg-white/70 px-4 py-1.5 text-sm font-medium tracking-[0.16em] text-accent uppercase backdrop-blur-sm">
            Google Sign-In
          </p>

          <h1 className="mt-6 max-w-2xl text-4xl leading-tight font-semibold tracking-tight text-foreground sm:text-5xl">
            Sign in with an approved Google account.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Access is limited to people whose email already exists in the
            internal users table. There is no public sign-up flow in this first
            phase.
          </p>

          {missingAuthTables.length > 0 ? (
            <div className="mt-6 rounded-3xl border border-warning-strong/20 bg-warning-soft px-5 py-4 text-sm leading-7 text-warning-strong">
              Authentication tables are not present in the database yet.
              Missing: {missingAuthTables.join(", ")}. Google sign-in will keep
              failing until the SQL in
              prisma/manual/20260309_add_google_auth.sql is applied.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-6 rounded-3xl border border-danger-strong/20 bg-danger-soft px-5 py-4 text-sm leading-7 text-danger-strong">
              {errorMessage}
            </div>
          ) : null}

          {resolvedError && authDiagnostic ? (
            <details className="mt-6 rounded-3xl border border-border bg-white/70 px-5 py-4 text-sm text-foreground">
              <summary className="cursor-pointer font-semibold text-foreground">
                Latest auth diagnostic
              </summary>
              <div className="mt-3 space-y-2 text-sm text-muted">
                <p>
                  <span className="font-semibold text-foreground">Code:</span>{" "}
                  {authDiagnostic.code}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Recorded:</span>{" "}
                  {authDiagnostic.recordedAt}
                </p>
                <pre className="overflow-x-auto rounded-2xl bg-brand-deep p-4 text-xs leading-6 text-white/88">
                  {authDiagnostic.details}
                </pre>
              </div>
            </details>
          ) : null}

          <div className="mt-8">
            <AuthControls user={null} variant="page" />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white/85 px-4 py-2 font-medium text-accent-strong">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              Existing users only
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/85 px-4 py-2 font-medium">
              Google OAuth provider
            </span>
          </div>
        </div>

        <aside className="rounded-4xl border border-brand-deep/10 bg-brand-deep p-8 text-white shadow-(--shadow) sm:p-10">
          <p className="text-sm font-medium tracking-[0.16em] text-white/72 uppercase">
            Access Rules
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Who can get in
              </h2>
              <p className="mt-2 text-sm leading-7 text-white/78">
                Only Google accounts whose email address already exists in the
                database users table are allowed through.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/6 p-5">
              <p className="text-sm font-medium text-accent-soft">
                Protected now
              </p>
              <p className="mt-2 text-sm leading-7 text-white/78">
                Match pages, business profile pages, and write APIs will require
                an authenticated approved session.
              </p>
            </div>

            <Link
              className="inline-flex items-center rounded-full border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong"
              href="/"
            >
              Back to home
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
