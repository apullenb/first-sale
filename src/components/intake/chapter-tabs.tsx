import { Icon } from "@/components/icons";
import type { StepId } from "@/lib/intake/answers";
import { CHAPTERS, chapterIndex } from "./chapters";

// Five chapter bars that fill as the owner goes; the kicker in the card says the same in words
export function ChapterTabs({ step, steps }: { step: StepId | "review"; steps: readonly StepId[] }) {
  const now = step === "review" ? CHAPTERS.length : chapterIndex(step);
  return (
    <ol aria-hidden="true" className="grid auto-cols-fr grid-flow-col gap-2.5">
      {CHAPTERS.map((chapter, index) => {
        const state = index < now ? "done" : index === now ? "now" : "later";
        const shown = chapter.steps.filter((s) => steps.includes(s));
        const at = step === "review" ? -1 : shown.indexOf(step);
        const fill = state === "done" ? 100 : state === "now" ? Math.round(((at + 1) / (shown.length + 1)) * 100) : 0;
        return (
          <li
            key={chapter.label}
            className={`flex min-w-0 flex-col gap-2 text-sm font-semibold ${state === "done" ? "text-rule" : state === "now" ? "text-ink" : "text-muted"}`}
          >
            <span className="hidden min-w-0 items-center gap-1.5 sm:flex">
              {state === "done" ? <Icon name="check" size="xs" className="text-accent" /> : null}
              <span className="truncate">{chapter.label}</span>
            </span>
            <span className="block h-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${fill}%` }} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
