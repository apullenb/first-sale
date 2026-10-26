import Link from "next/link";
import { DEMO_BUSINESSES } from "@/data/personas";
import { SECTION_GROUPS, SECTIONS } from "@/lib/sections";

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight">
          Start your business one step at a time.
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          First Sale helps first-time owners in the US work out what their business needs, get it registered, and
          handle day-to-day work they can&apos;t hire for yet.
        </p>
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          AI drafts. Rules calculate. You approve.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Demo businesses</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {DEMO_BUSINESSES.map((business) => (
            <li
              key={business.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{business.path}</p>
              <h3 className="font-semibold">{business.profile.name}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{business.profile.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {SECTION_GROUPS.map((group) => (
        <section key={group} className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{group}</h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {SECTIONS.filter((section) => section.group === group).map((section) => (
              <li key={section.href}>
                <Link
                  href={section.href}
                  className="flex h-full flex-col gap-1 rounded-lg border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  <span className="font-medium">{section.title}</span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{section.summary}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
