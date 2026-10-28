import Link from "next/link";
import { Suspense } from "react";
import { ActorChip } from "@/components/actor-chip";
import { AddFormPanel, type AddMode } from "@/components/documents/add-form-panel";
import { AgreementCard } from "@/components/documents/agreement-card";
import { HowDocumentsAreHandled } from "@/components/documents/how-handled";
import { formatBytes } from "@/components/documents/labels";
import { LibraryList } from "@/components/documents/library-list";
import { LocalDate } from "@/components/local-date";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECONDARY_LINK, SECTION_TITLE } from "@/components/styles";
import { DOCUMENT_LIMITS, type StoredDocument } from "@/lib/data/documents";
import { getMyBusiness, getMyDetails, getMyPlan, listMyDocuments } from "@/lib/data/my-business";
import { autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { agreementName, agreementStructure } from "@/lib/documents/owners-agreement";
import { ACCEPTED_TYPES, MAX_PASTE_CHARS, MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { structureOf } from "@/lib/research/applicability";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/documents");
// Adding a form reads it straight away, which can wait on a long AI call
export const maxDuration = 300;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Start your business · Step 5</p>
        <h1 className={PAGE_TITLE}>Documents</h1>
        <p className="text-lg text-muted">
          Official forms, your drafted and reviewed answers, receipts and approvals, kept by plan step. Originals are never changed.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading your documents…</p>}>
        <Library searchParams={searchParams} />
      </Suspense>
      <HowDocumentsAreHandled />
    </div>
  );
}

async function Library({ searchParams }: { searchParams: SearchParams }) {
  const [params, business, documents, plan, details] = await Promise.all([searchParams, getMyBusiness(), listMyDocuments(), getMyPlan(), getMyDetails()]);

  if (!business) {
    return (
      <section className={`${CARD} flex flex-col gap-3`}>
        <p>Tell us about your business first. Then you can add forms and get help with them here.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
        </Link>
      </section>
    );
  }

  const steps = (plan?.steps ?? []).map((step) => ({ id: step.id, title: step.title }));
  const allSteps = [...(plan?.steps ?? []), ...(plan?.retired ?? [])].map((step) => ({ id: step.id, title: step.title }));
  const requestedStep = typeof params.step === "string" ? params.step : null;
  const initialStep = requestedStep && steps.some((step) => step.id === requestedStep) ? requestedStep : null;
  const initialMode: AddMode = params.add === "paste" || params.add === "official" ? params.add : "upload";

  const businessPlan = documents.find((doc) => doc.generatedKind === "business_plan") ?? null;
  const facts = business.profile ? autofillFacts(business.profile, details) : [];
  const outdated = new Map(documents.map((doc) => [doc.id, outdatedFacts(doc.factsUsed, facts)]));
  const agreementFor = business.profile ? agreementStructure(structureOf(business.profile, details).structure) : null;
  const agreement = documents.find((doc) => doc.generatedKind === "owners_agreement") ?? null;
  const usedBytes = documents.reduce((total, doc) => total + doc.byteSize, 0);

  return (
    <>
      {/* Remounts when a link asks for a different step or way in */}
      <AddFormPanel
        key={`${initialStep ?? ""}:${initialMode}`}
        steps={steps}
        initialStep={initialStep}
        initialMode={initialMode}
        acceptedTypes={Object.keys(ACCEPTED_TYPES)}
        maxUploadBytes={MAX_UPLOAD_BYTES}
        maxPasteChars={MAX_PASTE_CHARS}
      />

      <LibraryList documents={documents} steps={allSteps} outdated={outdated} />

      <BusinessPlanCard plan={businessPlan} />

      {agreementFor && business.profile ? (
        <AgreementCard
          name={agreementName(agreementFor, business.profile.location.state === "TX")}
          owners={business.profile.owners.count}
          doc={agreement}
          outdated={agreement ? (outdated.get(agreement.id) ?? []) : []}
        />
      ) : null}

      <p className="text-sm text-muted">
        Your library holds up to {DOCUMENT_LIMITS.count} documents and {formatBytes(DOCUMENT_LIMITS.totalBytes)} in all.
        You’re using {documents.length} {documents.length === 1 ? "document" : "documents"} and {formatBytes(usedBytes)}.
      </p>
    </>
  );
}

function BusinessPlanCard({ plan }: { plan: StoredDocument | null }) {
  const approvedAt = plan?.draft?.approvedAt ?? null;
  return (
    <section aria-labelledby="plan-card-heading" className={`${CARD} flex flex-col gap-3`}>
      <h2 id="plan-card-heading" className={SECTION_TITLE}>
        Your business plan
      </h2>
      <p className="text-rule">
        A business plan describes what you sell, who buys it, and how you’ll run the business. Banks, lenders and
        programs that help new businesses often ask for one, and writing it helps you think things through.
      </p>
      <ul className="flex flex-col gap-2 text-sm text-rule">
        <li className="flex items-start gap-2.5">
          <ActorChip actor="ai" />
          <span>AI drafts it from your answers.</span>
        </li>
        <li className="flex items-start gap-2.5">
          <ActorChip actor="owner" />
          <span>You edit and approve it.</span>
        </li>
      </ul>
      {plan ? (
        <p className="text-sm text-muted">
          {approvedAt ? (
            <>
              Approved <LocalDate iso={approvedAt} />
            </>
          ) : (
            "Draft, not approved yet"
          )}
        </p>
      ) : null}
      <Link href="/documents/business-plan" className={plan ? SECONDARY_LINK : PRIMARY_LINK}>
        {plan ? "Open your business plan" : "Start your business plan"}
      </Link>
    </section>
  );
}
