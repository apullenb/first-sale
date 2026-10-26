import { SectionPlaceholder } from "@/components/section-placeholder";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/requirements");

export default function Page() {
  return <SectionPlaceholder href="/requirements" />;
}
