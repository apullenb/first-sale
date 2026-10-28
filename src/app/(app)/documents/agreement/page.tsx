import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { approveAgreementAction } from "@/app/(app)/documents/agreement-actions";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { AgreementForm } from "@/components/documents/agreement-form";
import { fileHref } from "@/components/documents/labels";
import { LocalDate } from "@/components/local-date";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
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
      <Link href="/documents" className={`${TEXT_LINK} flex min-h-11 w-fit items-center`}>
        Back to your documents
      </Link>
      <Suspense fallback={<p className="text-muted">Loading your agreement…</p>}>
        <Agreement />
      </Suspense>
    </div>
  );
}

function Header({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className={EYEBROW}>Start your business · Step 5</p>
      <h1 className={PAGE_TITLE}>Your {name.toLowerCase()}</h1>
      {children}
    </div>
  );
}

async function Agreement() {
  const [business, details, documents] = await Promise.all([getMyBusiness(), getMyDetails(), listMyDocuments()]);
  if (!business?.profile) {
    return (
      <>
        <Header name="Owners’ agreement" />
        <section className={`${CARD} flex flex-col gap-3`}>
          <p>{business ? "Some of your business answers need updating first." : "Tell us about your business first. The agreement is filled in from your answers."}</p>
          <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
            {business ? "Update your answers" : "Tell us about your business"}
          </Link>
        </section>
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
        <section className={`${CARD} flex flex-col gap-3`}>
          <p>{readiness.kind === "none" ? readiness.why : "This agreement is for an LLC or a partnership."}</p>
          {decided ? null : (
            <Link href="/structure" className={PRIMARY_LINK}>
              Choose your business structure
            </Link>
          )}
        </section>
      </>
    );
  }

  const intro = (
    <p className="text-lg text-muted">
      The owners’ own rules for the business: who owns what, who runs it, and how decisions and money are handled. First Sale fills it in from your details and
      your answers below. It isn’t filed with the state.
    </p>
  );

  if (readiness.kind === "missing") {
    return (
      <>
        <Header name={name}>{intro}</Header>
        <Reasons structure={structure} texas={texas} />
        <section aria-labelledby="needed-heading" className={`${CARD} flex flex-col gap-3`}>
          <h2 id="needed-heading" className={SECTION_TITLE}>
            First, add these
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {readiness.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link href="/business" className={PRIMARY_LINK}>
              Your business details
            </Link>
            <Link href="/business/edit" className={SECONDARY_LINK}>
              Your answers about the business
            </Link>
          </div>
        </section>
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
      <Header name={name}>{intro}</Header>
      <ul className="flex flex-col gap-2 text-rule">
        <li className="flex items-start gap-2.5">
          <ActorChip actor="rule" />
          <span>First Sale fills in its fixed wording from your details and answers. No AI writes any of it.</span>
        </li>
        <li className="flex items-start gap-2.5">
          <ActorChip actor="owner" />
          <span>
            You read it and approve it. Then {basis.owners.length > 1 ? `every ${who} signs` : "you sign"} the printed copy. Have a lawyer review it, especially with more than one
            owner.
          </span>
        </li>
      </ul>
      <Reasons structure={structure} texas={texas} />

      <section aria-labelledby="basis-heading" className={`${CARD} flex flex-col gap-3`}>
        <h2 id="basis-heading" className={SECTION_TITLE}>
          From your details
        </h2>
        <Basis basis={basis} />
        {llcName ? (
          <p className="rounded-lg bg-check-tint px-3 py-2.5 text-check">
            Your business name doesn’t end in “LLC” or similar. Use the LLC’s exact name, as it is on your certificate of formation.
          </p>
        ) : null}
        <Link href="/business" className={SECONDARY_LINK}>
          Change your business details
        </Link>
      </section>

      <section aria-labelledby="choices-heading" className={`${CARD} flex flex-col gap-4`}>
        <h2 id="choices-heading" className={SECTION_TITLE}>
          {basis.owners.length > 1 ? "Shares and decisions" : "What you’re putting in"}
        </h2>
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
      </section>

      {doc && draft ? (
        <section aria-labelledby="agreement-heading" className={`${CARD} flex flex-col gap-4`}>
          <h2 id="agreement-heading" className={SECTION_TITLE}>
            Read your agreement
          </h2>
          {outdated.length ? (
            <div className="flex flex-col gap-1.5 rounded-xl bg-check-tint px-4 py-3 text-check">
              <p className="font-semibold">
                {draft.approvedAt
                  ? "Your details changed since this was approved. Prepare it again, approve it, and sign the new copy."
                  : "Your details changed since this was prepared. Prepare it again before you approve it."}
              </p>
              <ul className="flex flex-col gap-0.5">
                {outdated.map((fact) => (
                  <li key={fact.id}>
                    <span className="font-semibold">{fact.label}:</span> {fact.before || "not set"} → {fact.now ?? "removed"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <article className="flex flex-col gap-4 rounded-xl bg-ground p-4">
            <h3 className="font-display text-lg font-bold">{doc.title}</h3>
            {draft.sections.map((section) => (
              <div key={section.key} className="flex flex-col gap-1">
                <h4 className="font-semibold">{section.heading}</h4>
                <p className="text-[15px]">{section.body}</p>
              </div>
            ))}
            {choices && preparedOwners.length > 1 ? (
              <div className="flex flex-col gap-1">
                <h4 className="font-semibold">Schedule A: Owners</h4>
                <ul className="flex flex-col gap-1 text-[15px]">
                  {preparedOwners.map((owner, index) => (
                    <li key={owner}>
                      {owner}: owns {percentText(Math.round(Number(choices.members[index].percent) * 100))}. Puts in: {choices.members[index].contribution || "nothing recorded yet"}.
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-sm text-muted">Signature lines for {preparedOwners.length > 1 ? `every ${who}` : `the ${who}`} are at the end of the PDF.</p>
          </article>

          <div className="flex flex-col gap-1.5">
            <p className="font-semibold">What this starter agreement leaves out</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-rule">
              {notCovered(structure, preparedOwners.length || basis.owners.length).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-[15px] text-rule">Ask a lawyer about adding these.</p>
          </div>

          {draft.approvedAt ? (
            <div className="flex flex-col gap-3">
              <p className="text-rule">
                Approved <LocalDate iso={draft.approvedAt} />. Print it, have {preparedOwners.length > 1 ? `every ${who}` : `the ${who}`} sign and date it, and keep the signed copy with
                your records.
              </p>
              {doc.hasFile ? (
                <div className="flex flex-wrap gap-2">
                  <a href={fileHref(doc.id, true)} target="_blank" rel="noopener noreferrer" className={PRIMARY_LINK}>
                    Open the PDF<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <a href={fileHref(doc.id)} className={SECONDARY_LINK}>
                    Download the PDF
                  </a>
                </div>
              ) : null}
            </div>
          ) : outdated.length ? null : (
            <ActionButton
              action={approveAgreementAction.bind(null, doc.id, preparedAt)}
              label="Approve and make the PDF"
              pendingLabel="Making the PDF…"
              variant="primary"
            />
          )}
        </section>
      ) : null}
    </>
  );
}

function Reasons({ structure, texas }: { structure: "llc" | "partnership"; texas: boolean }) {
  return (
    <section aria-labelledby="why-heading" className={`${CARD} flex flex-col gap-2`}>
      <h2 id="why-heading" className={SECTION_TITLE}>
        Why have one
      </h2>
      <ul className="flex flex-col gap-3">
        {agreementReasons(structure, texas).map((reason) => (
          <li key={reason.text} className="flex flex-col">
            <span>{reason.text}</span>
            <span className="text-sm text-muted">
              “{reason.quote}” From{" "}
              <a href={reason.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2">
                {reason.sourceTitle}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              , checked{reason.byHand ? " by hand in a browser" : ""} on <LocalDate iso={`${reason.checkedOn}T12:00:00.000Z`} />
            </span>
          </li>
        ))}
      </ul>
    </section>
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
    <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[max-content_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-semibold">{label}</dt>
          <dd className="text-rule">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
