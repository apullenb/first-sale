import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { approveAgreementAction } from "@/app/(app)/documents/agreement-actions";
import { ActionButton } from "@/components/action-button";
import { AgreementForm } from "@/components/documents/agreement-form";
import { fileHref } from "@/components/documents/labels";
import { BackToLibrary, ChangedFacts } from "@/components/documents/parts";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { PRIMARY_LINK, SECONDARY_LINK } from "@/components/styles";
import { Card, Note, PageHead, Source } from "@/components/ui";
import { getMyBusiness, getMyDetails, listMyDocuments } from "@/lib/data/my-business";
import { autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import {
  type AgreementBasis,
  agreementName,
  agreementReadiness,
  agreementReasons,
  agreementStructure,
  draftStamp,
  inputsToChoices,
  notCovered,
  ownerNames,
  percentText,
} from "@/lib/documents/owners-agreement";
import { structureOf } from "@/lib/research/applicability";

export const metadata = { title: "Owners’ agreement" };

export default function AgreementPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6 wrap-break-word">
      <div className="-mb-4">
        <BackToLibrary />
      </div>
      <Suspense fallback={<p className="text-muted">Loading your agreement…</p>}>
        <Agreement />
      </Suspense>
    </div>
  );
}

function Header({ name, lead }: { name: string; lead?: ReactNode }) {
  return (
    <PageHead
      kicker={
        <span className="inline-flex items-center gap-2">
          <Icon name="book" size="sm" />
          Documents
        </span>
      }
      title={`Your ${name.toLowerCase()}`}
      lead={lead}
    />
  );
}

async function Agreement() {
  const [business, details, documents] = await Promise.all([getMyBusiness(), getMyDetails(), listMyDocuments()]);
  if (!business?.profile) {
    return (
      <>
        <Header name="Owners’ agreement" />
        <Card title={business ? "Update your answers first" : "Start with your business"} icon="store" id="agreement-blocked-heading">
          <p className="text-rule">{business ? "Some of your business answers need updating first." : "Tell us about your business first. The agreement is filled in from your answers."}</p>
          <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
            {business ? "Update your answers" : "Tell us about your business"}
          </Link>
        </Card>
      </>
    );
  }

  const profile = business.profile;
  const facts = autofillFacts(profile, details);
  const decided = structureOf(profile, details).structure;
  const readiness = agreementReadiness(profile, new Map(facts.map((fact) => [fact.id, fact])), decided);
  const structure = agreementStructure(decided);
  const texas = profile.location.state === "TX";
  const name = structure ? agreementName(structure, texas) : "Owners’ agreement";

  if (readiness.kind === "none" || !structure) {
    return (
      <>
        <Header name={name} />
        <Card title={decided ? "Not needed for your structure" : "Not ready yet"} icon="scale" tone="gray" id="agreement-none-heading">
          <p className="text-rule">{readiness.kind === "none" ? readiness.why : "This agreement is for an LLC or a partnership."}</p>
          {decided ? null : (
            <Link href="/structure" className={PRIMARY_LINK}>
              <Icon name="scale" size="sm" />
              Choose your business structure
            </Link>
          )}
        </Card>
      </>
    );
  }

  const intro =
    "The owners’ own rules for the business: who owns what, who runs it, and how decisions and money are handled. SnapStart fills it in from your details and your answers below. It isn’t filed with the state.";

  if (readiness.kind === "missing") {
    return (
      <>
        <Header name={name} lead={intro} />
        <Card title="First, add these" icon="info" tone="warn" id="needed-heading" className="border-check-ring!">
          <ul className="flex flex-col gap-2">
            {readiness.missing.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-check" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Link href="/business" className={PRIMARY_LINK}>
              Your business details
            </Link>
            <Link href="/business/edit" className={SECONDARY_LINK}>
              Your answers about the business
            </Link>
          </div>
        </Card>
        <Reasons structure={structure} texas={texas} />
      </>
    );
  }

  const { basis } = readiness;
  const doc = documents.find((each) => each.generatedKind === "owners_agreement") ?? null;
  const draft = doc?.draft ?? null;
  const outdated = doc ? outdatedFacts(doc.factsUsed, facts) : [];
  const preparedAt = draft?.inputs.prepared_at ?? "";
  const who = structure === "llc" ? "member" : "partner";
  // The owners named when it was prepared, with the shares the owner gave
  const preparedOwners = ownerNames(doc?.factsUsed?.["detail.owner_names"]);
  const choices = draft ? inputsToChoices(draft.inputs, preparedOwners) : null;
  // Saved answers follow each owner by name, so fixing one name doesn't reset the others
  const initial = choices
    ? { ...choices, members: basis.owners.map((owner) => choices.members[preparedOwners.indexOf(owner)] ?? { percent: "", contribution: "" }) }
    : null;
  const llcName = structure === "llc" && !/\b(l\.?\s?l\.?\s?c\.?|limited liability company|limited company|ltd\.?\s+co\.?|l\.?\s?c\.?)\s*$/i.test(basis.name);

  return (
    <>
      <Header name={name} lead={intro} />
      <Reasons structure={structure} texas={texas} />

      <Card title="From your details" icon="building" id="basis-heading">
        <Basis basis={basis} />
        {llcName ? <Note>Your business name doesn’t end in “LLC” or similar. Use the LLC’s exact name, as it is on your certificate of formation, the form that created your LLC with the state.</Note> : null}
        <Link href="/business" className={SECONDARY_LINK}>
          <Icon name="pencil" size="sm" className="text-muted" />
          Change your business details
        </Link>
      </Card>

      <Card title={basis.owners.length > 1 ? "Shares and decisions" : "What you’re putting in"} icon="users" id="choices-heading">
        <AgreementForm
          key={basis.owners.join("\n")}
          owners={basis.owners}
          who={who}
          hasManager={basis.managed === "manager"}
          initial={initial}
          basedOn={draftStamp(draft)}
          hasDraft={Boolean(draft)}
          approved={Boolean(draft?.approvedAt)}
        />
      </Card>

      {doc && draft ? (
        <Card title="Read your agreement" icon="scale" id="agreement-heading">
          {outdated.length ? (
            <Note>
              <p className="font-semibold">
                {draft.approvedAt
                  ? "Your details changed since this was approved. Prepare it again, approve it, and sign the new copy."
                  : "Your details changed since this was prepared. Prepare it again before you approve it."}
              </p>
              <div className="mt-1">
                <ChangedFacts facts={outdated} />
              </div>
            </Note>
          ) : null}
          <article className="flex flex-col gap-4 rounded-md border border-line-strong bg-surface px-5 py-6 shadow-lift sm:px-8 sm:py-8">
            <h3 className="border-b-[1.5px] border-ink pb-2.5 font-display text-[22px] leading-snug">{doc.title}</h3>
            {draft.sections.map((section) => (
              <div key={section.key} className="flex flex-col gap-1">
                <h4 className="font-bold">{section.heading}</h4>
                <p className="text-[15.5px] text-rule">{section.body}</p>
              </div>
            ))}
            {choices && preparedOwners.length > 1 ? (
              <div className="flex flex-col gap-1">
                <h4 className="font-bold">Schedule A: Owners</h4>
                <ul className="flex flex-col gap-1 text-[15.5px] text-rule">
                  {preparedOwners.map((owner, index) => (
                    <li key={owner}>
                      {owner}: owns {percentText(Math.round(Number(choices.members[index].percent) * 100))}. Puts in: {choices.members[index].contribution || "nothing recorded yet"}.
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="border-t border-line pt-3 text-[14.5px] text-muted">Signature lines for {preparedOwners.length > 1 ? `every ${who}` : `the ${who}`} are at the end of the PDF.</p>
          </article>

          <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-soft px-4 py-3.5">
            <p className="font-semibold">What this starter agreement leaves out</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-rule marker:text-faint">
              {notCovered(structure, preparedOwners.length || basis.owners.length).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-[15px] text-rule">Most new businesses don’t need these at the start. If yours does, a lawyer can add them.</p>
          </div>

          {draft.approvedAt ? (
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <p className="flex items-start gap-2 text-rule">
                <Icon name="check" size="sm" className="mt-1 text-accent" />
                <span>
                  Approved <LocalDate iso={draft.approvedAt} />. Print it, have {preparedOwners.length > 1 ? `every ${who}` : `the ${who}`} sign and date it, and keep the signed copy
                  with your records.
                </span>
              </p>
              {doc.hasFile ? (
                <div className="flex flex-wrap gap-2">
                  <a href={fileHref(doc.id, true)} target="_blank" rel="noopener noreferrer" className={PRIMARY_LINK}>
                    <Icon name="eye" size="sm" />
                    Open the PDF<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <a href={fileHref(doc.id)} className={SECONDARY_LINK}>
                    <Icon name="download" size="sm" className="text-muted" />
                    Download the PDF
                  </a>
                </div>
              ) : null}
            </div>
          ) : outdated.length ? null : (
            <div className="border-t border-line pt-4">
              <ActionButton
                action={approveAgreementAction.bind(null, doc.id, preparedAt)}
                label="Approve and make the PDF"
                pendingLabel="Making the PDF…"
                variant="primary"
              />
            </div>
          )}
        </Card>
      ) : null}
    </>
  );
}

function Reasons({ structure, texas }: { structure: "llc" | "partnership"; texas: boolean }) {
  return (
    <Card title="Why have one" icon="lightbulb" id="why-heading">
      <ul className="flex flex-col divide-y divide-line">
        {agreementReasons(structure, texas).map((reason) => (
          <li key={reason.text} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
            <span className="font-semibold">{reason.text}</span>
            <blockquote className="border-l-[3px] border-accent-ring pl-3.5 text-[15px] text-rule italic">“{reason.quote}”</blockquote>
            <Source url={reason.sourceUrl} title={reason.sourceTitle} checkedOn={reason.checkedOn} byHand={reason.byHand} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Basis({ basis }: { basis: AgreementBasis }) {
  const rows: [string, string][] = [
    ["Business", basis.name],
    [basis.owners.length > 1 ? "Owners" : "Owner", basis.owners.join(", ")],
  ];
  if (basis.managed) rows.push(["Who runs it", basis.managed === "manager" ? "A chosen manager" : basis.owners.length > 1 ? "The members" : "The member"]);
  rows.push(["Main business", basis.purpose ?? "Not given: the agreement says any lawful business"]);
  rows.push(["Principal office", basis.address?.split("\n").join(", ") ?? "Not given: left out of the agreement"]);
  rows.push(["Law that applies", basis.stateName]);
  return (
    <dl className="flex flex-col">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-line py-2.5 last:border-0">
          <dt className="w-40 shrink-0 text-[15px] text-muted">{label}</dt>
          <dd className="min-w-0 flex-1 basis-56 font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
