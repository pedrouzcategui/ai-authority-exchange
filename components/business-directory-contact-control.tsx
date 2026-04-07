"use client";

import { PlusIcon, SaveIcon, TrashIcon } from "@/components/action-icons";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BusinessDirectoryContact } from "@/lib/matches";

type BusinessDirectoryContactControlProps = {
  availableContacts: BusinessDirectoryContact[];
  businessId: number;
  businessName: string;
  initialContacts: BusinessDirectoryContact[];
  role: "marketer" | "expert";
};

function LoadingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-muted">
      <span
        aria-hidden="true"
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/25 border-t-current"
      />
      <span>{label}</span>
    </div>
  );
}

function getContactDisplayName(contact: BusinessDirectoryContact | null) {
  if (!contact) {
    return null;
  }

  if (contact.fullName && contact.fullName.trim().length > 0) {
    return contact.fullName.trim();
  }

  const fullName = [contact.firstName, contact.lastName]
    .filter((value): value is string =>
      Boolean(value && value.trim().length > 0),
    )
    .join(" ")
    .trim();

  if (fullName.length > 0) {
    return fullName;
  }

  if (contact.email && contact.email.trim().length > 0) {
    return contact.email.trim();
  }

  return `Contact ${contact.id}`;
}

function getSelectClassName(role: "marketer" | "expert") {
  return role === "marketer"
    ? "border-[#e7b16a] bg-[#fff2de] text-[#9a5613] hover:border-[#d28a35] hover:text-[#7d430d]"
    : "border-[#b7caec] bg-[#edf4ff] text-[#2f5b98] hover:border-[#7f9fd6] hover:text-[#234879]";
}

export function BusinessDirectoryContactControl({
  availableContacts,
  businessId,
  businessName,
  initialContacts,
  role,
}: BusinessDirectoryContactControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticContactIds, setOptimisticContactIds] = useState<
    number[] | undefined
  >(undefined);
  const [isAdding, setIsAdding] = useState(false);
  const [nextContactId, setNextContactId] = useState("");
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const roleLabel = role === "marketer" ? "Marketer" : "Expert";
  const selectedContactIds =
    optimisticContactIds ?? initialContacts.map((contact) => contact.id);
  const selectedContacts = selectedContactIds
    .map(
      (contactId) =>
        availableContacts.find((contact) => contact.id === contactId) ??
        initialContacts.find((contact) => contact.id === contactId) ??
        null,
    )
    .filter((contact): contact is BusinessDirectoryContact => contact !== null);
  const availableToAdd = availableContacts.filter(
    (contact) => !selectedContactIds.includes(contact.id),
  );

  function persistContactIds(nextIds: number[]) {
    setOptimisticContactIds(nextIds);
    setPendingLabel(`Updating ${roleLabel.toLocaleLowerCase()}s...`);

    startTransition(async () => {
      const response = await fetch(
        `/api/businesses/${businessId}/contacts/${role}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contactIds: nextIds }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setOptimisticContactIds(undefined);
        setPendingLabel(null);
        toast.error(
          payload?.error ??
            `The ${roleLabel.toLocaleLowerCase()} could not be updated.`,
        );
        return;
      }

      setOptimisticContactIds(undefined);
      setIsAdding(false);
      setNextContactId("");
      setPendingLabel(null);
      toast.success(
        payload?.message ??
          `${businessName} ${roleLabel.toLocaleLowerCase()} updated successfully.`,
      );
      router.refresh();
    });
  }

  function handleReplace(index: number, nextValue: string) {
    const parsedContactId = Number.parseInt(nextValue, 10);

    if (!Number.isInteger(parsedContactId)) {
      return;
    }

    const nextIds = [...selectedContactIds];
    nextIds[index] = parsedContactId;
    persistContactIds([...new Set(nextIds)]);
  }

  function handleRemove(contactId: number) {
    persistContactIds(selectedContactIds.filter((id) => id !== contactId));
  }

  function handleInitialSelect(nextValue: string) {
    const parsedContactId = Number.parseInt(nextValue, 10);

    if (!Number.isInteger(parsedContactId)) {
      return;
    }

    persistContactIds([parsedContactId]);
  }

  function handleAdd() {
    const parsedContactId = Number.parseInt(nextContactId, 10);

    if (!Number.isInteger(parsedContactId)) {
      return;
    }

    persistContactIds([...selectedContactIds, parsedContactId]);
  }

  function handleCancelAdd() {
    setIsAdding(false);
    setNextContactId("");
  }

  return (
    <div className="min-w-70 space-y-3">
      {isPending && pendingLabel ? <LoadingIndicator label={pendingLabel} /> : null}

      {selectedContacts.length > 0 ? (
        selectedContacts.map((contact, index) => {
          const availableOptions = availableContacts.filter(
            (candidate) =>
              candidate.id === contact.id ||
              !selectedContactIds.includes(candidate.id),
          );

          return (
            <div key={`${role}-${contact.id}`} className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <select
                  aria-label={`${roleLabel} ${index + 1} for ${businessName}`}
                  className={`min-h-10 w-full appearance-none rounded-full border px-4 pr-10 pl-4 text-sm font-semibold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${getSelectClassName(
                    role,
                  )}`}
                  disabled={isPending}
                  onChange={(event) => handleReplace(index, event.target.value)}
                  value={contact.id.toString()}
                >
                  {availableOptions.map((option) => (
                    <option key={option.id} value={option.id.toString()}>
                      {getContactDisplayName(option)}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-current"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <path d="m7 10 5 5 5-5" />
                </svg>
              </div>
              <button
                aria-label={`Remove ${getContactDisplayName(contact)} from ${businessName}`}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${getSelectClassName(
                  role,
                )}`}
                disabled={isPending}
                onClick={() => handleRemove(contact.id)}
                type="button"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          );
        })
      ) : null}

      {selectedContacts.length === 0 && availableToAdd.length > 0 ? (
        <div className="relative min-w-0">
          <select
            aria-label={`Select first ${roleLabel.toLocaleLowerCase()} for ${businessName}`}
            className={`min-h-10 w-full appearance-none rounded-full border px-4 pr-10 pl-4 text-sm font-medium outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${getSelectClassName(
              role,
            )}`}
            disabled={isPending}
            onChange={(event) => handleInitialSelect(event.target.value)}
            value=""
          >
            <option value="">{`Select ${roleLabel.toLocaleLowerCase()}`}</option>
            {availableToAdd.map((contact) => (
              <option key={contact.id} value={contact.id.toString()}>
                {getContactDisplayName(contact)}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-current"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="m7 10 5 5 5-5" />
          </svg>
        </div>
      ) : null}

      {selectedContacts.length > 0 && availableToAdd.length > 0 && isAdding ? (
        <div className="space-y-3">
          <div className="relative min-w-0">
            <select
              aria-label={`Add ${roleLabel.toLocaleLowerCase()} to ${businessName}`}
              className={`min-h-10 w-full appearance-none rounded-full border px-4 pr-10 pl-4 text-sm font-medium outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${getSelectClassName(
                role,
              )}`}
              disabled={isPending}
              onChange={(event) => setNextContactId(event.target.value)}
              value={nextContactId}
            >
              <option value="">
                {`Select ${roleLabel.toLocaleLowerCase()} to add`}
              </option>
              {availableToAdd.map((contact) => (
                <option key={contact.id} value={contact.id.toString()}>
                  {getContactDisplayName(contact)}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-current"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path d="m7 10 5 5 5-5" />
            </svg>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${getSelectClassName(
                  role,
                )}`}
                disabled={isPending || nextContactId === ""}
                onClick={handleAdd}
                type="button"
              >
                <SaveIcon className="h-4 w-4" />
                Add
              </button>

              <button
                className={`inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${getSelectClassName(
                  role,
                )}`}
                disabled={isPending}
                onClick={handleCancelAdd}
                type="button"
              >
                Cancel
              </button>
            </div>
        </div>
      ) : null}

      {selectedContacts.length > 0 && availableToAdd.length > 0 && !isAdding ? (
        <button
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${getSelectClassName(
            role,
          )}`}
          disabled={isPending}
          onClick={() => setIsAdding(true)}
          type="button"
        >
          <SaveIcon className="h-4 w-4" />
          Add {roleLabel.toLocaleLowerCase()}
        </button>
      ) : null}
    </div>
  );
}
