import { getSection } from "@/lib/sections";

export function SectionPlaceholder({ href }: { href: string }) {
  const section = getSection(href);
  const eyebrow = section.step !== null ? `${section.group} · Step ${section.step}` : section.group;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-accent-ink">{eyebrow}</p>
      <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">{section.title}</h1>
      <p className="max-w-2xl text-lg text-muted">{section.summary}</p>
      <p className="w-fit rounded-full bg-rule-tint px-3 py-1 text-sm font-semibold text-rule">
        Not built yet · milestone {section.milestone}
      </p>
    </div>
  );
}
