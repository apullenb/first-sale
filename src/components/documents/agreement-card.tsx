import Link from "next/link";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { PRIMARY_LINK, SECONDARY_LINK } from "@/components/styles";
import { Card, Chip, Note } from "@/components/ui";
import type { StoredDocument } from "@/lib/data/documents";
import type { OutdatedFact } from "@/lib/documents/autofill";

// The owners' agreement on its plan step and in the library: what it is and how far along it is
export function AgreementCard({ name, owners, doc, outdated }: { name: string; owners: number; doc: StoredDocument | null; outdated: OutdatedFact[] }) {
  const approvedAt = doc?.draft?.approvedAt ?? null;
  return (
    <Card title={`Your ${name.toLowerCase()}`} icon="scale" id="agreement-card-heading" action={<ActorChip actor="rule" />}>
      <p className="text-rule">
        The owners’ own rules for the business: who owns what, who runs it, and how decisions and money are handled. It isn’t filed with the state.{" "}
        {owners > 1 ? "Every owner signs it, and you keep it with your records." : "You sign it and keep it with your records."} Banks often ask for it when you open a
        business account.
      </p>
      {doc ? (
        approvedAt ? (
          <Chip tone="accent" icon="check">
            Approved <LocalDate iso={approvedAt} />
          </Chip>
        ) : (
          <Chip tone="gray">Prepared, not approved yet</Chip>
        )
      ) : null}
      {outdated.length ? (
        <Note>
          <span className="font-semibold">Outdated:</span> your {outdated.map((each) => each.label.toLowerCase()).join(", ")} changed since it was prepared.
        </Note>
      ) : null}
      <Link href="/documents/agreement" className={doc ? SECONDARY_LINK : PRIMARY_LINK}>
        <Icon name="pencil" size="sm" />
        {doc ? `Open your ${name.toLowerCase()}` : `Prepare your ${name.toLowerCase()}`}
      </Link>
    </Card>
  );
}
