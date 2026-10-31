import Link from "next/link";
import { Suspense } from "react";
import { type AddKind, AddFormPanel, type AddMode } from "@/components/documents/add-form-panel";
import { AgreementCard } from "@/components/documents/agreement-card";
import { HowDocumentsAreHandled } from "@/components/documents/how-handled";
import { formatBytes } from "@/components/documents/labels";
import { LibraryList } from "@/components/documents/library-list";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { PRIMARY_LINK, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, Chip, PageHead } from "@/components/ui";
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
    <div className="flex max-w-[1000px] flex-col gap-6">
      <PageHead
        kicker={
          <span className="inline-flex items-center gap-2">
            <Icon name="book" size="sm" />
            Documents
          </span>
        }
        title="Documents"
        lead="Official forms, your drafted and reviewed answers, receipts, approvals and letters you received, kept by plan step. Originals are never changed."
      />
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
      <Card title="Start with your business" icon="store" id="no-business-heading">
        <p className="text-rule">Tell us about your business first. Then you can add forms and get help with them here.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
        </Link>
      </Card>
    );
  }

  const steps = (plan?.steps ?? []).map((step) => ({ id: step.id, title: step.title }));
  const allSteps = [...(plan?.steps ?? []), ...(plan?.retired ?? [])].map((step) => ({ id: step.id, title: step.title }));
  const requestedStep = typeof params.step === "string" ? params.step : null;
  const initialStep = requestedStep && steps.some((step) => step.id === requestedStep) ? requestedStep : null;
  const initialMode: AddMode = params.add === "paste" || params.add === "official" ? params.add : "upload";
  // Links for a step's form ask for a form; otherwise papers the owner has come first
  const initialKind: AddKind = params.add === "have" ? "have" : params.add || requestedStep ? "fill" : "have";
  // The add form opens, first on the page, when a link asks for it
  const adding = Boolean(params.add || requestedStep);

  const businessPlan = documents.find((doc) => doc.generatedKind === "business_plan") ?? null;
  const facts = business.profile ? autofillFacts(business.profile, details) : [];
  const outdated = new Map(documents.map((doc) => [doc.id, outdatedFacts(doc.factsUsed, facts)]));
  const agreementFor = business.profile ? agreementStructure(structureOf(business.profile, details).structure) : null;
  const agreement = documents.find((doc) => doc.generatedKind === "owners_agreement") ?? null;
  const usedBytes = documents.reduce((total, doc) => total + doc.byteSize, 0);

  return (
    <>
      {adding ? (
        // Remounts when a link asks for a different step or way in
        <AddFormPanel
          key={`${initialStep ?? ""}:${initialKind}:${initialMode}`}
          steps={steps}
          initialStep={initialStep}
          initialKind={initialKind}
          initialMode={initialMode}
          acceptedTypes={Object.keys(ACCEPTED_TYPES)}
          maxUploadBytes={MAX_UPLOAD_BYTES}
          maxPasteChars={MAX_PASTE_CHARS}
          closeHref="/documents"
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Got a letter or form you’re not sure about?" icon="file" id="add-card-heading" className="flex flex-col" bodyClassName="flex-1">
          <p className="text-rule">
            Add it and First Sale explains what it is and what to do. Add papers you already have, like your LLC certificate or the IRS letter with your EIN (tax ID number), and forms you
            need to fill in.
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <Link href="/documents?add=have#add-form" className={PRIMARY_LINK}>
              <Icon name="upload" size="sm" />
              Add a document
            </Link>
            <span className="text-[15px] text-muted">
              Or{" "}
              <Link href="/documents?add=upload#add-form" className={`${TEXT_LINK} inline-flex min-h-11 items-center`}>
                add a form to fill in
              </Link>
            </span>
          </div>
        </Card>
        <BusinessPlanCard plan={businessPlan} />
      </div>


      <Card
        title="Your documents"
        icon="checklist"
        id="library-heading"
        action={documents.length ? <Chip tone="gray">{documents.length === 1 ? "1 document" : `${documents.length} documents`}</Chip> : null}
      >
        <LibraryList documents={documents} steps={allSteps} outdated={outdated} />
        <p className="border-t border-line pt-3 text-[14.5px] text-muted">
          Your library holds up to {DOCUMENT_LIMITS.count} documents and {formatBytes(DOCUMENT_LIMITS.totalBytes)} in all. You’re using {documents.length}{" "}
          {documents.length === 1 ? "document" : "documents"} and {formatBytes(usedBytes)}.
        </p>
      </Card>

      {agreementFor && business.profile ? (
        <AgreementCard
          name={agreementName(agreementFor, business.profile.location.state === "TX")}
          owners={business.profile.owners.count}
          doc={agreement}
          outdated={agreement ? (outdated.get(agreement.id) ?? []) : []}
        />
      ) : null}
    </>
  );
}

function BusinessPlanCard({ plan }: { plan: StoredDocument | null }) {
  const savedAt = plan?.hasFile ? (plan.draft?.approvedAt ?? null) : null;
  const drafted = Boolean(plan?.draft?.sections.length);
  return (
    <Card title="Your business plan" icon="book" id="plan-card-heading" className="flex flex-col" bodyClassName="flex-1">
      <p className="text-rule">
        A formal plan that describes what you sell, who buys it, and how you’ll run the business. Banks, lenders and programs that help new businesses often ask
        for one. First Sale fills in what it already knows and asks only what’s missing.
      </p>
      {savedAt ? (
        <Chip tone="accent" icon="check">
          Saved as a PDF <LocalDate iso={savedAt} />
        </Chip>
      ) : plan?.hasFile ? (
        <Chip tone="warn">Changed since the PDF was saved</Chip>
      ) : drafted ? (
        <Chip tone="gray">Drafted, not saved as a PDF yet</Chip>
      ) : null}
      <Link href="/documents/business-plan" className={`${SECONDARY_LINK} mt-auto`}>
        <Icon name={drafted ? "pencil" : "sparkles"} size="sm" />
        {drafted ? "Open your business plan" : "Generate your business plan"}
      </Link>
    </Card>
  );
}
