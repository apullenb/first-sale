import { createHash } from "node:crypto";
import Link from "next/link";
import { Suspense } from "react";
import type { EditorField } from "@/components/documents/answers-editor";
import { FormView } from "@/components/documents/form-view";
import { GeneratedView } from "@/components/documents/generated-view";
import { CARD, PRIMARY_LINK } from "@/components/styles";
import type { StoredDocument } from "@/lib/data/documents";
import { getMyBusiness, getMyDetails, getMyDocument, getMyPlan, lastMyRun } from "@/lib/data/my-business";
import { DETAIL_KEYS, DETAILS } from "@/lib/details";
import { factsFor, MAX_QUESTION, mustFillYourself } from "@/lib/documents/companion";

export const metadata = { title: "Document" };
// Explaining, asking and drafting wait on AI calls
export const maxDuration = 300;

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-muted">Loading the document…</p>}>
      <DocumentView params={params} />
    </Suspense>
  );
}

async function DocumentView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = id.length <= 60 ? await getMyDocument(id) : null;
  if (!doc) return <Missing />;
  return doc.origin === "generated" ? <Generated doc={doc} /> : <Form doc={doc} />;
}

function Missing() {
  return (
    <section className={`${CARD} flex max-w-2xl flex-col gap-3`}>
      <h1 className="font-display text-2xl font-bold">That document wasn’t found</h1>
      <p className="text-rule">It may have been deleted.</p>
      <Link href="/documents" className={PRIMARY_LINK}>
        Go to your documents
      </Link>
    </section>
  );
}

async function Generated({ doc }: { doc: StoredDocument }) {
  const [from, plan] = await Promise.all([
    doc.fromDocumentId && doc.fromDocumentId.length <= 60 ? getMyDocument(doc.fromDocumentId) : null,
    doc.taskId ? getMyPlan() : null,
  ]);
  const step = [...(plan?.steps ?? []), ...(plan?.retired ?? [])].find((candidate) => candidate.id === doc.taskId);
  return <GeneratedView doc={doc} from={from ? { id: from.id, title: from.title } : null} stepTitle={step?.title ?? null} />;
}

// Choice details store set option values, which typed answers wouldn't match
const SAVABLE_DETAILS = DETAIL_KEYS.filter((key) => DETAILS[key].kind !== "choice").map((key) => ({ key, label: DETAILS[key].label }));

async function Form({ doc }: { doc: StoredDocument }) {
  const [plan, business, details, read, explain, draft] = await Promise.all([
    getMyPlan(),
    getMyBusiness(),
    getMyDetails(),
    lastMyRun("read_document", doc.id),
    lastMyRun("explain_document", doc.id),
    lastMyRun("draft_answers", doc.id),
  ]);

  const facts = business?.profile ? factsFor(business.profile, details) : [];
  const sourceLabels = Object.fromEntries(facts.map((fact) => [fact.id, fact.label]));
  const editorFields: EditorField[] = doc.content.fields.map((field) => {
    const answer = doc.answers[field.id];
    const fillYourself = mustFillYourself(field) || answer?.state === "fill_yourself";
    return {
      id: field.id,
      label: field.label,
      page: field.page,
      kind: field.kind,
      options: field.options,
      printedText: field.printedText,
      lowConfidence: field.confidence === "low",
      fillYourself,
      note: answer?.note || "First Sale leaves this one for you. Fill it in on the form yourself.",
      value: fillYourself ? "" : (answer?.value ?? ""),
      source: fillYourself ? "" : (answer?.source ?? ""),
      confirmed: answer?.state === "confirmed",
    };
  });
  const signature = createHash("sha256")
    .update(JSON.stringify([doc.content.readAt, doc.content.fields.map((field) => field.id), doc.answers]))
    .digest("hex")
    .slice(0, 16);
  // A linked step a later plan dropped still shows as linked
  const retired = plan?.retired.find((step) => step.id === doc.taskId);
  const steps = [
    ...(plan?.steps ?? []).map((step) => ({ id: step.id, title: step.title })),
    ...(retired ? [{ id: retired.id, title: `${retired.title} (no longer in your plan)` }] : []),
  ];

  return (
    <FormView
      doc={doc}
      steps={steps}
      runs={{ read, explain, draft }}
      editorFields={editorFields}
      answersSignature={signature}
      sourceLabels={sourceLabels}
      detailOptions={SAVABLE_DETAILS}
      draftBlocked={business?.profile ? null : "Update your business answers first, so there are details to draft from."}
      maxQuestion={MAX_QUESTION}
    />
  );
}
