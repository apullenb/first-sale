import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IntakeWizard } from "@/components/intake/intake-wizard";
import { getMyBusiness } from "@/lib/data/my-business";
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
  const business = await getMyBusiness();
  if (!business) redirect("/business/new");
  const initial = business.profile ? profileToAnswers(business.profile) : EMPTY_ANSWERS;
  // Keyed by the saved answers, so a save in another tab never shows stale ones
  return <IntakeWizard key={JSON.stringify(business.profile)} mode="edit" initial={initial} />;
}
