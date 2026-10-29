import Link from "next/link";
import { Icon } from "@/components/icons";
import { PRIMARY_LINK, SECONDARY_LINK } from "@/components/styles";
import { STRUCTURE_LABELS } from "@/lib/details";

type Structure = keyof typeof STRUCTURE_LABELS;

function isStructure(value: string | null): value is Structure {
  return value !== null && Object.hasOwn(STRUCTURE_LABELS, value);
}

// The owner's recorded decision; it's made on /structure, with its sources and a confirm step
export function StructureDecision({ current }: { current: string | null }) {
  const saved = isStructure(current) && current !== "undecided" ? current : null;
  return (
    <div className="flex flex-col items-start gap-3">
      {saved ? (
        <p className="flex items-start gap-2 font-semibold">
          <Icon name="check" size="sm" className="mt-0.5 text-done" />
          <span>You recorded: {STRUCTURE_LABELS[saved]}</span>
        </p>
      ) : (
        <p className="text-rule">You haven’t recorded a structure yet.</p>
      )}
      <p className="text-[15px] text-muted">
        Structure and path compares the options for your business, with their sources, and records your decision after you confirm it.
      </p>
      <Link href="/structure" className={saved ? SECONDARY_LINK : PRIMARY_LINK}>
        Compare your options and record your decision
        <Icon name="arrow" size="sm" />
      </Link>
    </div>
  );
}
