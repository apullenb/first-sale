import Link from "next/link";
import { Suspense } from "react";
import { OperationSetupPanel } from "@/components/operations/setup";
import { PRIMARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { getMyBusiness, listMyOperationSetups } from "@/lib/data/my-business";
import { OPERATIONS, type OperationKind } from "@/lib/operations/catalog";

export function OperationPage({ kind }: { kind: OperationKind }) {
  const definition = OPERATIONS[kind];
  return <div className="flex max-w-3xl flex-col gap-6"><PageHead kicker="Run your business" title={definition.title} lead={definition.description} /><Link href="/run" className={TEXT_LINK}>All workflows</Link><Suspense fallback={<p className="text-muted">Loading your setup…</p>}><Setup kind={kind} /></Suspense></div>;
}

async function Setup({ kind }: { kind: OperationKind }) {
  const [business, setups] = await Promise.all([getMyBusiness(), listMyOperationSetups()]);
  if (!business) return <Card title="Tell us about your business first" id="business-first"><p>Then choose how you want help with your daily work.</p><Link href="/business/new" className={PRIMARY_LINK}>Tell us about your business</Link></Card>;
  const saved = setups.find((setup) => setup.kind === kind) ?? null;
  return <OperationSetupPanel key={`${business.id}:${kind}`} kind={kind} initial={saved ? { config: saved.config, paused: saved.paused } : null} />;
}
