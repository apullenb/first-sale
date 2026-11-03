import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { IconTile } from "@/components/ui";
import { AREAS, type AreaId } from "@/lib/structure/options";
import { SourceLink } from "./source-link";

const ICONS: Record<AreaId, IconName> = { ownership: "users", name: "tag", tax: "receipt", licenses: "clipboard" };

const ASKED = AREAS.filter((area) => area.decided === "here");
// The part of this page that explains each area and asks its question
const SECTION: Partial<Record<AreaId, string>> = { ownership: "#guide-ownership", name: "#guide-name", tax: "#guide-tax" };

export function areaFor(id: AreaId): { title: string; question: number } {
  const area = AREAS.find((each) => each.id === id)!;
  return { title: area.title, question: ASKED.indexOf(area) + 1 };
}

// The four things people mix up, and where each one is decided
export function Areas() {
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {AREAS.map((area) => {
        const question = ASKED.indexOf(area) + 1;
        return (
          <li key={area.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-2.5">
              <IconTile icon={ICONS[area.id]} tone={area.decided === "here" ? "accent" : "gray"} />
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
                <a href={SECTION[area.id]} className="inline-flex min-h-11 items-center gap-1.5 text-accent underline underline-offset-[3px] hover:text-accent-ink">
                  <Icon name="arrow" size="xs" className="rotate-90" />
                  Question {question}: {area.title}, below
                </a>
              ) : (
                <>
                  <Icon name="arrow" size="xs" className="text-faint" />
                  <span>
                    Covered after{" "}
                    <Link href="/requirements" className="text-accent underline underline-offset-[3px] hover:text-accent-ink">
                      What applies to you
                    </Link>
                    , in your paperwork
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
