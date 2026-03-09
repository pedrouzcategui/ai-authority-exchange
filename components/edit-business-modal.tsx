"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionTooltip, EditBusinessIcon } from "@/components/action-icons";
import type { BusinessOption } from "@/lib/matches";

type EditBusinessModalProps = {
  business: BusinessOption;
  triggerVariant?: "default" | "icon";
};

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

export function EditBusinessModal({
  business,
  triggerVariant = "default",
}: EditBusinessModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(business.business);
  const [role, setRole] = useState<(typeof roleOptions)[number]["value"]>(
    business.clientType ?? "partner",
  );
  const [websiteUrl, setWebsiteUrl] = useState(business.websiteUrl ?? "");
  const portalTarget = typeof document === "undefined" ? null : document.body;

  function syncFormWithBusiness() {
    setName(business.business);
    setRole(business.clientType ?? "partner");
    setWebsiteUrl(business.websiteUrl ?? "");
  }

  function openModal() {
    syncFormWithBusiness();
    setIsOpen(true);
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    syncFormWithBusiness();
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
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: business.id,
          name,
          role,
          websiteUrl: normalizedWebsiteUrl,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "The business could not be updated.");
        return;
      }

      toast.success(payload?.message ?? "Business updated successfully.");
      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {triggerVariant === "icon" ? (
        <span className="group relative inline-flex">
          <button
            aria-label="Edit business"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/80 text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
            onClick={openModal}
            type="button"
          >
            <EditBusinessIcon />
          </button>
          <ActionTooltip label="Edit business" />
        </span>
      ) : (
        <button
          aria-label="Edit business"
          className="inline-flex items-center rounded-full border border-border bg-white/80 px-4 py-2.5 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
          onClick={openModal}
          type="button"
        >
          Edit business
        </button>
      )}

      {portalTarget && isOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#122019]/45 px-4 py-8 backdrop-blur-sm">
              <div className="w-full max-w-2xl rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                      Edit Business
                    </p>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      Update business details for {business.business}
                    </h2>
                    <p className="max-w-xl text-sm leading-7 text-muted sm:text-base">
                      Edit the business name, website, or role without leaving
                      the relationships table.
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
                      inputMode="url"
                      onBlur={() =>
                        setWebsiteUrl((currentValue) =>
                          normalizeWebsiteInput(currentValue),
                        )
                      }
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      type="text"
                      value={websiteUrl}
                    />
                  </label>

                  <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-7 text-muted">
                      These changes update the business record directly and
                      refresh the table once saved.
                    </p>

                    <button
                      className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent/45"
                      disabled={!name.trim() || !websiteUrl.trim() || isPending}
                      type="submit"
                    >
                      {isPending ? "Saving business..." : "Save business"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            portalTarget,
          )
        : null}
    </>
  );
}
