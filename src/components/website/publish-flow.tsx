"use client";

import Link from "next/link";
import { useState } from "react";
import { finishSiteAction } from "@/app/(app)/website/site-actions";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { PRIMARY, SECONDARY, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { failedMessage } from "@/lib/failure";
import { SiteFrame } from "./site-frame";

interface Props {
  name: string;
  html: string;
  domain: string | null;
  // The saved version shown here; the server refuses a finish if it changed
  signature: string;
  checks: { blockers: string[]; notes: string[] };
  simulated: boolean;
  finished: { at: string; upToDate: boolean } | null;
  hosting: { name: string; monthlyUsd: number; includes: string[] };
}
type Step = "review" | "subscribe" | "done";
const STEPS: { id: Step; label: string }[] = [{ id: "review", label: "Final check" }, { id: "subscribe", label: "Hosting" }, { id: "done", label: "Done" }];
const DEMO_NOTE = "This is a demo. No payment is taken, no card details are ever collected, and nothing is published online.";

// Final preview and checks, then the demo hosting screen, then the demo finish
export function PublishFlow(props: Props) {
  const [step, setStep] = useState<Step>(props.finished?.upToDate ? "done" : "review");
  const [device, setDevice] = useState<"computer" | "phone">("computer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState(props.finished?.upToDate ? props.finished.at : null);
  const blocked = props.checks.blockers.length > 0;
  const at = STEPS.findIndex((each) => each.id === step);

  async function subscribe() {
    setBusy(true); setError(null);
    try {
      const result = await finishSiteAction({ signature: props.signature });
      if (!result.ok) { setError(result.message); return; }
      setFinishedAt(new Date().toISOString()); setStep("done");
    } catch { setError(failedMessage()); }
    finally { setBusy(false); }
  }

  return <div className="flex max-w-[1180px] flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><Link href="/website/editor" className="text-sm font-semibold text-accent">← Back to the editor</Link><h1 className="mt-2 font-display text-[32px] leading-tight sm:text-[38px]">Publish {props.name}</h1><p className="mt-1 text-muted">{props.domain ? `At ${props.domain}. ` : ""}Check your site one last time, then choose hosting.</p></div>
      <ol aria-label="Publishing steps" className="flex items-center gap-2 text-sm">{STEPS.map((each, index) => <li key={each.id} aria-current={each.id === step ? "step" : undefined} className={`flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold ${each.id === step ? "bg-accent text-white" : index < at ? "bg-done-tint text-done" : "bg-wash text-muted"}`}>{index < at ? <Icon name="check" size="sm" /> : <span>{index + 1}</span>}{each.label}</li>)}</ol>
    </div>
    {props.simulated ? <PracticeBanner what="This website uses offline suggestions." /> : null}

    {step === "review" ? <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Website preview" className="min-w-0 overflow-hidden rounded-2xl border border-line bg-wash">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5"><div role="group" aria-label="Preview size" className="flex rounded-lg border border-line p-1">{(["computer", "phone"] as const).map((value) => <button key={value} type="button" aria-pressed={device === value} onClick={() => setDevice(value)} className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold ${device === value ? "bg-accent-tint text-accent" : "text-muted"}`}><Icon name={value === "computer" ? "monitor" : "phone"} size="sm" />{value === "computer" ? "Computer" : "Phone"}</button>)}</div><span className="truncate text-xs text-muted">{props.domain ?? "Your website"}</span></div>
        <div className="p-3 sm:p-4"><SiteFrame key={device} html={props.html} title={`Final preview of ${props.name}`} device={device} height={760} /></div>
      </section>
      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-lg font-semibold">Ready to publish?</h2>
          {blocked ? <div className="mt-4 rounded-xl border border-check-ring bg-check-tint p-4 text-sm text-check"><p className="flex items-center gap-2 font-bold"><Icon name="info" size="sm" />Fix these first</p><ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">{props.checks.blockers.map((message) => <li key={message}>{message}</li>)}</ul></div> : <p className="mt-3 flex items-center gap-2 rounded-xl bg-done-tint px-4 py-3 text-sm font-semibold text-done"><Icon name="check" size="sm" />Everything SnapStart checks is ready.</p>}
          {props.checks.notes.length ? <div className="mt-4"><p className="text-sm font-semibold">Worth a look</p><ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted">{props.checks.notes.map((message) => <li key={message}>{message}</li>)}</ul></div> : null}
          <button type="button" className={`${PRIMARY} mt-5 w-full`} disabled={blocked} onClick={() => setStep("subscribe")}>Publish<span aria-hidden="true">→</span></button>
          {blocked ? <p className="mt-3 text-xs text-muted">Publishing opens once everything above is fixed. <Link href="/website/editor" className={TEXT_LINK}>Open the editor</Link></p> : null}
        </div>
        {props.finished && !props.finished.upToDate ? <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">You finished an earlier version on <LocalDate iso={props.finished.at} />. Your site changed since, so publish again to finish this version.</p> : null}
      </aside>
    </div> : null}

    {step === "subscribe" ? <section aria-labelledby="hosting-title" className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <p role="note" className="flex items-start gap-3 rounded-2xl border border-check-ring bg-check-tint p-4 text-[15px] font-semibold text-check"><Icon name="info" className="mt-0.5 shrink-0" />{DEMO_NOTE}</p>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line bg-soft px-6 py-6 sm:px-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-accent">Last step</p><h2 id="hosting-title" className="mt-2 font-display text-3xl leading-tight">Subscribe to SnapStart web hosting</h2><p className="mt-2 text-sm text-muted">Hosting puts your site online and keeps it updated whenever you change it.</p></div>
        <div className="grid gap-6 px-6 py-6 sm:grid-cols-[1fr_1.2fr] sm:px-8">
          <div className="rounded-xl border-2 border-accent bg-accent-tint/40 p-5" aria-label={`${props.hosting.name} package`} role="group">
            <p className="font-semibold">{props.hosting.name}</p>
            <p className="mt-3 flex items-baseline gap-1"><span className="font-display text-4xl">${props.hosting.monthlyUsd}</span><span className="text-sm text-muted">a month</span></p>
            <span className="mt-2 inline-flex rounded-full bg-check-tint px-2.5 py-0.5 text-xs font-bold text-check">Demo price</span>
            <p className="mt-3 text-xs text-muted">A placeholder until SnapStart sets its real price. Card payments through your own payment links have their own fees.</p>
          </div>
          <div><p className="text-sm font-semibold">What’s included</p><ul className="mt-3 flex flex-col gap-2.5 text-sm">{props.hosting.includes.map((line) => <li key={line} className="flex items-start gap-2.5"><Icon name="check" size="sm" className="mt-0.5 shrink-0 text-done" />{line}</li>)}</ul></div>
        </div>
        <div className="flex flex-col gap-3 border-t border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <button type="button" className={SECONDARY} disabled={busy} onClick={() => setStep("review")}>← Back</button>
          <button type="button" data-writes className={PRIMARY} disabled={busy} onClick={subscribe}>{busy ? "Finishing…" : "Start demo subscription"}</button>
        </div>
        {error ? <p role="alert" className="mx-6 mb-5 rounded-xl border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger sm:mx-8">{error}</p> : null}
      </div>
      <p className="text-center text-xs text-muted">No payment form appears in this demo. You’ll never be asked for card details here.</p>
    </section> : null}

    {step === "done" ? <section aria-labelledby="done-title" className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <div role="status" className="rounded-2xl border border-line bg-surface p-6 text-center shadow-card sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-done-tint text-done"><Icon name="check" /></span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[.14em] text-check">Demo</p>
        <h2 id="done-title" className="mt-2 font-display text-3xl leading-tight">Your website is finished.</h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-muted">Not published online: this is a demo, so nothing went live and no payment was taken.{finishedAt ? <> Finished <LocalDate iso={finishedAt} />.</> : null} If you change your site, publish again to finish the new version.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/website/editor" className={SECONDARY_LINK}>Keep editing</Link><Link href="/website" className={SECONDARY_LINK}>Website setup</Link><button type="button" className={`${TEXT_LINK} text-sm`} onClick={() => setStep("review")}>See the final preview</button></div>
      </div>
    </section> : null}
  </div>;
}
