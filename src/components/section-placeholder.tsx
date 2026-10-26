import { getSection } from "@/lib/sections";

export function SectionPlaceholder({ href }: { href: string }) {
  const section = getSection(href);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{section.group}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{section.title}</h1>
      <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">{section.summary}</p>
      <p className="w-fit rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        Not built yet · milestone {section.milestone}
      </p>
    </div>
  );
}
