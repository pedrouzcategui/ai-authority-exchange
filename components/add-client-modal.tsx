"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BusinessContactDialog } from "@/components/business-contact-dialog";
import { BusinessContactFields } from "@/components/business-contact-fields";
import type { ExchangeParticipationStatus } from "@/lib/ai-authority-exchange";
import {
  createContactFormState,
  createEmptyContactFormState,
  type BusinessContactFormState,
  validateBusinessContactState,
} from "@/lib/business-contact-form";
import type { BusinessContactOption } from "@/lib/matches";
import { ExchangeParticipationFields } from "@/components/exchange-participation-fields";

type AddClientModalProps = {
  contacts: BusinessContactOption[];
};

type BusinessContact = BusinessContactOption;
type BusinessContactField = "email" | "firstName" | "lastName";
type BusinessContactRole = BusinessContact["role"];

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

function normalizeContactText(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function buildContactFullName(
  firstName: string | null,
  lastName: string | null,
) {
  const fullName = [firstName, lastName]
    .filter((value): value is string => value !== null && value.length > 0)
    .join(" ")
    .trim();

  return fullName.length > 0 ? fullName : null;
}

function getBusinessContactsByRole(
  contacts: BusinessContactOption[],
  role: BusinessContactRole,
) {
  return contacts.filter((contact) => contact.role === role);
}

function mergeSelectedContactState(
  contacts: BusinessContact[],
  state: BusinessContactFormState,
) {
  if (state.mode !== "existing" || state.selectedContactId === null) {
    return contacts;
  }

  const email = normalizeContactText(state.email);
  const firstName = normalizeContactText(state.firstName);
  const lastName = normalizeContactText(state.lastName);

  return contacts.map((contact) =>
    contact.id === state.selectedContactId
      ? {
          ...contact,
          email,
          firstName,
          fullName: buildContactFullName(firstName, lastName),
          lastName,
        }
      : contact,
  );
}

function normalizeContactStateForPayload(state: BusinessContactFormState) {
  const email = state.email.trim().toLocaleLowerCase();

  return {
    email: email.length > 0 ? email : null,
    firstName: normalizeContactText(state.firstName),
    lastName: normalizeContactText(state.lastName),
    selectedContactId:
      state.mode === "existing" ? state.selectedContactId : null,
  };
}

export function AddClientModal({ contacts }: AddClientModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [exchangeParticipationStatus, setExchangeParticipationStatus] =
    useState<ExchangeParticipationStatus>("not-participating");
  const [name, setName] = useState("");
  const [role, setRole] =
    useState<(typeof roleOptions)[number]["value"]>("partner");
  const [aiAuthorityExchangeRetiredAt, setAiAuthorityExchangeRetiredAt] =
    useState("");
  const [
    aiAuthorityExchangeRetiredRoundSequenceNumber,
    setAiAuthorityExchangeRetiredRoundSequenceNumber,
  ] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [marketerContact, setMarketerContact] = useState(() =>
    createEmptyContactFormState(),
  );
  const [expertContact, setExpertContact] = useState(() =>
    createEmptyContactFormState(),
  );
  const [contactDialogRole, setContactDialogRole] =
    useState<BusinessContactRole | null>(null);
  const [contactDialogState, setContactDialogState] = useState(() =>
    createEmptyContactFormState(),
  );
  const marketerContacts = mergeSelectedContactState(
    getBusinessContactsByRole(contacts, "marketer"),
    marketerContact,
  );
  const expertContacts = mergeSelectedContactState(
    getBusinessContactsByRole(contacts, "expert"),
    expertContact,
  );

  function resetForm() {
    setExchangeParticipationStatus("not-participating");
    setName("");
    setRole("partner");
    setAiAuthorityExchangeRetiredAt("");
    setAiAuthorityExchangeRetiredRoundSequenceNumber("");
    setWebsiteUrl("");
    setMarketerContact(createEmptyContactFormState());
    setExpertContact(createEmptyContactFormState());
    setContactDialogRole(null);
    setContactDialogState(createEmptyContactFormState());
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

    const marketerValidation = validateBusinessContactState(
      "Marketer",
      marketerContact,
    );
    const expertValidation = validateBusinessContactState(
      "Expert",
      expertContact,
    );

    if (!marketerValidation.isValid || !expertValidation.isValid) {
      toast.error(
        marketerValidation.errorMessage ??
          expertValidation.errorMessage ??
          "Please provide valid contact details before saving.",
      );
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
        body: JSON.stringify({
          aiAuthorityExchangeRetiredAt:
            exchangeParticipationStatus === "retired"
              ? aiAuthorityExchangeRetiredAt
              : null,
          aiAuthorityExchangeRetiredRoundSequenceNumber:
            exchangeParticipationStatus === "retired" &&
            aiAuthorityExchangeRetiredRoundSequenceNumber.trim() !== ""
              ? Number(aiAuthorityExchangeRetiredRoundSequenceNumber)
              : null,
          expertContact: normalizeContactStateForPayload(expertContact),
          exchangeParticipationStatus,
          marketerContact: normalizeContactStateForPayload(marketerContact),
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
        toast.error(payload?.error ?? "The business could not be created.");
        return;
      }

      toast.success(payload?.message ?? "Business added successfully.");
      setIsOpen(false);
      resetForm();
      router.refresh();
    });
  }

  function getContactStateByRole(role: BusinessContactRole) {
    return role === "marketer" ? marketerContact : expertContact;
  }

  function setContactStateByRole(
    role: BusinessContactRole,
    nextState:
      | BusinessContactFormState
      | ((currentValue: BusinessContactFormState) => BusinessContactFormState),
  ) {
    const setState =
      role === "marketer" ? setMarketerContact : setExpertContact;
    setState(nextState);
  }

  function handleContactSelectionChange(
    role: BusinessContactRole,
    nextValue: string,
  ) {
    if (nextValue === "draft") {
      return;
    }

    const availableContacts =
      role === "marketer" ? marketerContacts : expertContacts;

    if (nextValue === "none") {
      setContactStateByRole(role, createEmptyContactFormState());
      return;
    }

    const parsedContactId = Number.parseInt(nextValue, 10);

    if (!Number.isInteger(parsedContactId)) {
      setContactStateByRole(role, createEmptyContactFormState());
      return;
    }

    const selectedContact = availableContacts.find(
      (contact) => contact.id === parsedContactId,
    );

    setContactStateByRole(role, createContactFormState(selectedContact));
  }

  function openContactDialog(role: BusinessContactRole) {
    const currentState = getContactStateByRole(role);

    setContactDialogState(
      currentState.mode === "none"
        ? {
            ...createEmptyContactFormState(),
            mode: "new",
          }
        : currentState,
    );
    setContactDialogRole(role);
  }

  function closeContactDialog() {
    if (isPending) {
      return;
    }

    setContactDialogRole(null);
    setContactDialogState(createEmptyContactFormState());
  }

  function handleContactDialogFieldChange(
    field: BusinessContactField,
    value: string,
  ) {
    setContactDialogState((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  function handleSaveContactDialog() {
    if (contactDialogRole === null) {
      return;
    }

    const roleLabel = contactDialogRole === "marketer" ? "Marketer" : "Expert";
    const validation = validateBusinessContactState(
      roleLabel,
      contactDialogState,
    );

    if (!validation.isValid) {
      toast.error(
        validation.errorMessage ??
          `Please provide a valid ${roleLabel.toLocaleLowerCase()}.`,
      );
      return;
    }

    setContactStateByRole(contactDialogRole, {
      ...contactDialogState,
      email: contactDialogState.email.trim(),
      firstName: contactDialogState.firstName.trim(),
      lastName: contactDialogState.lastName.trim(),
      mode: contactDialogState.selectedContactId === null ? "new" : "existing",
    });
    setContactDialogRole(null);
    setContactDialogState(createEmptyContactFormState());
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(51,71,91,0.36)] px-4 py-8 backdrop-blur-sm">
          <div className="h-[80vh] w-full max-w-2xl overflow-y-auto rounded-4xl border border-border bg-surface p-6 shadow-(--shadow) sm:p-8">
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

              <BusinessContactFields
                disabled={isPending}
                expertContacts={expertContacts}
                expertState={expertContact}
                marketerContacts={marketerContacts}
                marketerState={marketerContact}
                onExpertCreateRequested={() => openContactDialog("expert")}
                onExpertEditRequested={() => openContactDialog("expert")}
                onExpertSelectionChange={(nextValue) =>
                  handleContactSelectionChange("expert", nextValue)
                }
                onMarketerCreateRequested={() =>
                  openContactDialog("marketer")
                }
                onMarketerEditRequested={() =>
                  openContactDialog("marketer")
                }
                onMarketerSelectionChange={(nextValue) =>
                  handleContactSelectionChange("marketer", nextValue)
                }
              />

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

              <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-muted">
                  Use the role for client vs partner, and use the exchange
                  status to control whether the business appears in future round
                  drafts or is tracked as retired.
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

      <BusinessContactDialog
        isBusy={isPending}
        isOpen={contactDialogRole !== null}
        onClose={closeContactDialog}
        onFieldChange={handleContactDialogFieldChange}
        onSave={handleSaveContactDialog}
        roleLabel={contactDialogRole === "marketer" ? "Marketer" : "Expert"}
        state={contactDialogState}
      />
    </>
  );
}
