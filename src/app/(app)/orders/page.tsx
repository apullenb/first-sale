import { OperationPage } from "@/components/operations/page";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/orders");

export default function OrdersPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  return <OperationPage kind="requests" selectedOrder={searchParams} />;
}
