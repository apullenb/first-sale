"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { PAGE_TITLE, TEXT_LINK } from "@/components/styles";
import { Card, Chip } from "@/components/ui";
import { launchPace } from "@/lib/rules/pace";
import { daysUntil, formatMinutes } from "@/lib/rules/progress";
import { addDays, dateParts, formatDay } from "./dates";

// Everything here counts from today: the server uses today in UTC, the browser switches to the owner's own today

const subscribe = () => () => {};
const pad = (n: number) => String(n).padStart(2, "0");

function useToday(): string {
  return useSyncExternalStore(
    subscribe,
    () => {
      const now = new Date();
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    },
    () => new Date().toISOString().slice(0, 10),
  );
}

function daysFrom(today: string, date: string): number {
  const [year, month, day] = dateParts(today);
  return daysUntil(date, new Date(year, month - 1, day));
}

// Date line, greeting and where things stand, at the top of Today
export function TodayHead({ name, business, launchDate, ready }: { name: string | null; business: string | null; launchDate: string | null; ready: boolean }) {
  const today = useToday();
  const hour = useSyncExternalStore(subscribe, () => new Date().getHours(), () => -1);
  const greeting = hour < 0 ? "Hello" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const days = launchDate ? daysFrom(today, launchDate) : null;
  const who = business ?? "Your business";
  const status = ready
    ? `${who} is ready for its first sale.`
    : days === null
      ? "Here’s your next step."
      : days < 0
        ? "Your launch date has passed. Here’s your next step."
        : `${who} opens ${days === 0 ? "today" : `in ${days} ${days === 1 ? "day" : "days"}`}. Here’s your next step.`;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14.5px] font-semibold tracking-[0.02em] text-muted">
        <time dateTime={today}>{formatDay(today, { weekday: "long", month: "long", day: "numeric" })}</time>
      </p>
      <h1 className={PAGE_TITLE}>
        {greeting}
        {name ? `, ${name}` : ""}.
      </h1>
      <p className="max-w-2xl text-[17px] text-muted sm:text-lg">{status}</p>
    </div>
  );
}

const BIG = "font-display text-[38px] leading-none tabular-nums sm:text-[42px]";

export function LaunchCountdown({ date }: { date: string }) {
  const days = daysFrom(useToday(), date);
  if (days < 0) return <p className={BIG}>Passed</p>;
  if (days === 0) return <p className={BIG}>Today</p>;
  return (
    <p className={BIG}>
      {days}
      <small className="ml-1.5 font-sans text-[15px] text-muted">{days === 1 ? "day to go" : "days to go"}</small>
    </p>
  );
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// The launch month, with launch day circled and today underlined; the card states both in words
export function LaunchMonth({ date }: { date: string }) {
  const [year, month, day] = dateParts(date);
  const [thisYear, thisMonth, thisDay] = dateParts(useToday());
  const today = thisYear === year && thisMonth === month ? thisDay : null;
  const blanks = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return (
    <div aria-hidden="true" className="grid grid-cols-7 gap-0.5 text-center text-[13px] tabular-nums text-muted">
      {WEEKDAYS.map((weekday, index) => (
        <b key={index} className="pb-0.5 text-[11.5px] font-bold tracking-[0.04em] text-faint">
          {weekday}
        </b>
      ))}
      {Array.from({ length: blanks }, (_, index) => (
        <span key={`blank-${index}`} />
      ))}
      {Array.from({ length }, (_, index) => index + 1).map((each) => (
        <span
          key={each}
          className={`relative py-[3px] leading-snug ${
            each === day ? "font-extrabold text-accent" : each === today ? "font-bold text-ink underline decoration-accent underline-offset-[3px]" : ""
          }`}
        >
          {each}
          {each === day ? (
            <svg viewBox="0 0 32 26" className="absolute left-1/2 top-1/2 h-[26px] w-8 -translate-x-1/2 -translate-y-1/2 -rotate-6 overflow-visible">
              <path
                d="M17 3.5C9 2.8 3 7 3.3 13.4 3.6 20 11 23 17.5 22.5 24.5 22 29.3 17.6 28.6 11.6 28 6 22.5 3 15.5 3.6"
                className="fill-none stroke-accent [stroke-dasharray:80] [stroke-linecap:round] [stroke-width:1.6] motion-safe:animate-pen motion-safe:[stroke-dashoffset:80]"
              />
            </svg>
          ) : null}
        </span>
      ))}
    </div>
  );
}

// From today to launch day: about an hour of the owner's time a day, with the time offices take left out
export function LaunchSchedule({ date, minutes, waiting }: { date: string; minutes: number; waiting: number }) {
  const today = useToday();
  const daysLeft = daysFrom(today, date);
  const pace = launchPace(minutes, daysLeft);
  const readyOn = formatDay(addDays(today, pace.workDays), { month: "short", day: "numeric" });
  const share = daysLeft > 0 ? Math.min(100, (pace.workDays / daysLeft) * 100) : 100;
  const changeLink = (
    <Link href="/business/edit" className={`-my-3 py-3 text-[14.5px] ${TEXT_LINK}`}>
      Change it<span className="sr-only"> (your launch date)</span>
    </Link>
  );
  return (
    <Card
      title="Your schedule to launch day"
      icon="calendar"
      id="schedule-heading"
      action={
        daysLeft > 0 ? (
          <Chip tone={pace.onTrack ? "done" : "warn"} icon={pace.onTrack ? "check" : "info"}>
            {pace.onTrack ? "On track" : "Tight"}
          </Chip>
        ) : null
      }
    >
      {daysLeft <= 0 ? (
        <p className="flex flex-wrap items-center gap-x-3 text-muted">
          {daysLeft === 0 ? "Launch day is today." : "Your launch date has passed."} {changeLink}
        </p>
      ) : (
        <>
          <div aria-hidden="true" className="flex flex-col gap-2 pt-1">
            <div className="flex items-end justify-between gap-3 text-[13px] font-bold">
              <span>Today</span>
              <span className="flex items-center gap-1.5 text-right">
                Launch day {formatDay(date, { month: "short", day: "numeric" })}
                <Icon name="flag" size="sm" className="text-accent" />
              </span>
            </div>
            <div className="relative mx-2 h-2.5 rounded-full bg-wash ring-1 ring-inset ring-ink/5">
              {pace.workDays ? <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${share}%` }} /> : null}
              <span className="absolute -left-2 top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-ink bg-surface" />
              {pace.workDays && share < 100 ? <span className="absolute -inset-y-1.5 w-px bg-muted" style={{ left: `${share}%` }} /> : null}
              <span className="absolute -inset-y-2.5 right-0 w-0.5 rounded-full bg-ink" />
            </div>
            {pace.workDays ? (
              <div className="relative mx-2 h-5 text-[13px] text-muted">
                <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.min(84, Math.max(12, share))}%` }}>
                  Ready ~{readyOn}
                </span>
              </div>
            ) : null}
          </div>
          <p className="text-[15px] text-muted">
            {pace.workDays
              ? `At about an hour a day, you’d be ready around ${readyOn}${pace.spareDays < 0 ? ", after launch day" : ""}.`
              : "Nothing is left for you to do before launch day."}
            {waiting ? " Time spent waiting to hear back from offices isn’t counted." : ""}
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-muted">
            {minutes ? (
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-accent" />
                Your time: about {formatMinutes(minutes)}
              </li>
            ) : null}
            <li>
              {pace.spareDays >= 0
                ? `${pace.spareDays} ${pace.spareDays === 1 ? "day" : "days"} to spare`
                : `About ${-pace.spareDays} ${pace.spareDays === -1 ? "day" : "days"} more than you have`}
            </li>
          </ul>
        </>
      )}
    </Card>
  );
}
