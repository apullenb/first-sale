import Link from "next/link";
import { Suspense } from "react";
import { Completed, Revisit } from "@/components/completed";
import { BackToLibrary } from "@/components/documents/parts";
import { PlanEditor } from "@/components/documents/plan-editor";
import { PlanInputs } from "@/components/documents/plan-inputs";
import { RunNotice } from "@/components/documents/run-notice";
import { Icon } from "@/components/icons";
import { PracticeBanner } from "@/components/practice-banner";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, Chip, PageHead } from "@/components/ui";
import { getModel } from "@/lib/ai";
import { getMyBusiness, lastMyRun, listMyDocuments } from "@/lib/data/my-business";
import { planVersion } from "@/lib/documents/business-plan";
import { knownFacts, restoreAnswers } from "@/lib/documents/plan-facts";
import { EMPTY_MONEY, ESTIMATES_KEY, PLAN_LEVEL_LABELS, planMoney } from "@/lib/rules/plan-money";
import { myPlanSources } from "./sources";
import { serviceNotes, serviceRecipient } from "@/components/ai-service";

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
          lead="A formal plan that describes your business, what you sell, who buys it and how you’ll run it. Check what SnapStart already knows, answer a few questions, then review the draft and save it."
        />
      </div>
      <Suspense fallback={<p className="text-muted">Loading your business plan…</p>}>
        <Plan />
      </Suspense>
    </div>
  );
}

async function Plan() {
  const [sources, documents, run] = await Promise.all([myPlanSources(), listMyDocuments(), lastMyRun("business_plan", null)]);

  if (!sources) {
    const business = await getMyBusiness();
    return (
      <Card title={business ? "Update your answers first" : "Start with your business"} icon="store" id="plan-blocked-heading">
        <p className="text-rule">
          {business ? "Some of your business answers need updating before a plan can be drafted." : "Tell us about your business first. Your plan is drafted from your answers."}
        </p>
        <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
          {business ? "Update your answers" : "Tell us about your business"}
        </Link>
      </Card>
    );
  }

  const facts = knownFacts(sources);
  const basis = { profile: sources.profile, known: facts.map((fact) => fact.key) };
  const doc = documents.find((candidate) => candidate.generatedKind === "business_plan") ?? null;
  const draft = doc?.draft ?? null;
  const drafted = Boolean(doc && draft?.sections.length);
  const savedAt = doc?.hasFile && draft?.approvedAt ? draft.approvedAt : null;
  const inputs = (
    <PlanInputs
      facts={facts}
      basis={basis}
      initial={restoreAnswers(basis, facts, draft?.answers, draft?.inputs ?? {})}
      money={
        draft?.money ?? {
          ...EMPTY_MONEY,
          // Starts from the product list: prices, and costs where saved
          items: sources.products.slice(0, 12).map((product) => ({ name: product.name.slice(0, 60), priceCents: product.priceCents, unitCostCents: product.unitCostCents ?? null, unitsPerMonth: null })),
        }
      }
      hasDraft={drafted}
      privacy={privacyNote()}
    />
  );

  return (
    <>
      <RunNotice run={run} what="Drafting your business plan" />

      {doc && savedAt ? (
        <>
          <Completed eyebrow="Your business plan" title="Your business plan is saved" when={savedAt} whenLabel="Saved">
            <Link href={`/documents/${doc.id}`} className={`${PRIMARY_LINK} w-fit`}>
              Open the saved plan
              <Icon name="arrow" size="sm" />
            </Link>
          </Completed>
          <Revisit label="Revisit what your plan is drafted from" summary="Check the facts and answers again, and draft a new version if you want.">
            {inputs}
          </Revisit>
        </>
      ) : (
        inputs
      )}

      {doc && draft && drafted ? (
        <Card
          title="Review your plan"
          icon="book"
          id="plan-review-heading"
          action={<Chip tone={planMoney(draft.money ?? EMPTY_MONEY).level === "lender" ? "accent" : "gray"}>{PLAN_LEVEL_LABELS[planMoney(draft.money ?? EMPTY_MONEY).level]}</Chip>}
        >
          {draft.simulated ? <PracticeBanner what="This business plan was drafted in practice mode." /> : null}
          <PlanEditor
            // Starts fresh for each draft and each change to the estimates
            key={`${draft.draftedAt ?? "draft"}-${planVersion(draft.sections.filter((section) => section.key === ESTIMATES_KEY))}`}
            documentId={doc.id}
            sections={draft.sections}
            version={planVersion(draft.sections)}
            savedAt={doc.hasFile ? draft.approvedAt : null}
            hasFile={doc.hasFile}
          />
        </Card>
      ) : null}
    </>
  );
}

// Storage, AI processing and filing are separate; which AI service gets the text depends on this setup
function privacyNote(): string {
  let model;
  try {
    model = getModel();
  } catch {
    model = null;
  }
  const ai = !model
    ? "SnapStart’s AI service isn’t set up right now, so nothing is sent to one."
    : model.simulated || !model.dataHandling
      ? "In practice mode nothing is sent to an AI service; built-in rules write the draft."
      : `To write it, they are sent to ${serviceRecipient(model)}. ${serviceNotes(model).join(" ")}`;
  return `Your plan is stored in your SnapStart account. ${ai} Nothing is published or submitted to government offices.`;
}
