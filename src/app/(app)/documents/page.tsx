import Link from "next/link";
import { Suspense } from "react";
import { ActorChip } from "@/components/actor-chip";
import { AddFormPanel, type AddMode } from "@/components/documents/add-form-panel";
import { DocumentList } from "@/components/documents/document-list";
import { HowDocumentsAreHandled } from "@/components/documents/how-handled";
import { formatBytes } from "@/components/documents/labels";
import { LocalDate } from "@/components/local-date";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECONDARY_LINK, SECTION_TITLE } from "@/components/styles";
import { DOCUMENT_LIMITS, type StoredDocument } from "@/lib/data/documents";
import { getMyBusiness, getMyPlan, listMyDocuments } from "@/lib/data/my-business";
import { ACCEPTED_TYPES, MAX_PASTE_CHARS, MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
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
          Forms you’re working on, with help understanding and filling them in, plus your business plan and the
          documents First Sale prepared for you.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading your documents…</p>}>
        <Library searchParams={searchParams} />
      </Suspense>
      <HowDocumentsAreHandled />
    </div>
  );
}

const FORM_ORIGINS = new Set(["upload", "paste", "official_form"]);

async function Library({ searchParams }: { searchParams: SearchParams }) {
  const [params, business, documents, plan] = await Promise.all([searchParams, getMyBusiness(), listMyDocuments(), getMyPlan()]);

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
  const stepTitles = new Map([...(plan?.steps ?? []), ...(plan?.retired ?? [])].map((step) => [step.id, step.title]));
  const requestedStep = typeof params.step === "string" ? params.step : null;
  const initialStep = requestedStep && steps.some((step) => step.id === requestedStep) ? requestedStep : null;
  const initialMode: AddMode = params.add === "paste" || params.add === "official" ? params.add : "upload";

  const forms = documents.filter((doc) => FORM_ORIGINS.has(doc.origin));
  const prepared = documents.filter((doc) => doc.origin === "generated");
  const businessPlan = prepared.find((doc) => doc.generatedKind === "business_plan") ?? null;
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

      <DocumentList
        id="forms-heading"
        heading="Forms you’re working on"
        empty="No forms yet. Add one above to get help understanding it and drafting answers."
        documents={forms}
        stepTitles={stepTitles}
      />

      <BusinessPlanCard plan={businessPlan} />

      <DocumentList
        id="prepared-heading"
        heading="Documents First Sale prepared"
        empty="Nothing yet. Filled copies, answer sheets, your startup plan and your approved business plan appear here."
        documents={prepared}
        stepTitles={stepTitles}
      />

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
