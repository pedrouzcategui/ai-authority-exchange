import Link from "next/link";
import { AddBusinessContactModal } from "@/components/add-business-contact-modal";
import { ContactsTable } from "@/components/contacts-table";
import { getBusinessContactDirectoryRows, getBusinesses } from "@/lib/matches";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const [contacts, businesses] = await Promise.all([
    getBusinessContactDirectoryRows(),
    getBusinesses(),
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-8xl flex-col gap-8 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
            Contacts
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Contact directory
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted sm:text-lg">
            Review every marketer and expert contact, see where each one is
            assigned, and update their details from one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            className="inline-flex items-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            href="/businesses"
          >
            View Businesses
          </Link>
          <AddBusinessContactModal />
        </div>
      </section>

      <ContactsTable businesses={businesses} contacts={contacts} />
    </main>
  );
}
