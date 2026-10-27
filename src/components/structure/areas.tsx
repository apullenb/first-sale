import Link from "next/link";
import { TEXT_LINK } from "@/components/styles";
import { AREAS, type AreaId } from "@/lib/structure/options";
import { SourceLink } from "./source-link";

const ICONS: Record<AreaId, string[]> = {
  ownership: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
  name: ["M4 7V5h16v2", "M9 19h6", "M12 5v14"],
  tax: ["M6 3h12v18l-3-2-3 2-3-2-3 2z", "M9 8h6", "M9 12h6"],
  licenses: ["M5 4h14v16H5z", "M9 9h6", "M9 13h4", "M15 17l2 2 3-4"],
};

// The four separate things people mix up, with where this owner stands on each
export function Areas({ status }: { status: Record<AreaId, { text: string; href?: string; linkText?: string }> }) {
  return (
    <section aria-labelledby="areas-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="areas-heading" className="font-display text-2xl font-bold">
          Four separate decisions
        </h2>
        <p className="text-rule">They’re often mixed up. A DBA isn’t a structure, and no structure replaces a license.</p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {AREAS.map((area, index) => (
          <li key={area.id} className="flex flex-col gap-2 rounded-2xl bg-surface p-4.5 ring-1 ring-ink/5">
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {ICONS[area.id].map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
              </span>
              <h3 className="font-bold">
                {index + 1}. {area.title}
              </h3>
            </div>
            <p className="text-[15px]">
              {area.what}
              <SourceLink fact={area.fact} />
            </p>
            <p className="text-sm text-muted">
              <span className="font-semibold">For example:</span> {area.examples}
            </p>
            <p className="text-sm text-muted">
              <span className="font-semibold">Handled by:</span> {area.where}
            </p>
            <p className="mt-auto rounded-lg bg-ground px-3 py-2 text-[15px]">
              <span className="font-semibold">For you: </span>
              {status[area.id].text}
              {status[area.id].href ? (
                <>
                  {" "}
                  <Link href={status[area.id].href!} className={TEXT_LINK}>
                    {status[area.id].linkText}
                  </Link>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
