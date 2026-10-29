import { createHash } from "node:crypto";
import Link from "next/link";
import { Suspense } from "react";
import { BackToLibrary, WhoDoesWhat } from "@/components/documents/parts";
import { PlanEditor } from "@/components/documents/plan-editor";
import { PlanQuestions } from "@/components/documents/plan-questions";
import { RunNotice } from "@/components/documents/run-notice";
import { PracticeBanner } from "@/components/practice-banner";
import { Icon } from "@/components/icons";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { getMyBusiness, lastMyRun, listMyDocuments } from "@/lib/data/my-business";
import { MAX_PLAN_INPUT, PLAN_QUESTIONS } from "@/lib/documents/business-plan";

export const metadata = { title: "Business plan" };
// Drafting waits on a long AI call
export const maxDuration = 300;

export default function BusinessPlanPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackToLibrary />
        <PageHead
          kicker={
            <span className="mt-2 inline-flex items-center gap-2">
              <Icon name="book" size="sm" />
              Documents
            </span>
          }
          title="Your business plan"
          lead="A business plan describes what you sell, who buys it, and how you’ll run the business. Answer a few questions, get a first draft, then make it yours."
        />
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
      <Card title={business ? "Update your answers first" : "Start with your business"} icon="store" id="plan-blocked-heading">
        <p className="text-rule">
          {business
            ? "Some of your business answers need updating before a plan can be drafted."
            : "Tell us about your business first. Your plan is drafted from your answers."}
        </p>
        <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
          {business ? "Update your answers" : "Tell us about your business"}
        </Link>
      </Card>
    );
  }

  const doc = documents.find((candidate) => candidate.generatedKind === "business_plan") ?? null;
  const draft = doc?.draft ?? null;
  const signature = draft
    ? createHash("sha256").update(JSON.stringify([draft.sections, draft.approvedAt])).digest("hex").slice(0, 16)
    : "";

  return (
    <>
      <WhoDoesWhat
        items={[
          ["ai", "AI drafts the plan from your answers. It doesn’t make up numbers: any it adds are flagged for you to check."],
          ["owner", "You edit it and approve it. Approving saves a PDF to your documents."],
        ]}
      />

      {draft?.simulated ? <PracticeBanner what="This business plan was drafted in practice mode." /> : null}
      <RunNotice run={run} what="Drafting your business plan" />

      <Card title="About your plan" icon="clipboard" id="plan-questions-heading">
        <PlanQuestions
          questions={PLAN_QUESTIONS.map(({ key, label, hint }) => ({ key, label, hint }))}
          initial={draft?.inputs ?? {}}
          maxInput={MAX_PLAN_INPUT}
          hasDraft={Boolean(draft)}
        />
      </Card>

      {doc && draft ? (
        <Card title="Your draft" icon="book" id="plan-editor-heading">
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
        </Card>
      ) : null}
    </>
  );
}
