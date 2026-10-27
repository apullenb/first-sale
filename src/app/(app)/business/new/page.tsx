import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IntakeWizard } from "@/components/intake/intake-wizard";
import { getMyBusiness } from "@/lib/data/my-business";

export const metadata: Metadata = { title: "Tell us about your business" };

export default function NewBusinessPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NewBusiness />
    </Suspense>
  );
}

// One business per owner: once it exists, its answers are edited instead
async function NewBusiness() {
  if (await getMyBusiness()) redirect("/business/edit");
  return <IntakeWizard mode="create" />;
}
