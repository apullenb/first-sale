import { createHash } from "node:crypto";
import Link from "next/link";
import { Suspense } from "react";
import { ActorChip } from "@/components/actor-chip";
import { PlanEditor } from "@/components/documents/plan-editor";
import { PlanQuestions } from "@/components/documents/plan-questions";
import { RunNotice } from "@/components/documents/run-notice";
import { PracticeBanner } from "@/components/practice-banner";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { getMyBusiness, lastMyRun, listMyDocuments } from "@/lib/data/my-business";
import { MAX_PLAN_INPUT, PLAN_QUESTIONS } from "@/lib/documents/business-plan";

export const metadata = { title: "Business plan" };
// Drafting waits on a long AI call
export const maxDuration = 300;

export default function BusinessPlanPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link href="/documents" className={`${TEXT_LINK} flex min-h-11 w-fit items-center`}>
          Back to your documents
        </Link>
        <p className={EYEBROW}>Start your business · Step 5</p>
        <h1 className={PAGE_TITLE}>Your business plan</h1>
        <p className="text-lg text-muted">
          A business plan describes what you sell, who buys it, and how you’ll run the business. Answer a few questions,
          get a first draft, then make it yours.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading your business plan…</p>}>
        <Plan />
      </Suspense>
    </div>
  );
}

async function Plan() {
  const [business, documents, run] = await Promise.all([getMyBusiness(), listMyDocuments(), lastMyRun("business_plan", null)]);

  if (!business?.profile) {
    return (
      <section className={`${CARD} flex flex-col gap-3`}>
        <p>
          {business
            ? "Some of your business answers need updating before a plan can be drafted."
            : "Tell us about your business first. Your plan is drafted from your answers."}
        </p>
        <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
          {business ? "Update your answers" : "Tell us about your business"}
        </Link>
      </section>
    );
  }

  const doc = documents.find((candidate) => candidate.generatedKind === "business_plan") ?? null;
  const draft = doc?.draft ?? null;
  const signature = draft
    ? createHash("sha256").update(JSON.stringify([draft.sections, draft.approvedAt])).digest("hex").slice(0, 16)
    : "";

  return (
    <>
      <ul className="flex flex-col gap-2 text-rule">
        <li className="flex items-start gap-2.5">
          <ActorChip actor="ai" />
          <span>AI drafts the plan from your answers. It doesn’t make up numbers: any it adds are flagged for you to check.</span>
        </li>
        <li className="flex items-start gap-2.5">
          <ActorChip actor="owner" />
          <span>You edit it and approve it. Approving saves a PDF to your documents.</span>
        </li>
      </ul>

      {draft?.simulated ? <PracticeBanner what="This business plan was drafted in practice mode." /> : null}
      <RunNotice run={run} what="Drafting your business plan" />

      <section aria-labelledby="plan-questions-heading" className={`${CARD} flex flex-col gap-4`}>
        <h2 id="plan-questions-heading" className={SECTION_TITLE}>
          About your plan
        </h2>
        <PlanQuestions
          questions={PLAN_QUESTIONS.map(({ key, label, hint }) => ({ key, label, hint }))}
          initial={draft?.inputs ?? {}}
          maxInput={MAX_PLAN_INPUT}
          hasDraft={Boolean(draft)}
        />
      </section>

      {doc && draft ? (
        <section aria-labelledby="plan-editor-heading" className={`${CARD} flex flex-col gap-4`}>
          <h2 id="plan-editor-heading" className={SECTION_TITLE}>
            Your draft
          </h2>
          <p className="text-rule">
            Read each section and change anything that isn’t right. Words in [brackets] are notes for you to replace with
            your own details.
          </p>
          <PlanEditor
            documentId={doc.id}
            sections={draft.sections}
            signature={signature}
            approvedAt={draft.approvedAt}
            hasFile={doc.hasFile}
          />
        </section>
      ) : null}
    </>
  );
}
