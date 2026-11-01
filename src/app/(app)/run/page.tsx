import Link from "next/link";
import { Suspense } from "react";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, Chip, PageHead } from "@/components/ui";
import { listMyOperationSetups } from "@/lib/data/my-business";
import { OPERATIONS, OPERATION_KINDS } from "@/lib/operations/catalog";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/run");

export default function RunPage() {
  return <div className="flex max-w-4xl flex-col gap-6"><PageHead kicker="Your daily workspace" title="Run your business" lead="Choose the work you want help with. We’ll walk you through the setup, then you can try it with a sample." /><p className="rounded-xl border border-check-ring bg-check-tint p-4 text-check"><strong>Try the setup in demo mode.</strong> Live account connections and background automation are not available yet. Your saved preferences will be here when you return.</p><Suspense fallback={<p className="text-muted">Loading your workflows…</p>}><Workflows /></Suspense><Card title="You stay in charge" id="in-charge"><p>Replies wait for your review. Orders, stock and payments change only through confirmed actions. Connecting a tool will require your permission.</p></Card></div>;
}

async function Workflows() {
  const setups = await listMyOperationSetups();
  return <div className="grid gap-5 md:grid-cols-2">{OPERATION_KINDS.map((kind) => {
    const definition = OPERATIONS[kind];
    const saved = setups.find((setup) => setup.kind === kind);
    return <Card key={kind} title={definition.title} icon={kind === "email" ? "file" : "receipt"} id={`workflow-${kind}`}><Chip tone={saved ? "accent" : "gray"}>{saved ? saved.paused ? "Demo paused" : "Demo setup saved" : "Ready to set up"}</Chip><p className="text-muted">{definition.description}</p><p className="text-sm text-rule">{definition.trigger}</p><Link href={definition.href} className={PRIMARY_LINK}>{saved ? "Manage setup" : "Set this up"}</Link></Card>;
  })}</div>;
}
