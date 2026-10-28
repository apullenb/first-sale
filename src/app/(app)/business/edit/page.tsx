import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IntakeWizard } from "@/components/intake/intake-wizard";
import { draftKey } from "@/lib/data/intake-drafts";
import { getMyBusiness, getMyDetails, getMyIntakeDraft, getMyPlan, getMyResearch, listMyDocuments } from "@/lib/data/my-business";
import { EMPTY_ANSWERS, profileToAnswers } from "@/lib/intake/answers";
import type { ImpactContext } from "@/lib/intake/impact";

export const metadata: Metadata = { title: "Edit your answers" };

export default function EditBusinessPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading your answers…</p>}>
      <EditWizard />
    </Suspense>
  );
}

async function EditWizard() {
  const [business, draft, research, plan, details, documents] = await Promise.all([
    getMyBusiness(),
    getMyIntakeDraft(),
    getMyResearch(),
    getMyPlan(),
    getMyDetails(),
    listMyDocuments(),
  ]);
  if (!business) redirect("/business/new");
  const initial = business.profile ? profileToAnswers(business.profile) : EMPTY_ANSWERS;
  // What a change would affect, shown before the owner confirms it
  const context: ImpactContext = {
    researchCheckedAt: research?.checkedAt.toISOString() ?? null,
    planSteps: plan?.steps.length ?? 0,
    structureDecision: details.find((detail) => detail.key === "structure_choice")?.value ?? null,
    documents: documents.flatMap((doc) => {
      const facts = [...new Set(Object.values(doc.answers).map((answer) => answer.source).filter((source) => source.startsWith("profile.")))];
      return facts.length ? [{ id: doc.id, title: doc.title, facts }] : [];
    }),
  };
  const saved = draft?.mode === "edit" ? { ...draft, updatedAt: draft.updatedAt.toISOString() } : null;
  // Keyed by the saved answers, so a save in another tab never shows stale ones
  return (
    <IntakeWizard
      key={JSON.stringify(business.profile)}
      mode="edit"
      initial={initial}
      initialProfile={business.profile}
      baseKey={business.profile ? draftKey(business.profile) : "unreadable"}
      draft={saved}
      context={context}
    />
  );
}
