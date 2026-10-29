import Link from "next/link";
import { formatLaunchDate } from "@/lib/intake/answers";
import { formatMinutes } from "@/lib/rules/progress";
import { LaunchCountdown } from "./launch-countdown";

const TILE = "flex min-w-0 flex-col gap-1 rounded-2xl bg-surface p-3 ring-1 ring-ink/5 sm:p-4";
const LABEL = "text-xs font-bold uppercase tracking-wider text-muted";
const BIG = "font-display text-2xl font-bold sm:text-3xl";
const SMALL = "text-[13px] leading-snug text-rule sm:text-sm";
const LINK = "mt-auto flex min-h-11 w-fit items-center text-[13px] font-semibold text-accent-ink underline underline-offset-4 sm:text-sm";

const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

interface Props {
  left: number;
  minutes: number;
  waiting: number;
  spentCents: number;
  // Confirmed fees still to pay, and how many fees no official page stated
  toGoCents: number;
  unknownFees: number;
  budgetCapCents: number | null;
  budgetLabel: string | null;
  launchDate: string | null;
}

// Three numbers at the top of Today: what's left, what it's cost, and how long until launch
export function DashboardWidgets({ left, minutes, waiting, spentCents, toGoCents, unknownFees, budgetCapCents, budgetLabel, launchDate }: Props) {
  const spentShare = budgetCapCents ? Math.min(100, (spentCents / budgetCapCents) * 100) : 0;
  const toGoShare = budgetCapCents ? Math.min(100 - spentShare, (toGoCents / budgetCapCents) * 100) : 0;
  return (
    <section aria-label="At a glance" className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className={TILE}>
        <h2 className={LABEL}>Left to do</h2>
        <p className={BIG}>
          {left}
          <span className="ml-1 text-sm font-semibold text-muted">{left === 1 ? "step" : "steps"}</span>
        </p>
        <p className={SMALL}>{left ? `About ${formatMinutes(minutes)} of your time` : "Nothing left before your first sale"}</p>
        {waiting ? <p className={SMALL}>{waiting} waiting to hear back</p> : null}
        <Link href="/checklist" className={LINK}>
          See them
        </Link>
      </div>

      <div className={TILE}>
        <h2 className={LABEL}>Spent so far</h2>
        <p className={BIG}>{dollars(spentCents)}</p>
        <p className={SMALL}>{budgetCapCents ? `of ${dollars(budgetCapCents)} budget` : budgetLabel ? `Budget: ${budgetLabel.toLowerCase()}` : "No budget set"}</p>
        {budgetCapCents ? (
          <div aria-hidden="true" className="flex h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-accent" style={{ width: `${spentShare}%` }} />
            <div className="h-full bg-accent/35" style={{ width: `${toGoShare}%` }} />
          </div>
        ) : null}
        <p className={SMALL}>
          {toGoCents
            ? `${dollars(toGoCents)} more to go${unknownFees ? `, plus ${unknownFees} not confirmed` : ""}`
            : unknownFees
              ? `${unknownFees} ${unknownFees === 1 ? "fee" : "fees"} not confirmed yet`
              : "No more fees found"}
        </p>
      </div>

      <div className={TILE}>
        <h2 className={LABEL}>Launch</h2>
        {launchDate ? (
          <>
            <LaunchCountdown date={launchDate} />
            <p className={SMALL}>Goal: {formatLaunchDate(launchDate)}</p>
          </>
        ) : (
          <>
            <p className={BIG}>–</p>
            <p className={SMALL}>No goal date yet</p>
          </>
        )}
        <Link href="/business/edit" className={LINK}>
          {launchDate ? "Change it" : "Set a date"}
        </Link>
      </div>
    </section>
  );
}
