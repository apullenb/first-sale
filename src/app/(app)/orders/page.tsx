import { OperationPage } from "@/components/operations/page";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/orders");

export default function OrdersPage() {
  return <OperationPage kind="requests" />;
}
