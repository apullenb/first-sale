import { OperationPage } from "@/components/operations/page";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/email");

export default function EmailPage() {
  return <OperationPage kind="email" />;
}
