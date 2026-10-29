import { LEVEL_LABELS } from "@/lib/labels";
import { CATEGORY_LABELS, COVERAGE_LABELS, type CoverageCell, type CoverageState, RESEARCH_CATEGORIES } from "@/lib/research/coverage";

const GOOD = "border-accent-ring bg-accent-tint text-accent";
const GAP = "border-check-ring bg-check-tint text-check";
const PLAIN = "border-line bg-wash text-muted";

const MARK: Record<CoverageState, { symbol: string; style: string }> = {
  confirmed: { symbol: "✓", style: GOOD },
  read_unconfirmed: { symbol: "•", style: PLAIN },
  unreadable: { symbol: "!", style: GAP },
  no_official_page: { symbol: "?", style: GAP },
  search_failed: { symbol: "!", style: GAP },
  not_searched: { symbol: "–", style: PLAIN },
  place_unknown: { symbol: "?", style: GAP },
};

// What was checked in each research category, at each level of government; gaps read as gaps, never as "nothing applies"
export function CoverageList({ cells }: { cells: CoverageCell[] }) {
  const groups = RESEARCH_CATEGORIES.map((category) => ({ category, cells: cells.filter((cell) => cell.category === category) })).filter(
    (group) => group.cells.length,
  );
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <li key={group.category} className="flex flex-col gap-1.5 rounded-xl border border-line bg-soft px-3.5 py-3">
          <p className="font-semibold">{CATEGORY_LABELS[group.category]}</p>
          <ul className="flex flex-col gap-1">
            {group.cells.map((cell) => (
              <li key={cell.level} className="flex items-start gap-2.5 text-[15px]">
                <span aria-hidden="true" className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${MARK[cell.state].style}`}>
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
