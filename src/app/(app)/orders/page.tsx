import { OperationPage } from "@/components/operations/page";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/orders");
// Sync now reads waiting mail with AI, which can take a minute
export const maxDuration = 120;

export default function OrdersPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  return <OperationPage kind="requests" selectedOrder={searchParams} />;
}
