"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { buildWebsiteAction, startWebsiteCopyAction } from "@/app/(app)/website/actions";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { PRIMARY, SECONDARY, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { failedMessage } from "@/lib/failure";
import { SiteFrame } from "./site-frame";

interface Props {
  chosen: "first_sale" | "square" | "wix" | "shopify" | null;
  domain: string | null;
  hasDraft: boolean;
  updatedAt: string | null;
  options: ReactNode;
  address: ReactNode;
  square: ReactNode;
  preview: string | null;
  name: string;
  products: number;
  images: number;
  building: boolean;
  approved: boolean;
  // The last demo finish; upToDate when nothing changed since
  finished: { at: string; upToDate: boolean } | null;
}
export function WebsiteSetup(props: Props) {
  const router = useRouter();
  const [editingOption, setEditingOption] = useState(!props.chosen);
  const [editingAddress, setEditingAddress] = useState(!props.domain);
  const [seen, setSeen] = useState({ chosen: props.chosen, domain: props.domain });
  const [busy, setBusy] = useState<"build" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (seen.chosen !== props.chosen || seen.domain !== props.domain) {
    if (seen.chosen !== props.chosen) setEditingOption(!props.chosen);
    if (seen.domain !== props.domain) setEditingAddress(!props.domain);
    setSeen({ chosen: props.chosen, domain: props.domain });
  }
  async function open(mode: "build" | "edit") {
    if (mode === "build" && props.hasDraft && !window.confirm("Build a new draft from your brand and catalog? This replaces your current website draft.")) return;
    if (mode === "edit" && props.hasDraft) { router.push("/website/editor"); return; }
    setBusy(mode); setError(null);
    try {
      const result = mode === "build" ? await buildWebsiteAction() : await startWebsiteCopyAction();
      if (!result.ok) { setError(result.message); setBusy(null); return; }
      router.push("/website/editor");
    } catch { setError(failedMessage()); setBusy(null); }
  }
  const building = busy === "build" || props.building;
  const builtHere = props.chosen === "first_sale";
  const unavailable = props.chosen === "wix" || props.chosen === "shopify";
  return <div className="flex flex-col gap-6">
    <section aria-labelledby="step-choose" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-6"><div className="flex items-center gap-4"><span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${props.chosen && !unavailable ? "bg-done-tint text-done" : "bg-soft text-muted"}`}>{props.chosen && !unavailable ? <Icon name="check" size="sm" /> : "1"}</span><div><h2 id="step-choose" className="text-lg font-semibold">How you’ll build it</h2><p className="mt-0.5 text-sm text-muted">{props.chosen && !editingOption ? builtHere ? "SnapStart website · Built around your brand" : unavailable ? "This option is coming soon. Choose another." : "Square · Set it up there, manage products here" : "Build here or connect a site you already have."}</p></div></div>{props.chosen ? <button type="button" onClick={() => setEditingOption((value) => !value)} className="shrink-0 text-sm font-semibold text-accent">{editingOption ? "Done" : "Edit option"}</button> : null}</div>
      {editingOption || unavailable ? <div className="border-t border-line bg-soft/40 p-5 sm:p-6">{props.options}</div> : null}
    </section>
    <section aria-labelledby="step-address" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-6"><div className="flex items-center gap-4"><span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${props.domain ? "bg-done-tint text-done" : "bg-soft text-muted"}`}>{props.domain ? <Icon name="check" size="sm" /> : "2"}</span><div><h2 id="step-address" className="text-lg font-semibold">Your web address</h2><p className="mt-0.5 text-sm text-muted">{props.domain && !editingAddress ? props.domain : builtHere ? "Choose an address now, or build first and decide later." : props.chosen === "square" ? "Save the Square site you set up outside SnapStart." : "Choose a website option first."}</p></div></div>{props.domain && builtHere ? <button type="button" className="shrink-0 text-sm font-semibold text-accent" onClick={() => setEditingAddress((value) => !value)}>{editingAddress ? "Done" : "Edit address"}</button> : null}</div>
      {builtHere && editingAddress ? <div className="border-t border-line px-5 py-5 sm:px-6">{props.address}<p className="mt-4 text-xs text-muted">Selecting an address doesn’t register it. Registration and hosting come when you’re ready to launch.</p></div> : null}
      {props.chosen === "square" ? <div className="border-t border-line px-5 py-5 sm:px-6">{props.square}</div> : null}
    </section>
    {builtHere ? <section aria-label="Your website draft" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_1.1fr] md:items-center"><div><span className="inline-flex rounded-full bg-accent-tint px-3 py-1 text-xs font-semibold text-accent">{props.finished?.upToDate ? "Finished · Demo" : props.hasDraft ? "Your website draft" : "Made for your business"}</span><h2 className="mt-4 font-display text-3xl leading-tight">{props.hasDraft ? "Design it, check it, publish it." : "Let’s make something worth visiting."}</h2><p className="mt-3 text-sm leading-relaxed text-muted">{props.hasDraft ? "Change words, photos and colors in the editor and see every change as you make it. When it looks right, publish." : "SnapStart turns your brand, products and photos into a first draft in about a minute. You can change everything."}</p>
        {props.hasDraft ? <ol aria-label="Your website progress" className="mt-5 flex flex-col gap-2 text-sm">{([["Draft built", true], ["Words approved", props.approved], ["Published (demo)", Boolean(props.finished?.upToDate)]] as const).map(([label, done]) => <li key={label} className="flex items-center gap-2.5"><span className={`grid size-5 shrink-0 place-items-center rounded-full ${done ? "bg-done-tint text-done" : "border border-line-strong"}`}>{done ? <Icon name="check" size="sm" /> : null}</span><span className={done ? "" : "text-muted"}>{label}</span></li>)}</ol> : <p className="mt-4 text-xs text-muted">Uses your {props.products} saved {props.products === 1 ? "product or service" : "products and services"} and {props.images} library {props.images === 1 ? "image" : "images"}.</p>}
        {props.hasDraft && props.updatedAt ? <p className="mt-3 text-xs text-muted">Last saved <LocalDate iso={props.updatedAt} />{props.finished && !props.finished.upToDate ? " · Changed since you last published" : ""}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">{props.hasDraft ? <><button type="button" data-writes className={PRIMARY} disabled={Boolean(busy) || props.building} onClick={() => open("edit")}>{busy === "edit" ? "Opening…" : "Edit website"}<span aria-hidden="true">↗</span></button><Link href="/website/publish" className={SECONDARY_LINK}><Icon name="globe" size="sm" />Publish website</Link></> : null}<button type="button" data-writes className={props.hasDraft ? `${TEXT_LINK} text-sm` : PRIMARY} disabled={Boolean(busy) || props.building} aria-busy={building} onClick={() => open("build")}>{building ? "Building your website…" : props.hasDraft ? "Start over: build a new draft" : "Build it for me"}{building ? <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" /> : props.hasDraft ? null : <span aria-hidden="true">✦</span>}</button>{props.hasDraft ? null : <button type="button" data-writes className={SECONDARY} disabled={Boolean(busy) || props.building} onClick={() => open("edit")}>{busy === "edit" ? "Opening…" : "Start from a blank page"}</button>}</div>{error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}{building ? <p role="status" className="mt-4 text-sm text-accent">Writing the page and shaping its layout, typography and imagery from your saved brand. This can take a minute.</p> : null}</div><div className="overflow-hidden rounded-xl border border-line bg-wash p-3">{props.preview ? <div aria-hidden="true" className="pointer-events-none max-h-[310px] overflow-hidden rounded-lg bg-white shadow-card"><SiteFrame html={props.preview} title={`Draft of ${props.name}`} device="computer" /></div> : <div className="flex aspect-[4/3] flex-col justify-center rounded-lg bg-surface p-7 shadow-card"><div className="mb-10 flex items-center justify-between"><div className="h-3 w-16 rounded bg-line" /><div className="flex gap-2"><div className="h-2 w-7 rounded bg-line" /><div className="h-2 w-7 rounded bg-line" /></div></div><div className="grid grid-cols-2 gap-5"><div className="flex flex-col justify-center gap-3"><div className="h-5 w-full rounded bg-accent/15" /><div className="h-5 w-4/5 rounded bg-accent/15" /><div className="mt-1 h-2 w-full rounded bg-line" /><div className="h-2 w-3/4 rounded bg-line" /><div className="mt-2 h-7 w-16 rounded bg-accent" /></div><div className="aspect-[4/5] rounded-t-[40%] rounded-b-lg bg-gradient-to-br from-accent/20 to-accent/5" /></div><p className="mt-7 text-center text-[10px] uppercase tracking-[.15em] text-muted">Your brand. Your story. Your website.</p></div>}</div></div>
    </section> : null}
    {!props.chosen ? <p className="text-center text-sm text-muted">Choose an option to get started. You can change it later.</p> : props.chosen === "square" ? <p className="text-sm text-muted">Set up the design and checkout in Square, then connect your account to import and manage products in SnapStart. <Link href="/products" className={TEXT_LINK}>Manage products →</Link></p> : null}
  </div>;
}
