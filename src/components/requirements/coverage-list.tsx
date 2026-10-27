import { LEVEL_LABELS } from "@/lib/labels";
import { CATEGORY_LABELS, COVERAGE_LABELS, type CoverageCell, type CoverageState, RESEARCH_CATEGORIES } from "@/lib/research/coverage";

const MARK: Record<CoverageState, { symbol: string; style: string }> = {
  confirmed: { symbol: "✓", style: "bg-accent-tint text-accent-ink" },
  read_unconfirmed: { symbol: "•", style: "bg-rule-tint text-rule" },
  unreadable: { symbol: "!", style: "bg-check-tint text-check" },
  no_official_page: { symbol: "?", style: "bg-check-tint text-check" },
  search_failed: { symbol: "!", style: "bg-check-tint text-check" },
  not_searched: { symbol: "–", style: "bg-rule-tint text-rule" },
  place_unknown: { symbol: "?", style: "bg-check-tint text-check" },
};

// What was checked in each research category, at each level of government; gaps read as gaps, never as "nothing applies"
export function CoverageList({ cells }: { cells: CoverageCell[] }) {
  const groups = RESEARCH_CATEGORIES.map((category) => ({ category, cells: cells.filter((cell) => cell.category === category) })).filter(
    (group) => group.cells.length,
  );
  return (
    <ul className="flex flex-col gap-3">
      {groups.map((group) => (
        <li key={group.category} className="flex flex-col gap-1.5">
          <p className="font-semibold">{CATEGORY_LABELS[group.category]}</p>
          <ul className="flex flex-col gap-1">
            {group.cells.map((cell) => (
              <li key={cell.level} className="flex items-start gap-2.5 text-[15px]">
                <span aria-hidden="true" className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${MARK[cell.state].style}`}>
                  {MARK[cell.state].symbol}
                </span>
                <span>
                  <span className="font-semibold">{LEVEL_LABELS[cell.level]}:</span> {COVERAGE_LABELS[cell.state]}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
