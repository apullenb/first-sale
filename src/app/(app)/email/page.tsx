import { OperationPage } from "@/components/operations/page";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/email");
// Sync now reads waiting mail with AI, which can take a minute
export const maxDuration = 120;

export default function EmailPage() {
  return <OperationPage kind="email" />;
}
