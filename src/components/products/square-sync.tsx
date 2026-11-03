"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { getSquareProductsAction, pushSquareProductAction } from "@/app/(app)/products/square/actions";
import { LocalDate } from "@/components/local-date";
import { ALERT, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";
import { dollars, priceLabel } from "@/lib/rules/products";
import { syncFingerprint, type ProductSyncStatus, type SyncProduct } from "@/lib/rules/square-products";

export function SquareLibraryControls({ connected }: { connected: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4" aria-label="Square product library">
    <h2 className="font-display text-[22px]">Square and your product library</h2>
    <p>Get products from Square to save them in your library. Local edits stay here until you choose to publish or push them.</p>
    <p className="text-sm text-muted">Sync includes names, descriptions, options and selling prices. Import also brings in Square photos. Photo edits, stock, costs and service details stay local. Publishing adds a catalog item; Square Online availability may still need setup in Square.</p>
    <div className="flex flex-wrap gap-3"><Link href="/products/square" className={TEXT_LINK}>{connected ? "Manage Square connection and description drafts" : "Connect Square"}</Link>
      <button className={SECONDARY} disabled={!connected || pending} onClick={() => start(async () => {
        try {
          const result = await getSquareProductsAction();
          setMessage(result.ok ? `${result.value.imported} imported; ${result.value.refreshed} refreshed.${result.value.skipped.length ? ` Kept or skipped: ${result.value.skipped.join(" ")}` : ""}` : result.message);
        } catch { setMessage("Import was interrupted. Reload the library to see which products were saved, then retry."); }
      })}>{pending ? "Getting products…" : "Get products from Square"}</button>
    </div>
    {message ? <p role="status" aria-label="Square import status" className={ALERT}>{message}</p> : null}
  </section>;
}

export function SquareProductSync({ product, sync, connected }: { product: SyncProduct & { id: string }; sync?: ProductSyncStatus; connected: boolean }) {
  const [pending, start] = useTransition();
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState("");
  const expected = syncFingerprint(product);
  const canPush = !sync?.linked || sync.dirty || sync.pending;
  const validAccount = !sync || sync.accountMatches;
  const label = sync?.pending ? "Retry approved push to Square" : sync?.linked ? "Push to Square" : "Publish to Square";
  const changedAt = sync?.pushedAt;
  const published = changedAt && changedAt === sync?.publishedAt;
  return <div className="flex flex-col gap-2 rounded-lg border border-line bg-soft p-3" aria-label={`Square sync for ${product.name}`}>
    <p className="text-sm font-semibold">{sync?.pending && !sync.linked ? "Square publication awaiting confirmation" : sync?.origin === "imported" ? "Pulled from Square" : sync?.linked ? "Published to Square" : "Only in your product library — not published to Square"}</p>
    {sync?.importedAt ? <p className="text-sm">Last pulled: <LocalDate iso={sync.importedAt} /></p> : null}
    {changedAt ? <p className="text-sm">{published ? "Published" : "Last pushed"}: <LocalDate iso={changedAt} /></p> : null}
    {sync?.linked && sync.dirty ? <p className="text-sm text-check">Local changes have not been pushed to Square.</p> : null}
    {!validAccount ? <p className="text-check">Linked to a different Square account. Reconnect that account to sync.</p> : null}
    {canPush ? <button className={SECONDARY} disabled={pending || !connected || !validAccount || product.status !== "confirmed" || product.descriptionBy === "practice"} onClick={() => setReview(true)}>{label}</button> : <p className="text-sm">Synced with Square.</p>}
    {review ? <div className="flex flex-col gap-2" role="group" aria-label={`Review Square push for ${product.name}`}>
      <p>Approve sending this product’s saved name, description and selling prices to {sync?.linked ? "its linked Square item" : "a new Square catalog item"}. Existing Square photos and stock are preserved. Creating a new option structure after linking requires setup in Square.</p>
      <p className="font-semibold">{product.name}</p>
      <p>{priceLabel({ ...product, priceText: "" }) || "No selling price set"}</p>
      {product.options.variants.length ? <ul>{product.options.variants.map((variant) => <li key={JSON.stringify(variant.values)}>{variant.values.join(" / ")}: {variant.priceCents !== null || product.priceCents !== null ? dollars(variant.priceCents ?? product.priceCents!) : "No price set"}</li>)}</ul> : null}
      <p className="whitespace-pre-wrap">{product.description || "No description"}</p>
      {sync?.pending ? <p>A previous approved push still needs confirmation. This retries those approved values; newer local edits may need a second push.</p> : null}
      <button className={PRIMARY} disabled={pending || !connected || !validAccount} onClick={() => start(async () => {
        try {
          const result = await pushSquareProductAction({ productId: product.id, expected });
          setMessage(result.ok ? "Product pushed and verified in Square." : result.message);
          if (result.ok) setReview(false);
        } catch { setMessage("The result is uncertain. Reload and retry the approved push to verify it safely."); }
      })}>{pending ? "Pushing…" : "Approve and push to Square"}</button>
      <button className={SECONDARY} disabled={pending} onClick={() => setReview(false)}>Keep changes local</button>
    </div> : null}
    {sync?.linked && connected && validAccount ? <button className={TEXT_LINK} disabled={pending} onClick={() => {
      if (!window.confirm(`Replace the synced fields of “${product.name}” with Square’s current version? Local name, description, option and selling-price edits will be discarded. A pending push may already have reached Square.`)) return;
      start(async () => {
        try {
          const result = await getSquareProductsAction({ productId: product.id, expected });
          setMessage(result.ok ? result.value.skipped.length ? result.value.skipped.join(" ") : "Latest Square version saved in your library." : result.message);
        } catch { setMessage("Could not refresh this product. Try again."); }
      });
    }}>Get latest from Square for this product</button> : null}
    {message ? <p role="status" aria-label={`Square sync status for ${product.name}`}>{message}</p> : null}
  </div>;
}
