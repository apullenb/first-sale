import Link from "next/link";
import { Icon } from "@/components/icons";
import { Kicker } from "@/components/marketing/pieces";
import { SECONDARY_LINK } from "@/components/styles";
import { Card, Chip, PageHead } from "@/components/ui";
import { getSection, sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/products");

export default function Page() {
  const section = getSection("/products");
  return (
    <div className="flex max-w-[1000px] flex-col gap-6">
      <PageHead kicker={<Kicker icon="tag">{section.group}</Kicker>} title={section.title} lead={section.summary} />
      <Card
        title="Not built yet"
        icon="tag"
        tone="gray"
        id="products-status-heading"
        action={<Chip tone="gray">Milestone {section.milestone}</Chip>}
      >
        <p className="text-muted">Until then, you can make store photos of what you sell and follow your marketing plan.</p>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/photos" className={SECONDARY_LINK}>
            <Icon name="camera" size="sm" />
            Product photos
          </Link>
          <Link href="/marketing" className={SECONDARY_LINK}>
            <Icon name="megaphone" size="sm" />
            Your marketing plan
          </Link>
        </div>
      </Card>
    </div>
  );
}
