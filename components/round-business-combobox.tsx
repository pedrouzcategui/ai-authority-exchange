"use client";

import {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type RoundBusinessComboboxOption = {
  categoryLabel: string;
  description: string;
  label: string;
  matchClassName: string;
  matchLabel: string;
  value: string;
};

type RoundBusinessComboboxProps = {
  disabled?: boolean;
  emptyMessage?: string;
  options: RoundBusinessComboboxOption[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

type PanelPosition = {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : "rotate-0"}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 text-muted"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 text-accent"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m5 12 4.2 4.2L19 7.5" />
    </svg>
  );
}

function getSearchValue(option: RoundBusinessComboboxOption) {
  return [
    option.label,
    option.categoryLabel,
    option.description,
    option.matchLabel,
  ]
    .join(" ")
    .toLocaleLowerCase();
}

function getPanelPosition(triggerElement: HTMLButtonElement): PanelPosition {
  const rect = triggerElement.getBoundingClientRect();
  const viewportPadding = 12;
  const desiredWidth = Math.max(rect.width, 360);
  const width = Math.min(desiredWidth, window.innerWidth - viewportPadding * 2);
  const left = Math.min(
    Math.max(viewportPadding, rect.left),
    window.innerWidth - width - viewportPadding,
  );
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
  const spaceAbove = rect.top - viewportPadding;
  const shouldOpenAbove = spaceBelow < 260 && spaceAbove > spaceBelow;

  if (shouldOpenAbove) {
    return {
      left,
      maxHeight: Math.max(180, Math.min(420, spaceAbove - 8)),
      top: Math.max(viewportPadding, rect.top - Math.min(420, spaceAbove - 8) - 8),
      width,
    };
  }

  return {
    left,
    maxHeight: Math.max(180, Math.min(420, spaceBelow - 8)),
    top: rect.bottom + 8,
    width,
  };
}

export function RoundBusinessCombobox({
  disabled = false,
  emptyMessage = "No businesses match the current search.",
  options,
  placeholder,
  value,
  onChange,
}: RoundBusinessComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const deferredQuery = useDeferredValue(query);
  const listboxId = useId();
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const filteredOptions = options.filter((option) => {
    if (!normalizedQuery) {
      return true;
    }

    return getSearchValue(option).includes(normalizedQuery);
  });

  function openPanel() {
    setIsOpen(true);
  }

  function closePanel() {
    setIsOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (!isOpen || !buttonRef.current) {
      return;
    }

    const syncPosition = () => {
      if (!buttonRef.current) {
        return;
      }

      setPanelPosition(getPanelPosition(buttonRef.current));
    };

    syncPosition();
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);

    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    searchInputRef.current?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      closePanel();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    closePanel();
  }

  return (
    <>
      <button
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-white/88 px-4 py-3 text-left outline-none transition hover:border-accent/70 hover:bg-white focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-muted"
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            closePanel();
            return;
          }

          openPanel();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPanel();
          }
        }}
        ref={buttonRef}
        type="button"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {selectedOption?.label ?? placeholder}
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
            {selectedOption
              ? `${selectedOption.matchLabel} • ${selectedOption.categoryLabel}`
              : "Choose a business"}
          </span>
        </span>
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && panelPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              className="z-[90]"
              style={{
                left: panelPosition.left,
                position: "fixed",
                top: panelPosition.top,
                width: panelPosition.width,
              }}
            >
              <div
                className="overflow-hidden rounded-[1.5rem] border border-border bg-[rgba(255,255,255,0.97)] shadow-[0_24px_80px_rgba(51,71,91,0.18)] backdrop-blur-xl"
                ref={panelRef}
              >
                <div className="border-b border-border/70 px-3 py-3">
                  <label className="flex items-center gap-2 rounded-2xl border border-border bg-white/88 px-3 py-2.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
                    <SearchIcon />
                    <input
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search businesses, category, or match tier"
                      ref={searchInputRef}
                      value={query}
                    />
                  </label>
                </div>

                <div
                  className="space-y-2 overflow-y-auto p-3"
                  id={listboxId}
                  role="listbox"
                  style={{ maxHeight: panelPosition.maxHeight }}
                >
                  {value ? (
                    <button
                      className="flex w-full items-center justify-between rounded-2xl border border-dashed border-border bg-white/70 px-3 py-3 text-left text-sm font-medium text-muted transition hover:border-accent/60 hover:text-foreground"
                      onClick={() => handleSelect("")}
                      type="button"
                    >
                      <span>Clear selection</span>
                    </button>
                  ) : null}

                  {filteredOptions.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-white/65 px-4 py-6 text-center text-sm text-muted">
                      {emptyMessage}
                    </div>
                  ) : (
                    filteredOptions.map((option) => {
                      const isSelected = option.value === value;

                      return (
                        <button
                          aria-selected={isSelected}
                          className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${isSelected ? "border-accent/60 bg-accent/8" : "border-border bg-white/72 hover:border-accent/45 hover:bg-brand-deep-soft/30"}`}
                          key={option.value}
                          onClick={() => handleSelect(option.value)}
                          role="option"
                          type="button"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-foreground">
                              {option.label}
                            </span>
                            <span className="mt-1 block text-xs font-medium text-foreground/80">
                              {option.categoryLabel}
                            </span>
                            <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted">
                              {option.description}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 pt-0.5">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase ${option.matchClassName}`}
                            >
                              {option.matchLabel}
                            </span>
                            {isSelected ? <CheckIcon /> : null}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}