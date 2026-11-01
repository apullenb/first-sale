import { createHash } from "node:crypto";
import Link from "next/link";
import { Suspense } from "react";
import type { EditorField } from "@/components/documents/answers-editor";
import { FormStatus } from "@/components/documents/form-status";
import { FormView } from "@/components/documents/form-view";
import { GeneratedView } from "@/components/documents/generated-view";
import { ReceivedView } from "@/components/documents/received-view";
import { Icon } from "@/components/icons";
import { PRIMARY_LINK } from "@/components/styles";
import { PageHead } from "@/components/ui";
import type { StoredDocument } from "@/lib/data/documents";
import { getMyBusiness, getMyDetails, getMyDocument, getMyPlan, lastMyRun, listMyDocuments } from "@/lib/data/my-business";
import { autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { isKept } from "@/lib/documents/library";
import { ACCEPTED_TYPES } from "@/lib/documents/upload";
import { DETAIL_KEYS, DETAILS } from "@/lib/details";
import { MAX_QUESTION, mustFillYourself } from "@/lib/documents/companion";

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
  if (doc.origin === "generated") return <Generated doc={doc} />;
  return isKept(doc) ? <Received doc={doc} /> : <Form doc={doc} />;
}

function Missing() {
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <PageHead title="That document wasn’t found" lead="It may have been deleted." />
      <Link href="/documents" className={PRIMARY_LINK}>
        <Icon name="book" size="sm" />
        Go to your documents
      </Link>
    </div>
  );
}

async function Generated({ doc }: { doc: StoredDocument }) {
  const [from, plan, business, details] = await Promise.all([
    doc.fromDocumentId && doc.fromDocumentId.length <= 60 ? getMyDocument(doc.fromDocumentId) : null,
    doc.taskId ? getMyPlan() : null,
    doc.factsUsed ? getMyBusiness() : null,
    doc.factsUsed ? getMyDetails() : [],
  ]);
  const step = [...(plan?.steps ?? []), ...(plan?.retired ?? [])].find((candidate) => candidate.id === doc.taskId);
  const outdated = business?.profile ? outdatedFacts(doc.factsUsed, autofillFacts(business.profile, details)) : [];
  return <GeneratedView doc={doc} from={from ? { id: from.id, title: from.title } : null} stepTitle={step?.title ?? null} outdated={outdated} />;
}

async function Received({ doc }: { doc: StoredDocument }) {
  const [plan, run, library] = await Promise.all([getMyPlan(), lastMyRun("explain_received", doc.id), listMyDocuments()]);
  const family = doc.familyId ?? doc.id;
  const versions = library.filter((other) => other.id !== doc.id && (other.id === family || other.familyId === family)).sort((a, b) => b.version - a.version);
  const retired = plan?.retired.find((step) => step.id === doc.taskId);
  const steps = [
    ...(plan?.steps ?? []).map((step) => ({ id: step.id, title: step.title })),
    ...(retired ? [{ id: retired.id, title: `${retired.title} (no longer in your plan)` }] : []),
  ];
  const stepKey = doc.guide?.received?.stepKey;
  const step = stepKey ? plan?.steps.find((candidate) => candidate.key === stepKey) : undefined;
  return (
    <ReceivedView
      doc={doc}
      steps={steps}
      run={run}
      matched={step ? { id: step.id, title: step.title, status: step.status } : null}
      versions={versions}
      acceptedTypes={Object.keys(ACCEPTED_TYPES).join(",")}
    />
  );
}

// Choice details store set option values, which typed answers wouldn't match
const SAVABLE_DETAILS = DETAIL_KEYS.filter((key) => DETAILS[key].kind !== "choice").map((key) => ({ key, label: DETAILS[key].label }));

async function Form({ doc }: { doc: StoredDocument }) {
  const [plan, business, details, read, explain, draft, library] = await Promise.all([
    getMyPlan(),
    getMyBusiness(),
    getMyDetails(),
    lastMyRun("read_document", doc.id),
    lastMyRun("explain_document", doc.id),
    lastMyRun("draft_answers", doc.id),
    listMyDocuments(),
  ]);

  const facts = business?.profile ? autofillFacts(business.profile, details) : [];
  const family = doc.familyId ?? doc.id;
  const versions = library
    .filter((other) => other.id !== doc.id && (other.id === family || other.familyId === family || other.fromDocumentId === doc.id))
    .sort((a, b) => b.version - a.version);
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
      note: answer?.note || "SnapStart leaves this one for you. Fill it in on the form yourself.",
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
      status={<FormStatus doc={doc} outdated={outdatedFacts(doc.factsUsed, facts)} versions={versions} acceptedTypes={Object.keys(ACCEPTED_TYPES).join(",")} />}
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
