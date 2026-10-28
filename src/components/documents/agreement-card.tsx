import Link from "next/link";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { CARD, PRIMARY_LINK, SECONDARY_LINK, SECTION_TITLE } from "@/components/styles";
import type { StoredDocument } from "@/lib/data/documents";
import type { OutdatedFact } from "@/lib/documents/autofill";

// The owners' agreement on its plan step and in the library: what it is and how far along it is
export function AgreementCard({ name, owners, doc, outdated }: { name: string; owners: number; doc: StoredDocument | null; outdated: OutdatedFact[] }) {
  const approvedAt = doc?.draft?.approvedAt ?? null;
  return (
    <section aria-labelledby="agreement-card-heading" className={`${CARD} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id="agreement-card-heading" className={SECTION_TITLE}>
          Your {name.toLowerCase()}
        </h2>
        <ActorChip actor="rule" />
      </div>
      <p className="text-rule">
        The owners’ own rules for the business: who owns what, who runs it, and how decisions and money are handled. It isn’t filed with the state.{" "}
        {owners > 1 ? "Every owner signs it, and you keep it with your records." : "You sign it and keep it with your records."} Banks often ask for it when you open a
        business account.
      </p>
      {doc ? (
        <p className="text-sm text-muted">
          {approvedAt ? (
            <>
              Approved <LocalDate iso={approvedAt} />
            </>
          ) : (
            "Prepared, not approved yet"
          )}
        </p>
      ) : null}
      {outdated.length ? (
        <p className="rounded-lg bg-check-tint px-3 py-2.5 text-check">
          <span className="font-semibold">Outdated:</span> your {outdated.map((each) => each.label.toLowerCase()).join(", ")} changed since it was prepared.
        </p>
      ) : null}
      <Link href="/documents/agreement" className={doc ? SECONDARY_LINK : PRIMARY_LINK}>
        {doc ? `Open your ${name.toLowerCase()}` : `Prepare your ${name.toLowerCase()}`}
      </Link>
    </section>
  );
}
