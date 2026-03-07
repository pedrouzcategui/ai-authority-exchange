"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const roleOptions = [
  { label: "Client", value: "client" },
  { label: "Partner", value: "partner" },
] as const;

const hasProtocolPattern = /^[a-z][a-z\d+.-]*:\/\//i;

function normalizeWebsiteInput(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  return hasProtocolPattern.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;
}

export function AddClientModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [role, setRole] =
    useState<(typeof roleOptions)[number]["value"]>("partner");
  const [websiteUrl, setWebsiteUrl] = useState("");

  function resetForm() {
    setName("");
    setRole("partner");
    setWebsiteUrl("");
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !websiteUrl.trim()) {
      toast.error("Please provide a business name and website URL.");
      return;
    }

    const normalizedWebsiteUrl = normalizeWebsiteInput(websiteUrl);
    setWebsiteUrl(normalizedWebsiteUrl);

    startTransition(async () => {
      const response = await fetch("/api/businesses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, role, websiteUrl: normalizedWebsiteUrl }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "The business could not be created.");
        return;
      }

      toast.success(payload?.message ?? "Business added successfully.");
      setIsOpen(false);
      resetForm();
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="inline-flex items-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Add a Business
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#122019]/45 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                  Add Business
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Add a new business to the database
                </h2>
                <p className="max-w-xl text-sm leading-7 text-muted sm:text-base">
                  Add the business name, website, and role so it becomes
                  available immediately in the match creation flow.
                </p>
              </div>

              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
                onClick={closeModal}
                type="button"
              >
                Close
              </button>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Business name
                </span>
                <input
                  className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  disabled={isPending}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Acme Roofing"
                  type="text"
                  value={name}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Role
                </span>
                <select
                  className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  disabled={isPending}
                  onChange={(event) =>
                    setRole(
                      event.target
                        .value as (typeof roleOptions)[number]["value"],
                    )
                  }
                  value={role}
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Website URL
                </span>
                <input
                  className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  disabled={isPending}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  onBlur={() =>
                    setWebsiteUrl((currentValue) =>
                      normalizeWebsiteInput(currentValue),
                    )
                  }
                  placeholder="https://www.acmeroofing.com"
                  inputMode="url"
                  type="text"
                  value={websiteUrl}
                />
              </label>

              <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-muted">
                  Use the role to control whether this business appears as a
                  client or partner in the rest of the app.
                </p>

                <button
                  className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent/45"
                  disabled={!name.trim() || !websiteUrl.trim() || isPending}
                  type="submit"
                >
                  {isPending ? "Adding business..." : "Save business"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
