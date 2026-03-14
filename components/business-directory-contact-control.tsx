"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BusinessDirectoryContact } from "@/lib/matches";

type BusinessDirectoryContactControlProps = {
  availableContacts: BusinessDirectoryContact[];
  businessId: number;
  businessName: string;
  initialContact: BusinessDirectoryContact | null;
  role: "marketer" | "expert";
};

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

function getSelectClassName(role: "marketer" | "expert", hasContact: boolean) {
  if (!hasContact) {
    return "border-[#c3ceda] bg-[#f1f5f8] text-[#55697e] hover:border-brand-deep focus:border-brand-deep focus:ring-brand-deep/15";
  }

  return role === "marketer"
    ? "border-[#e7b16a] bg-[#fff2de] text-[#9a5613] hover:border-[#d28a35] hover:text-[#7d430d]"
    : "border-[#b7caec] bg-[#edf4ff] text-[#2f5b98] hover:border-[#7f9fd6] hover:text-[#234879]";
}

export function BusinessDirectoryContactControl({
  availableContacts,
  businessId,
  businessName,
  initialContact,
  role,
}: BusinessDirectoryContactControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticContactId, setOptimisticContactId] = useState<
    number | null | undefined
  >(undefined);
  const roleLabel = role === "marketer" ? "Marketer" : "Expert";
  const selectedContactId =
    optimisticContactId === undefined
      ? (initialContact?.id ?? null)
      : optimisticContactId;
  const selectedContact =
    availableContacts.find((contact) => contact.id === selectedContactId) ??
    initialContact ??
    null;

  function handleChange(nextValue: string) {
    const parsedContactId =
      nextValue === "none" ? null : Number.parseInt(nextValue, 10);

    if (nextValue !== "none" && !Number.isInteger(parsedContactId)) {
      return;
    }

    setOptimisticContactId(parsedContactId);

    startTransition(async () => {
      const response = await fetch(
        `/api/businesses/${businessId}/contacts/${role}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ selectedContactId: parsedContactId }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setOptimisticContactId(undefined);
        toast.error(
          payload?.error ??
            `The ${roleLabel.toLocaleLowerCase()} could not be updated.`,
        );
        return;
      }

      setOptimisticContactId(undefined);
      toast.success(
        payload?.message ??
          `${businessName} ${roleLabel.toLocaleLowerCase()} updated successfully.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="relative min-w-44">
      <select
        aria-label={`${roleLabel} for ${businessName}`}
        className={`min-h-10 w-full appearance-none rounded-full border px-4 pr-10 pl-4 text-sm font-semibold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${getSelectClassName(
          role,
          selectedContact !== null,
        )}`}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        value={selectedContactId?.toString() ?? "none"}
      >
        <option value="none">No {roleLabel.toLocaleLowerCase()}</option>
        {availableContacts.map((contact) => (
          <option key={contact.id} value={contact.id.toString()}>
            {getContactDisplayName(contact)}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-5 right-4 h-4 w-4 -translate-y-1/2 text-current"
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
  );
}
