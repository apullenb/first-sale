import { OperationPage } from "@/components/operations/page";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/email");
// Importing reads up to ten emails with AI
export const maxDuration = 300;

export default function EmailPage() {
  return <OperationPage kind="email" />;
}
