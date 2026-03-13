export type BusinessTaxonomyCategoryOption = {
  id: number;
  name: string;
  sectorName: string | null;
};

type BusinessTaxonomyFieldsProps = {
  businessCategoryId: number | null;
  categories: readonly BusinessTaxonomyCategoryOption[];
  disabled: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  onBusinessCategoryIdChange: (value: number | null) => void;
  onRelatedCategoriesReasoningChange: (value: string) => void;
  onRetry: () => void;
  onSubcategoryChange: (value: string) => void;
  onToggleRelatedCategory: (categoryId: number) => void;
  relatedCategoriesReasoning: string;
  relatedCategoryIds: readonly number[];
  subcategory: string;
};

function formatCategoryLabel(category: BusinessTaxonomyCategoryOption) {
  return category.sectorName
    ? `${category.name} (${category.sectorName})`
    : category.name;
}

export function BusinessTaxonomyFields({
  businessCategoryId,
  categories,
  disabled,
  errorMessage,
  isLoading,
  onBusinessCategoryIdChange,
  onRelatedCategoriesReasoningChange,
  onRetry,
  onSubcategoryChange,
  onToggleRelatedCategory,
  relatedCategoriesReasoning,
  relatedCategoryIds,
  subcategory,
}: BusinessTaxonomyFieldsProps) {
  const availableRelatedCategories = categories.filter(
    (category) => category.id !== businessCategoryId,
  );

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-white/60 p-5">
      <div className="space-y-2">
        <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
          Business Taxonomy
        </p>
        <p className="max-w-2xl text-sm leading-7 text-muted">
          Update the primary category, subcategory, and adjacent categories that
          guide exchange matching.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border bg-white/70 px-4 py-5 text-sm text-muted">
          Loading taxonomy details...
        </div>
      ) : errorMessage ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#efb1a8] bg-[#fff0ec] px-4 py-4 text-sm text-[#8c4038] sm:flex-row sm:items-center sm:justify-between">
          <p>{errorMessage}</p>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#efb1a8] bg-white px-4 py-2 font-medium text-[#8c4038] transition hover:-translate-y-0.5"
            onClick={onRetry}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Primary category
            </span>
            <select
              className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              disabled={disabled}
              onChange={(event) => {
                const nextValue = event.target.value;
                onBusinessCategoryIdChange(
                  nextValue === "" ? null : Number.parseInt(nextValue, 10),
                );
              }}
              value={businessCategoryId ?? ""}
            >
              <option value="">No primary category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {formatCategoryLabel(category)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Subcategory
            </span>
            <input
              className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              disabled={disabled}
              onChange={(event) => onSubcategoryChange(event.target.value)}
              type="text"
              value={subcategory}
            />
          </label>

          <fieldset className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-sm font-medium text-foreground">
                Related categories
              </legend>
              <p className="text-xs tracking-[0.12em] text-muted uppercase">
                {relatedCategoryIds.length} selected
              </p>
            </div>

            {availableRelatedCategories.length > 0 ? (
              <div className="max-h-56 overflow-y-auto rounded-2xl border border-border bg-white/75 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableRelatedCategories.map((category) => {
                    const isSelected = relatedCategoryIds.includes(category.id);

                    return (
                      <label
                        key={category.id}
                        className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${
                          isSelected
                            ? "border-accent/30 bg-accent/10 text-accent-strong"
                            : "border-border bg-white/80 text-foreground hover:border-accent/25"
                        } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
                      >
                        <input
                          checked={isSelected}
                          className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent/20"
                          disabled={disabled}
                          onChange={() => onToggleRelatedCategory(category.id)}
                          type="checkbox"
                        />
                        <span>{formatCategoryLabel(category)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-white/70 px-4 py-4 text-sm text-muted">
                No additional categories are available.
              </div>
            )}
          </fieldset>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Related categories reasoning
            </span>
            <textarea
              className="min-h-32 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              disabled={disabled}
              onChange={(event) =>
                onRelatedCategoriesReasoningChange(event.target.value)
              }
              value={relatedCategoriesReasoning}
            />
          </label>
        </div>
      )}
    </section>
  );
}