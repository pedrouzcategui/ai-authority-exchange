"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BusinessContactDialog } from "@/components/business-contact-dialog";
import {
  createContactFormState,
  type BusinessContactFormState,
  validateBusinessContactState,
} from "@/lib/business-contact-form";
import type { BusinessContactDirectoryRow } from "@/lib/matches";

type EditBusinessContactModalProps = {
  contact: BusinessContactDirectoryRow;
};

type BusinessContactRole = "marketer" | "expert";

function getRoleLabel(role: BusinessContactRole) {
  return role === "marketer" ? "Marketer" : "Expert";
}

function getAssignedBusinesses(contact: BusinessContactDirectoryRow) {
  return contact.role === "marketer"
    ? contact.marketerForBusinesses
    : contact.expertForBusinesses;
}

export function EditBusinessContactModal({
  contact,
}: EditBusinessContactModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<BusinessContactRole>(contact.role);
  const [contactState, setContactState] = useState<BusinessContactFormState>(
    () => createContactFormState(contact),
  );
  const assignedBusinesses = getAssignedBusinesses(contact);
  const isRoleLocked = assignedBusinesses.length > 0;
  const roleLabel = getRoleLabel(role);

  function syncFormWithContact() {
    setRole(contact.role);
    setContactState(createContactFormState(contact));
  }

  function openModal() {
    syncFormWithContact();
    setIsOpen(true);
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    syncFormWithContact();
  }

  function handleFieldChange(
    field: "email" | "firstName" | "lastName",
    value: string,
  ) {
    setContactState((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  function handleSave() {
    const validation = validateBusinessContactState(roleLabel, {
      ...contactState,
      mode: "existing",
      selectedContactId: contact.id,
    });

    if (!validation.isValid) {
      toast.error(
        validation.errorMessage ??
          `Please provide a valid ${roleLabel.toLocaleLowerCase()}.`,
      );
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/business-contacts/${contact.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: validation.email,
          firstName: contactState.firstName.trim(),
          lastName: contactState.lastName.trim() || null,
          role,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "The contact could not be updated.");
        return;
      }

      toast.success(payload?.message ?? "Contact updated successfully.");
      setIsOpen(false);
      router.refresh();
    });
  }

  const extraFields: ReactNode = (
    <div className="space-y-3">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Role</span>
        <select
          className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          disabled={isPending || isRoleLocked}
          onChange={(event) =>
            setRole(event.target.value as BusinessContactRole)
          }
          value={role}
        >
          <option value="marketer">Marketer</option>
          <option value="expert">Expert</option>
        </select>
      </label>

      {isRoleLocked ? (
        <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-950">
          This contact is currently assigned to {assignedBusinesses.length}{" "}
          business{assignedBusinesses.length === 1 ? "" : "es"} as a{" "}
          {contact.role}. Clear those assignments before changing the role.
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <button
        className="inline-flex items-center rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
        onClick={openModal}
        type="button"
      >
        Edit
      </button>

      <BusinessContactDialog
        description="Update a global marketer or expert contact. Changes apply anywhere this contact is used."
        extraFields={extraFields}
        footerNote="Saving here updates the contact everywhere it is assigned."
        isBusy={isPending}
        isOpen={isOpen}
        onClose={closeModal}
        onFieldChange={handleFieldChange}
        onSave={handleSave}
        roleLabel={roleLabel}
        saveLabel="Save contact"
        state={{
          ...contactState,
          mode: "existing",
          selectedContactId: contact.id,
        }}
      />
    </>
  );
}
