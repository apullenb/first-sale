import Link from "next/link";
import { ActorChip } from "@/components/actor-chip";
import { CARD, PRIMARY_LINK, SECONDARY_LINK, SECTION_TITLE } from "@/components/styles";
import { STRUCTURE_LABELS } from "@/lib/details";

type Structure = keyof typeof STRUCTURE_LABELS;

function isStructure(value: string | null): value is Structure {
  return value !== null && Object.hasOwn(STRUCTURE_LABELS, value);
}

// The owner's recorded decision; it's made on /structure, with its sources and a confirm step
export function StructureDecision({ current }: { current: string | null }) {
  const saved = isStructure(current) && current !== "undecided" ? current : null;
  return (
    <section aria-labelledby="structure-decision-title" className={`flex flex-col gap-3 ${CARD}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id="structure-decision-title" className={SECTION_TITLE}>
          Your decision
        </h2>
        <ActorChip actor="owner" />
      </div>
      <p className="text-rule">{saved ? `You recorded: ${STRUCTURE_LABELS[saved]}.` : "You haven’t recorded a structure yet."}</p>
      <p className="text-[15px] text-rule">
        Structure and path compares the options for your business, with their sources, and records your decision after you confirm it.
      </p>
      <Link href="/structure" className={saved ? SECONDARY_LINK : PRIMARY_LINK}>
        Compare your options and record your decision
      </Link>
    </section>
  );
}
