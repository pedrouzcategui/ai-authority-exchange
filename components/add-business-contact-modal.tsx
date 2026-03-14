"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BusinessContactDialog } from "@/components/business-contact-dialog";
import {
  createEmptyContactFormState,
  type BusinessContactFormState,
  validateBusinessContactState,
} from "@/lib/business-contact-form";

type BusinessContactRole = "marketer" | "expert";

function getRoleLabel(role: BusinessContactRole) {
  return role === "marketer" ? "Marketer" : "Expert";
}

export function AddBusinessContactModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<BusinessContactRole>("marketer");
  const [contactState, setContactState] = useState<BusinessContactFormState>(
    () => ({
      ...createEmptyContactFormState(),
      mode: "new",
    }),
  );

  const roleLabel = getRoleLabel(role);

  function resetForm() {
    setRole("marketer");
    setContactState({
      ...createEmptyContactFormState(),
      mode: "new",
    });
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    resetForm();
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
      mode: "new",
    });

    if (!validation.isValid) {
      toast.error(
        validation.errorMessage ??
          `Please provide a valid ${roleLabel.toLocaleLowerCase()}.`,
      );
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/business-contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: contactState.email.trim(),
          firstName: contactState.firstName.trim(),
          lastName: contactState.lastName.trim(),
          role,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "The contact could not be created.");
        return;
      }

      toast.success(payload?.message ?? `${roleLabel} created successfully.`);
      setIsOpen(false);
      resetForm();
      router.refresh();
    });
  }

  const extraFields: ReactNode = (
    <div className="grid gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Role</span>
        <select
          className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          disabled={isPending}
          onChange={(event) =>
            setRole(event.target.value as BusinessContactRole)
          }
          value={role}
        >
          <option value="marketer">Marketer</option>
          <option value="expert">Expert</option>
        </select>
      </label>
    </div>
  );

  return (
    <>
      <button
        className="inline-flex items-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Add Marketer / Expert
      </button>

      <BusinessContactDialog
        description="Create a marketer or expert contact. It will be available in the business directory dropdowns immediately after save."
        extraFields={extraFields}
        footerNote="Saving here creates the contact only. Assignment happens later from the business directory dropdowns."
        isBusy={isPending}
        isOpen={isOpen}
        onClose={closeModal}
        onFieldChange={handleFieldChange}
        onSave={handleSave}
        roleLabel={roleLabel}
        saveLabel={`Create ${roleLabel}`}
        state={{
          ...contactState,
          mode: "new",
        }}
      />
    </>
  );
}
