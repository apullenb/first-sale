import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { IconTile } from "@/components/ui";
import { AREAS, type AreaId } from "@/lib/structure/options";
import { SourceLink } from "./source-link";

const ICONS: Record<AreaId, IconName> = { ownership: "users", name: "tag", tax: "receipt", licenses: "clipboard" };

const ASKED = AREAS.filter((area) => area.decided === "here");

// The four things people mix up, and where each one is decided
export function Areas() {
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {AREAS.map((area) => {
        const question = ASKED.indexOf(area) + 1;
        return (
          <li key={area.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-2.5">
              <IconTile icon={ICONS[area.id]} tone="gray" />
              <h4 className="font-bold leading-snug">{area.title}</h4>
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
            <p className="mt-auto flex items-center gap-1.5 border-t border-line pt-2.5 text-sm font-semibold text-rule">
              {area.decided === "here" ? (
                <>
                  <Icon name="list" size="xs" className="text-faint" />
                  Asked in question {question} below
                </>
              ) : (
                <>
                  <Icon name="arrow" size="xs" className="text-faint" />
                  <span>
                    Covered in Step 4,{" "}
                    <Link href="/checklist" className="text-accent underline underline-offset-[3px] hover:text-accent-ink">
                      Licenses and registrations
                    </Link>
                  </span>
                </>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
