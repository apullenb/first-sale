# Square product descriptions

The real integration is at `/products/square`, linked from Products and Website. It updates existing Square catalog items, with an explicit approval for each saved description. It does not edit Square website layouts, take payments, or publish SnapStart sites.

## Setup

1. Create a Square Developer application and a sandbox seller. Copy the sandbox application ID and application secret into the server's environment.
2. Set `SQUARE_ENVIRONMENT=sandbox` and register the exact `SQUARE_REDIRECT_URI` as the application's OAuth redirect URL. Local default: `http://localhost:3000/api/square/callback`. Use HTTPS on deployed environments.
3. Generate a dedicated key with `openssl rand -base64 32`, and set `SQUARE_TOKEN_ENCRYPTION_KEY`. Preserve it across deployments; changing it makes saved credentials unreadable. Keep all Square variables server-only.
4. Apply the generated migration with `npm run db:migrate` against the intended database. Migration generation alone does not apply it.
5. Configure the AI service through the existing `src/lib/ai` settings. Practice mode can draft, but simulated drafts cannot be sent to Square.
6. Add an item and variation to the sandbox seller's catalog. Give the item a name and description with enough facts for a rewrite.
7. Open Products → Connect Square. Grant `ITEMS_READ` and `ITEMS_WRITE`, then load products.
8. Choose the item, request a rewrite, and inspect the original and proposed description. Save any edits before approval. Select **Approve and update Square**.
9. Check the catalog in Square: description changed, variations, prices, images and other fields preserved. Test an external edit between draft and approval: SnapStart must refuse the stale update.
10. For production, configure production application credentials, `SQUARE_ENVIRONMENT=production` and an HTTPS callback. Connect again and create fresh drafts. Sandbox and production connections cannot be interchanged. Confirm Square's distribution requirements for the intended seller rollout.

## Behavior

- OAuth state expires after ten minutes and is bound to both the signed-in owner and an HttpOnly browser cookie. Tokens use authenticated encryption bound to the business.
- Disconnect removes local credentials even if Square is unavailable, and tells the owner to revoke access in Square if remote revocation could not be confirmed.
- Tokens nearing expiration refresh when used. All Square operations for one business serialize on its connection row. Reconnecting invalidates older drafts.
- Draft generation goes through the workflow runner, quotas, model wrapper, structured output validation and an offline fixture. No content is written to Square while drafting or editing.
- Rewrites use existing catalog facts only. A conservative vocabulary check blocks new content words; high-risk claims and rewrites of exclusions are blocked. This is a restricted rewrite tool, not a general factual verifier. The owner reviews meaning before approval. Add missing product facts directly in Square first.
- The exact saved text must match the approval request. Approval is durable before the external write, so an interrupted result can be retried. Approved drafts are immutable.
- Square upserts replace complete objects. SnapStart preserves the retrieved object, including variations, and changes `description_html` to escaped plain text. Existing rich-text formatting is intentionally replaced, as disclosed in the review screen.
- A stale Square object version blocks the update. Retries use the same draft ID and payload as the idempotency key. A matching remote result is read back before completion is recorded.
- The completion message confirms the catalog update. It does not claim a Square Online page has changed; verify that separately on a controlled live site.
- Demo sessions cannot authorize, draft, edit, update or disconnect. Practice AI drafts cannot be sent even after manual edits.
- No document text, owner requests, credentials or raw Square errors are logged by this integration.

## Verification

Run `npm run typecheck`, `npm run lint`, and `npx vitest run src/lib/data/square.test.ts src/lib/rules/square-description.test.ts src/lib/square/draft.test.ts`.

The database/API tests use a migrated, isolated in-memory database and a simulated Square transport. A real OAuth and Square Online propagation check still requires configured Square credentials and a controlled seller account.

## Product library synchronization

- The Products page separates items pulled from Square, items published from SnapStart, local-only items, and publications awaiting confirmation.
- **Get products from Square** saves supported active Square catalog items in the library and records the pull date. Repeating it refreshes clean linked items without duplicating them. Local edits and uncertain pushes are preserved and listed in the import report.
- **Publish to Square** creates a catalog item after an explicit review. The owner reviews the name, description and prices. Successful publication is verified and dated. Square Online channel availability is not guaranteed by catalog creation.
- Changing synced fields brings back **Push to Square**. Successful pushes show **Last pushed**; the first successful publication shows **Published**. The original publication date remains stored after subsequent pushes.
- The product ID, Square merchant/environment and remote catalog ID establish identity; names are never used to join products. Connecting another merchant cannot silently publish a linked product into that account.
- Sync includes names, descriptions and fixed USD selling prices. New products can include existing library options; after linking, option structure changes must be made in Square and pulled back. Existing Square images, tax settings and variations are preserved. Local costs, stock, photos and service details are not uploaded; pull operations preserve those local fields.
- Imports with names/descriptions beyond current library limits, unsupported prices/currencies or unsupported options are explicitly skipped. No data is silently truncated.
- Bulk pulls never discard local edits. **Get latest from Square for this product** requires confirmation to replace the synced local fields and resolve a conflict.
- Interrupted pushes keep their approved payload and idempotency key. Retry completes that payload, even if local edits were saved later; the newer edits remain marked for a subsequent push.
- Removing an item from the library does not delete it from Square. A later pull can import it again.
- Approved description updates also refresh a linked library product when it has no competing local edits, and update its remote baseline.

Additional tests: `npx vitest run src/lib/data/square-products.test.ts` and `npx playwright test e2e/square.spec.ts`.

## Local sandbox token test

For a developer test without an OAuth application secret, set `SQUARE_ENVIRONMENT=sandbox` and a server-only `SQUARE_SANDBOX_ACCESS_TOKEN` in `.env.local`. Keep the encryption key configured. This option is enabled only with `NODE_ENV=development`; production refuses both creating and using these connections.

Record the owner's Square website, then open `/products/square` and choose **Connect Square sandbox test account**. The app identifies the merchant using the actual Square API and stores the token encrypted for that owner. The screen explicitly labels this as a token test, which does not verify OAuth sign-in. The normal production OAuth flow still requires the application secret.

The optional `e2e/square-sandbox-recording.spec.ts` runs only when `SQUARE_SANDBOX_RECORDING=1`, against an already running app at localhost:3000 with an isolated recording database. It creates its test business through the app, connects to the real configured sandbox and records importing the two named DEMO candles. No Square requests are mocked in that recording.

Square product import also downloads the first catalog image into the owner's photo library when the product has no selected photo. Existing photo selections are preserved. Downloads accept only Square image-storage hosts, refuse redirects, time out, and enforce byte and image-dimension limits. A failed image import keeps the product and reports the missing photo so the owner can retry.
