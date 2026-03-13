"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionTooltip, EditBusinessIcon } from "@/components/action-icons";
import {
  BusinessTaxonomyFields,
  type BusinessTaxonomyCategoryOption,
} from "@/components/business-taxonomy-fields";
import { ExchangeParticipationFields } from "@/components/exchange-participation-fields";
import type { ExchangeParticipationStatus } from "@/lib/ai-authority-exchange";
import type { BusinessOption } from "@/lib/matches";

type EditBusinessModalProps = {
  business: BusinessOption;
  triggerVariant?: "default" | "icon";
};

type BusinessTaxonomyResponse = {
  businessCategoryId: number | null;
  businessId: number;
  categories: BusinessTaxonomyCategoryOption[];
  relatedCategoriesReasoning: string | null;
  relatedCategoryIds: number[];
  subcategory: string | null;
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

function formatDateInputValue(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

export function EditBusinessModal({
  business,
  triggerVariant = "default",
}: EditBusinessModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [taxonomyReloadKey, setTaxonomyReloadKey] = useState(0);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState(false);
  const [isTaxonomyReady, setIsTaxonomyReady] = useState(false);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [taxonomyCategories, setTaxonomyCategories] = useState<
    BusinessTaxonomyCategoryOption[]
  >([]);
  const [businessCategoryId, setBusinessCategoryId] = useState<number | null>(
    null,
  );
  const [subcategory, setSubcategory] = useState("");
  const [relatedCategoryIds, setRelatedCategoryIds] = useState<number[]>([]);
  const [relatedCategoriesReasoning, setRelatedCategoriesReasoning] =
    useState("");
  const [exchangeParticipationStatus, setExchangeParticipationStatus] =
    useState<ExchangeParticipationStatus>(
      business.aiAuthorityExchangeParticipationStatus,
    );
  const [name, setName] = useState(business.business);
  const [role, setRole] = useState<(typeof roleOptions)[number]["value"]>(
    business.clientType ?? "partner",
  );
  const [aiAuthorityExchangeRetiredAt, setAiAuthorityExchangeRetiredAt] =
    useState(formatDateInputValue(business.aiAuthorityExchangeRetiredAt));
  const [
    aiAuthorityExchangeRetiredRoundSequenceNumber,
    setAiAuthorityExchangeRetiredRoundSequenceNumber,
  ] = useState(
    business.aiAuthorityExchangeRetiredInRoundSequenceNumber?.toString() ?? "",
  );
  const [websiteUrl, setWebsiteUrl] = useState(business.websiteUrl ?? "");
  const portalTarget = typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const abortController = new AbortController();

    async function loadTaxonomy() {
      setIsTaxonomyLoading(true);
      setIsTaxonomyReady(false);
      setTaxonomyError(null);

      try {
        const response = await fetch(`/api/businesses/${business.id}/taxonomy`, {
          signal: abortController.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | ({ error?: string } & Partial<BusinessTaxonomyResponse>)
          | null;

        if (!response.ok) {
          throw new Error(
            payload?.error ?? "The business taxonomy could not be loaded.",
          );
        }

        setBusinessCategoryId(payload?.businessCategoryId ?? null);
        setSubcategory(payload?.subcategory ?? "");
        setRelatedCategoryIds(payload?.relatedCategoryIds ?? []);
        setRelatedCategoriesReasoning(
          payload?.relatedCategoriesReasoning ?? "",
        );
        setTaxonomyCategories(payload?.categories ?? []);
        setIsTaxonomyReady(true);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "The business taxonomy could not be loaded.";

        setTaxonomyCategories([]);
        setTaxonomyError(message);
      } finally {
        if (!abortController.signal.aborted) {
          setIsTaxonomyLoading(false);
        }
      }
    }

    void loadTaxonomy();

    return () => {
      abortController.abort();
    };
  }, [business.id, isOpen, taxonomyReloadKey]);

  function syncFormWithBusiness() {
    setExchangeParticipationStatus(
      business.aiAuthorityExchangeParticipationStatus,
    );
    setName(business.business);
    setRole(business.clientType ?? "partner");
    setAiAuthorityExchangeRetiredAt(
      formatDateInputValue(business.aiAuthorityExchangeRetiredAt),
    );
    setAiAuthorityExchangeRetiredRoundSequenceNumber(
      business.aiAuthorityExchangeRetiredInRoundSequenceNumber?.toString() ??
        "",
    );
    setWebsiteUrl(business.websiteUrl ?? "");
    setBusinessCategoryId(null);
    setSubcategory("");
    setRelatedCategoryIds([]);
    setRelatedCategoriesReasoning("");
    setTaxonomyCategories([]);
    setTaxonomyError(null);
    setIsTaxonomyLoading(false);
    setIsTaxonomyReady(false);
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

  function retryTaxonomy() {
    if (isPending || isTaxonomyLoading) {
      return;
    }

    setTaxonomyReloadKey((currentValue) => currentValue + 1);
  }

  function handleBusinessCategoryIdChange(nextValue: number | null) {
    setBusinessCategoryId(nextValue);
    setRelatedCategoryIds((currentValue) =>
      nextValue === null
        ? currentValue
        : currentValue.filter((categoryId) => categoryId !== nextValue),
    );
  }

  function handleToggleRelatedCategory(categoryId: number) {
    setRelatedCategoryIds((currentValue) =>
      currentValue.includes(categoryId)
        ? currentValue.filter((currentId) => currentId !== categoryId)
        : [...currentValue, categoryId],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !websiteUrl.trim()) {
      toast.error("Please provide a business name and website URL.");
      return;
    }

    if (
      exchangeParticipationStatus === "retired" &&
      !aiAuthorityExchangeRetiredAt
    ) {
      toast.error("Please provide the retirement date for retired businesses.");
      return;
    }

    if (
      exchangeParticipationStatus === "retired" &&
      aiAuthorityExchangeRetiredRoundSequenceNumber.trim() !== ""
    ) {
      const parsedRoundSequenceNumber = Number(
        aiAuthorityExchangeRetiredRoundSequenceNumber,
      );

      if (
        !Number.isInteger(parsedRoundSequenceNumber) ||
        parsedRoundSequenceNumber <= 0
      ) {
        toast.error("Retirement round must be a whole number greater than 0.");
        return;
      }
    }

    const normalizedWebsiteUrl = normalizeWebsiteInput(websiteUrl);
    setWebsiteUrl(normalizedWebsiteUrl);
    const updatePayload: Record<string, unknown> = {
      aiAuthorityExchangeRetiredAt:
        exchangeParticipationStatus === "retired"
          ? aiAuthorityExchangeRetiredAt
          : null,
      aiAuthorityExchangeRetiredRoundSequenceNumber:
        exchangeParticipationStatus === "retired" &&
        aiAuthorityExchangeRetiredRoundSequenceNumber.trim() !== ""
          ? Number(aiAuthorityExchangeRetiredRoundSequenceNumber)
          : null,
      businessId: business.id,
      exchangeParticipationStatus,
      name,
      role,
      websiteUrl: normalizedWebsiteUrl,
    };

    if (isTaxonomyReady) {
      updatePayload.businessCategoryId = businessCategoryId;
      updatePayload.relatedCategoriesReasoning = relatedCategoriesReasoning;
      updatePayload.relatedCategoryIds = relatedCategoryIds;
      updatePayload.subcategory = subcategory;
    }

    startTransition(async () => {
      const response = await fetch("/api/businesses", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(51,71,91,0.36)] px-4 py-8 backdrop-blur-sm">
              <div className="h-[80vh] w-full max-w-2xl overflow-y-auto rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                      Edit Business
                    </p>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      Update business details for {business.business}
                    </h2>
                    <p className="max-w-xl text-sm leading-7 text-muted sm:text-base">
                      Edit the business record, participation details, and
                      taxonomy without leaving this page.
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

                  <ExchangeParticipationFields
                    disabled={isPending}
                    onRetiredAtChange={setAiAuthorityExchangeRetiredAt}
                    onRetiredRoundSequenceNumberChange={
                      setAiAuthorityExchangeRetiredRoundSequenceNumber
                    }
                    onStatusChange={(nextStatus) => {
                      setExchangeParticipationStatus(nextStatus);

                      if (nextStatus !== "retired") {
                        setAiAuthorityExchangeRetiredAt("");
                        setAiAuthorityExchangeRetiredRoundSequenceNumber("");
                      }
                    }}
                    retiredAt={aiAuthorityExchangeRetiredAt}
                    retiredRoundSequenceNumber={
                      aiAuthorityExchangeRetiredRoundSequenceNumber
                    }
                    status={exchangeParticipationStatus}
                  />

                  <BusinessTaxonomyFields
                    businessCategoryId={businessCategoryId}
                    categories={taxonomyCategories}
                    disabled={isPending}
                    errorMessage={taxonomyError}
                    isLoading={isTaxonomyLoading}
                    onBusinessCategoryIdChange={handleBusinessCategoryIdChange}
                    onRelatedCategoriesReasoningChange={
                      setRelatedCategoriesReasoning
                    }
                    onRetry={retryTaxonomy}
                    onSubcategoryChange={setSubcategory}
                    onToggleRelatedCategory={handleToggleRelatedCategory}
                    relatedCategoriesReasoning={relatedCategoriesReasoning}
                    relatedCategoryIds={relatedCategoryIds}
                    subcategory={subcategory}
                  />

                  <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-7 text-muted">
                      These changes update the business record directly,
                      including whether it should stay active in future rounds
                      or be tracked as retired.
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
