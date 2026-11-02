import { Icon } from "@/components/icons";
import { RECOMMENDED_FILL, RecommendedBadge } from "@/components/recommended";
import type { BusinessStructure } from "@/lib/domain";
import { compareRows, structureOption } from "@/lib/structure/options";
import { FACTS_CHECKED, SourceLink, StateRule } from "./source-link";

const SHORT: Record<BusinessStructure, string> = { sole_proprietorship: "Sole proprietorship", partnership: "Partnership", llc: "LLC", corporation: "Corporation" };

// The options side by side: a table on wide screens, one block per topic on phones
export function Comparison({
  owners,
  options,
  recommended,
  state,
  stateFound,
}: {
  owners: number;
  options: BusinessStructure[];
  recommended: BusinessStructure;
  state: string;
  stateFound: boolean;
}) {
  const rows = compareRows(owners);
  const cell = (id: BusinessStructure, index: number) => {
    const line = rows[index].cells[id];
    return (
      <>
        {line.text}
        {line.stateRule ? <StateRule state={state} found={stateFound} /> : null}
      </>
    );
  };
  return (
    <figure className="flex flex-col gap-2.5">
      <div className="hidden overflow-hidden rounded-xl border border-line md:block">
        <table className="w-full table-fixed text-left text-[15px]">
          <caption className="sr-only">Your options side by side</caption>
          <thead>
            <tr className="border-b border-line bg-soft">
              <th scope="col" className="w-[26%] px-4 py-3">
                <span className="sr-only">Topic</span>
              </th>
              {options.map((id) => (
                <th key={id} scope="col" className={`px-4 py-3 align-top ${id === recommended ? RECOMMENDED_FILL : ""}`}>
                  <span className="flex flex-col items-start gap-1.5">
                    <span className="font-display text-lg leading-snug">{structureOption(id).label}</span>
                    {id === recommended ? <RecommendedBadge /> : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-4 py-3 align-top font-semibold text-rule">
                  {row.label}
                </th>
                {options.map((id) => (
                  <td key={id} className={`px-4 py-3 align-top ${id === recommended ? "bg-pick-tint/40" : ""}`}>
                    {cell(id, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="flex flex-col rounded-xl border border-line md:hidden">
        {rows.map((row, index) => (
          <div key={row.label} className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0">
            <dt className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">{row.label}</dt>
            <dd className={`grid gap-3 ${options.length > 2 ? "grid-cols-1" : "grid-cols-2"}`}>
              {options.map((id) => (
                <div key={id} className="flex min-w-0 flex-col gap-0.5 text-[15px]">
                  <span className={`flex items-center gap-1 text-sm font-semibold ${id === recommended ? "text-pick-ink" : "text-rule"}`}>
                    {id === recommended ? <Icon name="lightbulb" size="xs" /> : null}
                    {SHORT[id]}
                    {id === recommended ? <span className="sr-only">, recommended for you</span> : null}
                  </span>
                  <span>{cell(id, index)}</span>
                </div>
              ))}
            </dd>
          </div>
        ))}
      </dl>

      <figcaption className="text-sm text-muted">
        In short, from SBA and IRS pages checked {FACTS_CHECKED}. The SBA says the details vary by state
        <SourceLink fact="varies_by_state" />. “Each option in detail” below has the details and sources.
      </figcaption>
    </figure>
  );
}
