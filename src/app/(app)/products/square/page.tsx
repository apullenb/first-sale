import { Suspense } from "react";
import Link from "next/link";
import { getMyBusiness, getMySquareState, getMyWebsitePlan, listMyJourneyMarks } from "@/lib/data/my-business";
import { PageHead } from "@/components/ui";
import { TEXT_LINK } from "@/components/styles";
import { hasSquareSite } from "@/lib/website/existing-site";
import { sandboxTokenAvailable } from "@/lib/square/config";
import { SquareEditor } from "./square-editor";

export default function SquarePage({ searchParams }: { searchParams: Promise<{ connection?: string }> }) {
  return <Suspense fallback={<p>Loading your Square connection…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Promise<{ connection?: string }> }) {
  const business = await getMyBusiness();
  if (!business) return <p>Tell us about your business first. <Link href="/business" className={TEXT_LINK}>Your business</Link></p>;
  const [state, plan, marks] = await Promise.all([getMySquareState(), getMyWebsitePlan(), listMyJourneyMarks()]);
  const canConnect = hasSquareSite(plan?.existingSite, marks.find((mark) => mark.key === "website"));
  if (!canConnect && !state.connection) return <p>Record your existing Square site on the <Link href="/website" className={TEXT_LINK}>Website page</Link> before connecting your account.</p>;
  const query = await searchParams;
  return <><PageHead title="Your Square descriptions" lead="Choose a product, draft a change, then review and approve the exact words before updating Square." />
    <Link className={TEXT_LINK} href="/products">Back to your products</Link>
    <SquareEditor sandboxTokenAvailable={sandboxTokenAvailable()} canConnect={canConnect} state={state} connectionResult={query.connection} />
  </>;
}
