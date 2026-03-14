"use client";

import type { BusinessContactFormState } from "@/lib/business-contact-form";
import type { BusinessContactOption } from "@/lib/matches";

export type { BusinessContactFormState } from "@/lib/business-contact-form";

type ContactSectionProps = {
  contacts: BusinessContactOption[];
  description: string;
  disabled: boolean;
  onCreateRequested: () => void;
  onEditRequested: () => void;
  onSelectionChange: (nextValue: string) => void;
  roleLabel: string;
  state: BusinessContactFormState;
};

type BusinessContactFieldsProps = {
  disabled: boolean;
  duplicateSelectionWarning?: string | null;
  expertContacts: BusinessContactOption[];
  expertState: BusinessContactFormState;
  marketerContacts: BusinessContactOption[];
  marketerState: BusinessContactFormState;
  onExpertCreateRequested: () => void;
  onExpertEditRequested: () => void;
  onExpertSelectionChange: (nextValue: string) => void;
  onMarketerCreateRequested: () => void;
  onMarketerEditRequested: () => void;
  onMarketerSelectionChange: (nextValue: string) => void;
};

function formatContactSummaryValue(value: string) {
  return value.trim().length > 0 ? value : "Not set";
}

function getContactDisplayName(contact: BusinessContactOption) {
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

  return `Contact ${contact.id}`;
}

function getContactOptionLabel(contact: BusinessContactOption) {
  const displayName = getContactDisplayName(contact);

  if (contact.email && contact.email.trim().length > 0) {
    return `${displayName} (${contact.email.trim()})`;
  }

  return displayName;
}

function getDraftContactOptionLabel(
  roleLabel: string,
  state: BusinessContactFormState,
) {
  const draftName = [state.firstName.trim(), state.lastName.trim()]
    .filter((value) => value.length > 0)
    .join(" ")
    .trim();
  const draftEmail = state.email.trim();

  if (draftName.length > 0 && draftEmail.length > 0) {
    return `${draftName} (${draftEmail})`;
  }

  if (draftName.length > 0) {
    return draftName;
  }

  if (draftEmail.length > 0) {
    return draftEmail;
  }

  return `New ${roleLabel.toLocaleLowerCase()} to be created`;
}

function ContactSection({
  contacts,
  description,
  disabled,
  onCreateRequested,
  onEditRequested,
  onSelectionChange,
  roleLabel,
  state,
}: ContactSectionProps) {
  const hasSavedContacts = contacts.length > 0;
  const hasDraftContact = state.mode === "new";
  const hasSelectedContact = state.mode !== "none";

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-white/55 p-4 sm:p-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{roleLabel}</h3>
        <p className="text-sm leading-6 text-muted">{description}</p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">
          Selected {roleLabel.toLocaleLowerCase()}
        </span>
        <select
          className="min-h-12 w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          disabled={disabled}
          onChange={(event) => onSelectionChange(event.target.value)}
          value={
            state.mode === "none"
              ? "none"
              : state.mode === "new"
                ? "draft"
                : (state.selectedContactId?.toString() ?? "none")
          }
        >
          <option value="none">None selected</option>
          {hasDraftContact ? (
            <option value="draft">
              {getDraftContactOptionLabel(roleLabel, state)}
            </option>
          ) : null}
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id.toString()}>
              {getContactOptionLabel(contact)}
            </option>
          ))}
        </select>
      </label>

      {hasSelectedContact ? (
        <div className="rounded-2xl border border-border bg-white/80 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
                First name
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {formatContactSummaryValue(state.firstName)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
                Last name
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {formatContactSummaryValue(state.lastName)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
              Email
            </p>
            <p className="mt-2 text-sm font-medium text-foreground break-all">
              {formatContactSummaryValue(state.email)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/88 px-4 py-2.5 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          onClick={onCreateRequested}
          type="button"
        >
          Create new {roleLabel.toLocaleLowerCase()}
        </button>

        {hasSelectedContact ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/88 px-4 py-2.5 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            onClick={onEditRequested}
            type="button"
          >
            {hasDraftContact
              ? `Review new ${roleLabel.toLocaleLowerCase()}`
              : `Edit ${roleLabel.toLocaleLowerCase()}`}
          </button>
        ) : null}
      </div>

      <p className="text-sm leading-6 text-muted">
        {state.mode === "none"
          ? hasSavedContacts
            ? `Select a saved ${roleLabel.toLocaleLowerCase()} or create a new one to assign it to this business.`
            : `No saved ${roleLabel.toLocaleLowerCase()} contacts exist yet. Use Create new to add one in a separate dialog.`
          : state.mode === "new"
            ? `Saving the business will create this new ${roleLabel.toLocaleLowerCase()} contact.`
            : `Saving will update the selected ${roleLabel.toLocaleLowerCase()} contact.`}
      </p>
    </section>
  );
}

export function BusinessContactFields({
  disabled,
  duplicateSelectionWarning,
  expertContacts,
  expertState,
  marketerContacts,
  marketerState,
  onExpertCreateRequested,
  onExpertEditRequested,
  onExpertSelectionChange,
  onMarketerCreateRequested,
  onMarketerEditRequested,
  onMarketerSelectionChange,
}: BusinessContactFieldsProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-border bg-surface-muted/75 p-4 sm:p-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">
          Business contacts
        </h3>
        <p className="text-sm leading-6 text-muted">
          Assign the marketer and expert who will represent this business in
          authority exchange communications.
        </p>
      </div>

      {duplicateSelectionWarning ? (
        <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-950">
          {duplicateSelectionWarning}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ContactSection
          contacts={marketerContacts}
          description="Choose the marketer contact for this business, or create one if it has not been added yet."
          disabled={disabled}
          onCreateRequested={onMarketerCreateRequested}
          onEditRequested={onMarketerEditRequested}
          onSelectionChange={onMarketerSelectionChange}
          roleLabel="Marketer"
          state={marketerState}
        />
        <ContactSection
          contacts={expertContacts}
          description="Choose the expert contact for this business, or create one if it has not been added yet."
          disabled={disabled}
          onCreateRequested={onExpertCreateRequested}
          onEditRequested={onExpertEditRequested}
          onSelectionChange={onExpertSelectionChange}
          roleLabel="Expert"
          state={expertState}
        />
      </div>
    </section>
  );
}
