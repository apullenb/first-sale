import type { Metadata } from "next";
import { IntakeWizard } from "@/components/intake/intake-wizard";

export const metadata: Metadata = { title: "Tell us about your business" };

export default function NewBusinessPage() {
  return <IntakeWizard mode="create" />;
}
