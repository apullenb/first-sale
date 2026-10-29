import Link from "next/link";
import type { IconName } from "@/components/icons";
import { TEXT_LINK } from "@/components/styles";
import { IconTile } from "@/components/ui";
import { AREAS, type AreaId } from "@/lib/structure/options";
import { SourceLink } from "./source-link";

const ICONS: Record<AreaId, IconName> = { ownership: "users", name: "tag", tax: "receipt", licenses: "clipboard" };

// The four separate things people mix up, with where this owner stands on each
export function Areas({ status }: { status: Record<AreaId, { text: string; href?: string; linkText?: string }> }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-rule">They’re often mixed up. A DBA isn’t a structure, and no structure replaces a license.</p>
      <ol className="grid gap-3 sm:grid-cols-2">
        {AREAS.map((area, index) => (
          <li key={area.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-2.5">
              <IconTile icon={ICONS[area.id]} tone="gray" />
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
            <p className="mt-auto rounded-lg border border-line bg-soft px-3 py-2 text-[15px]">
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
    </div>
  );
}
