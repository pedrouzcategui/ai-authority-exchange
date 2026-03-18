export type BusinessContactFormState = {
  email: string;
  firstName: string;
  lastName: string;
  mode: "existing" | "new" | "none";
  selectedContactId: number | null;
};

type BusinessContactFormSeed = {
  email: string | null;
  firstName: string | null;
  id: number;
  lastName: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createEmptyContactFormState(): BusinessContactFormState {
  return {
    email: "",
    firstName: "",
    lastName: "",
    mode: "none",
    selectedContactId: null,
  };
}

export function createContactFormState(
  contact: BusinessContactFormSeed | null | undefined,
): BusinessContactFormState {
  if (!contact) {
    return createEmptyContactFormState();
  }

  return {
    email: contact.email ?? "",
    firstName: contact.firstName ?? "",
    lastName: contact.lastName ?? "",
    mode: "existing",
    selectedContactId: contact.id,
  };
}

export function validateBusinessContactState(
  roleLabel: string,
  state: BusinessContactFormState,
) {
  if (state.mode === "none") {
    return {
      email: null,
      errorMessage: null,
      isValid: true,
    } as const;
  }

  const firstName = state.firstName.trim();
  const lastName = state.lastName.trim();
  const email = state.email.trim().toLocaleLowerCase();
  const normalizedEmail = email.length > 0 ? email : null;
  const hasAnyValue =
    firstName.length > 0 || lastName.length > 0 || normalizedEmail !== null;

  if (!hasAnyValue || !firstName) {
    return {
      email: null,
      errorMessage: `Please provide the ${roleLabel.toLocaleLowerCase()}'s first name, or set the dropdown to None.`,
      isValid: false,
    } as const;
  }

  if (normalizedEmail !== null && !emailPattern.test(normalizedEmail)) {
    return {
      email: null,
      errorMessage: `Please provide a valid email for the ${roleLabel.toLocaleLowerCase()}.`,
      isValid: false,
    } as const;
  }

  return {
    email: normalizedEmail,
    errorMessage: null,
    isValid: true,
  } as const;
}
