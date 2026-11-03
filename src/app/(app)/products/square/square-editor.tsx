"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { PracticeBanner } from "@/components/practice-banner";
import { connectSquareSandboxAction, connectSquareAction, loadSquareItemsAction, draftSquareAction, editSquareAction, approveSquareAction, disconnectSquareAction } from "./actions";

type Draft = { id: string; name: string; original: string; description: string; simulated: boolean; status: string };
type State = { connection: { merchantId: string | null; environment: string; sandboxTokenTest?: boolean } | null; drafts: Draft[] };
export function SquareEditor({ state, connectionResult, canConnect, sandboxTokenAvailable }: { state: State; connectionResult?: string; canConnect: boolean; sandboxTokenAvailable: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState(connectionResult === "connected" ? "Square connected." : connectionResult === "failed" ? "Square sign-in did not complete. Connect again." : "");
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [itemId, setItemId] = useState("");
  const [request, setRequest] = useState("");
  function run(job: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    start(async () => {
      try { const result = await job(); setMessage(result.ok ? result.message || success : result.message || "Try again."); }
      catch { setMessage("The request was interrupted. Reload to check its saved status before retrying."); }
    });
  }
  return <div className="flex flex-col gap-5">
    <p role="status" aria-label="Square connection status" aria-live="polite">{pending ? "Working…" : message}</p>
    <Card title="Square account">
      {state.connection ? <>
        <p>Connected merchant: {state.connection.merchantId}. Approved changes update your connected Square catalog.</p>
        <p>Permissions: read and update your product catalog.</p>
        <div className="flex flex-wrap gap-3">
          <button disabled={pending} className={SECONDARY} onClick={() => run(async () => { const result = await loadSquareItemsAction(); if (result.ok) { setItems(result.value); setLoaded(true); } return result; }, "Products loaded.")}>Load Square products</button>
          <button disabled={pending} className={SECONDARY} onClick={() => run(async () => {
            const result = await disconnectSquareAction();
            if (result.ok) { setItems([]); setLoaded(false); setItemId(""); }
            return result.ok ? { ok: true, message: result.value ? "Square disconnected." : "Saved credentials removed. Square revocation could not be confirmed; remove SnapStart in your Square account’s app settings too." } : result;
          }, "Square disconnected.")}>Disconnect Square</button>
        </div>
      </> : <p>Connect the Square account that holds your products. SnapStart sends changes only after you approve them.</p>}
      {canConnect && sandboxTokenAvailable ? <button className={SECONDARY} disabled={pending} onClick={() => run(connectSquareSandboxAction, "Square account connected.")}>{state.connection ? "Reconnect Square" : "Connect Square"}</button> : canConnect ? <button className={SECONDARY} disabled={pending} onClick={() => run(async () => { const result = await connectSquareAction(); if (result.ok) window.location.assign(result.value.url); return result; }, "Opening Square…")}>{state.connection ? "Reconnect Square" : "Connect Square"}</button> : null}
    </Card>
    {state.connection && loaded ? <Card title="Draft a description change">
      {items.length ? <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); run(() => draftSquareAction({ itemId, request }), "Draft saved below. Review the words before approving."); }}>
        <label htmlFor="square-product">Square product</label>
        <select id="square-product" className={INPUT} required value={itemId} onChange={(event) => setItemId(event.target.value)}><option value="">Choose a product</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.id.slice(-6)})</option>)}</select>
        <label htmlFor="square-request">What would you like to change?</label>
        <textarea id="square-request" className={INPUT} required maxLength={1000} value={request} onChange={(event) => setRequest(event.target.value)} placeholder="Make my candle description warmer and shorter." />
        <p>Rewrites use the name and existing description as facts. Add missing ingredients, scents or other facts in Square first.</p>
        <button className={PRIMARY} disabled={pending}>Draft change</button>
      </form> : <p>No active products were found in this Square account.</p>}
    </Card> : null}
    {state.drafts.map((draft) => <DraftReview key={`${draft.id}:${draft.description}:${draft.status}`} draft={draft} pending={pending} connected={Boolean(state.connection)} run={run} />)}
    <p className="text-sm text-muted">Updates apply to Square’s product catalog. Square controls whether and when the words appear on your online store. Existing rich-text formatting is replaced with the plain text you approve.</p>
  </div>;
}

function DraftReview({ draft, pending, connected, run }: { draft: Draft; pending: boolean; connected: boolean; run: (job: () => Promise<{ ok: boolean; message?: string }>, success: string) => void }) {
  const [description, setDescription] = useState(draft.description);
  const changed = description !== draft.description;
  return <Card title={draft.name}>
    {draft.simulated ? <PracticeBanner what="This description is a practice sample. It cannot be sent to Square." /> : null}
    <h3 className="font-semibold">Description when drafted</h3><p className="whitespace-pre-wrap">{draft.original || "No description"}</p>
    {draft.status === "pending" ? <>
      <label htmlFor={`description-${draft.id}`}>Proposed description</label>
      <textarea id={`description-${draft.id}`} className={INPUT} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} />
      <div className="flex flex-wrap gap-3">
        <button className={SECONDARY} disabled={pending || !changed} onClick={() => run(() => editSquareAction({ id: draft.id, description, cancel: false }), "Changes saved. Review before approving.")}>Save edits for review</button>
        <button className={PRIMARY} disabled={pending || changed || draft.simulated || !connected} onClick={() => run(() => approveSquareAction({ id: draft.id, description: draft.description }), "Description updated and verified in Square.")}>Approve and update Square</button>
        <button className={SECONDARY} disabled={pending} onClick={() => run(() => editSquareAction({ id: draft.id, description: "", cancel: true }), "Draft cancelled.")}>Cancel draft</button>
      </div>
      {changed ? <p>Save your edits to review them before approving.</p> : null}
    </> : <><h3 className="font-semibold">{draft.status === "succeeded" ? "Updated description" : "Saved description"}</h3><p className="whitespace-pre-wrap">{draft.description}</p>
      <p>{draft.status === "succeeded" ? "Updated and verified in Square." : draft.status === "conflict" ? "This product changed in Square. Load products and create a new draft." : draft.status === "cancelled" ? "Cancelled; this draft was not sent." : "Approved. The result still needs confirmation; retry to complete or verify the saved update."}</p>
      {draft.status === "approved" ? <button disabled={pending || !connected} className={PRIMARY} onClick={() => run(() => approveSquareAction({ id: draft.id, description: draft.description }), "Description updated and verified in Square.")}>Retry approved update</button> : null}
    </>}
  </Card>;
}
