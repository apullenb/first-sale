import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card } from "@/components/ui";
import type { Stage, StageState } from "@/lib/rules/journey";
import { costWords } from "@/lib/rules/next-action";
import { formatMinutes, MAX_SITTING_MINUTES } from "@/lib/rules/progress";
import { formatDay } from "./dates";
import { LaunchCountdown, LaunchMonth } from "./launch-countdown";

const BIG = "font-display text-[34px] leading-none tabular-nums sm:text-[42px]";
const UNIT = "ml-1.5 font-sans text-sm text-muted sm:text-[15px]";
const SUB = "text-[14px] leading-snug text-muted sm:text-[14.5px]";
const LINK = `-my-3 mt-auto w-fit py-3 text-[14.5px] ${TEXT_LINK}`;
// One shade per kind of step, darkest for the most time
const SHADES = ["bg-accent", "bg-accent/60", "bg-accent-ring"];

const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

interface Props {
  left: number;
  minutes: number;
  waiting: number;
  // Paperwork parts with time left, each 90 minutes or less
  parts: { name: string; href: string; minutes: number }[];
  // Official fees on finished steps; SnapStart doesn't record payments
  finishedCents: number;
  // Confirmed fees still to pay, and the steps whose fee no official page stated
  toGoCents: number;
  unknownFees: string[];
  budgetCapCents: number | null;
  budgetLabel: string | null;
  // Steps needed before the first sale
  done: number;
  total: number;
  stages: Stage[];
}

// Index cards under "Do this next": what's left, what it's cost, and how far along the owner is
export function DashboardWidgets({ left, minutes, waiting, parts, finishedCents, toGoCents, unknownFees, budgetCapCents, budgetLabel, done, total, stages }: Props) {
  const knownCents = finishedCents + toGoCents;
  const knownShare = budgetCapCents ? Math.min(100, (knownCents / budgetCapCents) * 100) : 0;
  const words = costWords({ startupCents: knownCents, unknown: unknownFees });
  // The biggest two parts by name, then the rest together
  const shares = [
    ...parts.slice(0, 2).map((part) => ({ label: part.name, minutes: part.minutes })),
    ...(parts.length > 2 ? [{ label: `${parts.length - 2} more ${parts.length === 3 ? "part" : "parts"}`, minutes: parts.slice(2).reduce((sum, part) => sum + part.minutes, 0) }] : []),
  ];
  return (
    <section aria-label="At a glance" className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @2xl:gap-5">
      <Stat id="stat-left" title="Left to do" icon="checklist">
        <p className={BIG}>
          {left}
          <small className={UNIT}>{left === 1 ? "step" : "steps"}</small>
        </p>
        {minutes ? (
          <div aria-hidden="true" className="my-1.5 flex h-2 overflow-hidden rounded-full bg-wash">
            {shares.map((share, index) => (
              <i key={share.label} className={`block h-full ${SHADES[index]}`} style={{ width: `${(share.minutes / minutes) * 100}%` }} />
            ))}
          </div>
        ) : null}
        <p className={SUB}>
          {left ? `In ${parts.length} ${parts.length === 1 ? "part" : "parts"}, each ${formatMinutes(MAX_SITTING_MINUTES)} or less` : "Nothing left before your first sale"}
        </p>
        {shares.length > 1 ? (
          <ul className="flex flex-col gap-0.5 text-[13.5px] text-muted @5xl:flex-row @5xl:flex-wrap @5xl:gap-x-3.5">
            {shares.map((share, index) => (
              <li key={share.label} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-[3px] ${SHADES[index]}`} />
                {share.label}
                {share.minutes <= MAX_SITTING_MINUTES ? ` ~${formatMinutes(share.minutes)}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
        {waiting ? (
          <p className={`flex items-center gap-1.5 ${SUB}`}>
            <Icon name="hourglass" size="xs" className="text-check" />
            {waiting} waiting to hear back
          </p>
        ) : null}
        <Link href="/start" className={LINK}>
          See every step
        </Link>
      </Stat>

      <Stat id="stat-money" title="Startup fees" icon="dollar">
        <p className={BIG}>
          {dollars(knownCents)}
          <small className={UNIT}>known{budgetCapCents ? ` of ${dollars(budgetCapCents)}` : ""}</small>
        </p>
        {budgetCapCents ? (
          <div role="img" aria-label={`Known fees are ${Math.round(knownShare)} percent of your budget`} className="my-1.5 flex h-2 overflow-hidden rounded-full bg-wash">
            <i className="block h-full bg-accent" style={{ width: `${knownShare}%` }} />
          </div>
        ) : (
          <p className={SUB}>{budgetLabel ? `Budget: ${budgetLabel.toLowerCase()}` : "No budget set"}</p>
        )}
        <p className={SUB}>
          {words.unconfirmed ? `${words.unconfirmed}. ${words.total}.` : `${words.total}.`}
          {finishedCents ? ` ${dollars(finishedCents)} of it is on steps you finished.` : ""}
        </p>
        <Link href="/start#costs-heading" className={LINK}>
          See costs
        </Link>
      </Stat>

      <Stat id="stat-progress" title="Your progress" icon="ramp" className="col-span-2 @2xl:col-span-1">
        <p className={SUB}>
          <b className="font-bold text-ink">
            {done} of {total}
          </b>{" "}
          {total === 1 ? "step" : "steps"} done before your first sale
        </p>
        <Ramp done={done} total={total} stages={stages.filter((stage) => stage.state !== "anytime")} />
      </Stat>
    </section>
  );
}

// A compact index card; smaller header on phones so two fit side by side
function Stat({ id, title, icon, className = "", children }: { id: string; title: string; icon: IconName; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-card ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3 sm:gap-3 sm:px-5 sm:py-3.5">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[9px] border border-accent-ring bg-accent-tint text-accent sm:size-9 sm:rounded-[10px]">
          <Icon name={icon} size="sm" />
        </span>
        <h2 id={id} className="min-w-0 flex-1 text-[15px] font-bold leading-tight sm:text-base">{title}</h2>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-3.5 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4">{children}</div>
    </section>
  );
}

const POST: Record<StageState, { ring: string; fill: string; text: string; label: string }> = {
  done: { ring: "stroke-accent", fill: "fill-accent", text: "fill-white", label: "done" },
  now: { ring: "stroke-accent", fill: "fill-accent-tint", text: "fill-accent-ink", label: "up next" },
  check: { ring: "stroke-check", fill: "fill-check-tint", text: "fill-check", label: "needs your OK" },
  todo: { ring: "stroke-line-strong", fill: "fill-white", text: "fill-muted", label: "not started" },
  anytime: { ring: "stroke-line-strong", fill: "fill-white", text: "fill-muted", label: "any time" },
};

// The ramp fills as steps get done; each post is a stage of starting the business, and the flag is the first sale
function Ramp({ done, total, stages }: { done: number; total: number; stages: Stage[] }) {
  const share = total ? done / total : 1;
  const [x0, y0, x1, y1] = [14, 94, 204, 34];
  const at = (fraction: number) => [x0 + (x1 - x0) * fraction, y0 + (y1 - y0) * fraction] as const;
  const [px, py] = at(Math.max(share, 0.04));
  return (
    <svg viewBox="0 0 240 112" role="img" aria-label={`${done} of ${total} steps done`} className="mx-auto mt-auto h-auto w-full max-w-[300px]">
      <path d={`M${x0} ${y0 + 8}L${x1} ${y1 + 8}L${x1} ${y0 + 8}Z`} className="fill-wash" />
      <line x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth="7" strokeLinecap="round" className="stroke-line" />
      <line x1={x0} y1={y0} x2={px} y2={py} strokeWidth="7" strokeLinecap="round" className="stroke-accent" />
      {stages.map((stage, index) => {
        const [x, y] = at(stages.length > 1 ? index / (stages.length - 1) : 0);
        const style = POST[stage.state];
        return (
          <g key={stage.href}>
            <title>{`${stage.title}: ${style.label}`}</title>
            <line x1={x} y1={y - 4} x2={x} y2={y - 16} strokeWidth="1.6" className={style.ring} />
            <circle cx={x} cy={y - 19} r="9" strokeWidth="1.4" className={`${style.fill} ${style.ring}`} />
            <text x={x} y={y - 15.3} textAnchor="middle" fontSize="11" fontWeight="700" className={`font-sans ${style.text}`}>
              {index + 1}
            </text>
          </g>
        );
      })}
      <path d={`M${x1 + 14} ${y1 + 6}V${y1 - 14}`} strokeWidth="1.6" className="stroke-rule" />
      <path d={`M${x1 + 14} ${y1 - 14}h11l-3 4 3 4h-11z`} className="fill-accent" />
    </svg>
  );
}

// Launch day with a small month calendar, or a nudge to pick one
export function LaunchCard({ date }: { date: string | null }) {
  return (
    <Card title="Launch day" icon="calendar" id="launch-heading" className="flex flex-col" bodyClassName="flex-1">
      {date ? (
        <>
          <div className="flex items-baseline justify-between gap-2.5">
            <LaunchCountdown date={date} />
            <Link href="/business/edit" className={`-my-3 py-3 text-[14.5px] ${TEXT_LINK}`}>
              Change<span className="sr-only"> your launch date</span>
            </Link>
          </div>
          <p className="text-[14.5px] font-bold">{formatDay(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
          <LaunchMonth date={date} />
        </>
      ) : (
        <>
          <p className={SUB}>No goal date yet. A rough one helps you pace your steps.</p>
          <Link href="/business/edit" className={SECONDARY_LINK}>
            <Icon name="calendar" size="sm" />
            Set a date
          </Link>
        </>
      )}
    </Card>
  );
}
