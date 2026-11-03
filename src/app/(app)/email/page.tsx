import type { Metadata } from "next";
import { OperationPage } from "@/components/operations/page";
import { OPERATIONS } from "@/lib/operations/catalog";

// Real forwarding page; the menu links to /email/demo until inbound email opens to owners
export const metadata: Metadata = { title: OPERATIONS.email.title, description: OPERATIONS.email.description };
// Importing reads up to ten emails with AI
export const maxDuration = 300;

export default function EmailPage() {
  return <OperationPage kind="email" />;
}
