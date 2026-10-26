import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IntakeWizard } from "@/components/intake/intake-wizard";
import { getCurrentBusiness } from "@/lib/data/my-businesses";
import { EMPTY_ANSWERS, profileToAnswers } from "@/lib/intake/answers";

export const metadata: Metadata = { title: "Edit your answers" };

export default function EditBusinessPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading your answers…</p>}>
      <EditWizard />
    </Suspense>
  );
}

async function EditWizard() {
  const business = await getCurrentBusiness();
  if (!business) redirect("/business/new");
  const initial = business.profile ? profileToAnswers(business.profile) : EMPTY_ANSWERS;
  // Keyed by business and saved answers, so a switch or a save elsewhere never shows stale answers
  return (
    <IntakeWizard
      key={`${business.id}:${JSON.stringify(business.profile)}`}
      mode="edit"
      businessId={business.id}
      initial={initial}
    />
  );
}
