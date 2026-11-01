import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { SECONDARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { getSection, HOME } from "@/lib/sections";

const ICONS: Record<string, IconName> = {
  "/orders": "receipt",
  "/planning-for-help": "users",
  "/products": "tag",
};

const GROUP_ICONS: Record<string, IconName> = {
  "Start your business": "flag",
  "Build your brand": "palette",
  "Run your business": "building",
};

export function SectionPlaceholder({ href }: { href: string }) {
  const section = getSection(href);
  const eyebrow = section.group && section.step !== null ? `${section.group} · Step ${section.step}` : (section.group ?? "SnapStart");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHead
        kicker={
          <span className="inline-flex items-center gap-2">
            <Icon name={(section.group && GROUP_ICONS[section.group]) || "flag"} size="sm" />
            {eyebrow}
          </span>
        }
        title={section.title}
        lead={section.summary}
      />
      <Card title="Not built yet" icon={ICONS[href] ?? "file"} tone="gray" id="placeholder-heading">
        <p className="text-rule">Planned for milestone {section.milestone}.</p>
        <Link href={HOME.href} className={SECONDARY_LINK}>
          <Icon name="home" size="sm" className="text-muted" />
          Back to {HOME.title}
        </Link>
      </Card>
    </div>
  );
}
