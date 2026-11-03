# Customer email, orders and jobs

## Owner workflow

`/run` links to `/email` and `/orders`. The tracker chooses product, made-to-order or service defaults from saved business facts. Each record can use a different work type. List, board and dated schedule views share the same records. Due-date priority uses the viewer's local date; entered job times are local to the business and do not create calendar appointments.

Manual custom work needs a description and customer, with an optional agreed total. Catalog lines use saved prices and exact options; confirmation takes stock transactionally. Custom work does not affect stock. Unknown totals remain unknown and must be set before recording payments. Owners can change a custom total, but not below net payments already recorded. Payments and refunds record money already exchanged; they never charge a card. Refunds reduce net paid amounts; adjust the agreed total if the remaining invoice amount has changed.

Invoice uploads accept PDF, PNG, JPEG and WebP up to 4 MB. Originals are kept in Documents. Pasted email is also supported. Extracted values require exact source excerpts; explicit US dates and times are parsed in code, and ambiguous dates remain blank. Invoices and payment claims never create payment ledger entries. Product names match the catalog only when unambiguous; option selections need review. Confirming an imported record is idempotent and takes stock once. Practice imports stay labeled DEMO and cannot be confirmed or sent.

Messages from the same connected thread attach to existing work without changing its accepted details. Matching invoice references link only when the customer email also matches. The same provider event or uploaded file is deduplicated. Owners can review updates, reschedule work and change its progress separately from payment status. Shipped or completed work cannot be cancelled to restore inventory. Payment records remain after cancellation; refunds are explicit.

## Live email setup

1. Create a Nylas application, configure its Google/Microsoft or other supported connector, and complete the provider's production authorization requirements. Use only the mailbox read/send permissions needed by this app.
2. Set `NYLAS_API_KEY`, `NYLAS_CLIENT_ID`, `NYLAS_REGION` (`us` or `eu`), and `NYLAS_REDIRECT_URI`. Register the exact callback, for example `https://your-app.example/api/email/callback`. Keep the API key server-side.
3. Register `https://your-app.example/api/email/webhook` for `message.created`, `grant.expired` and `grant.deleted`. Save its signing secret as `NYLAS_WEBHOOK_SECRET`. Disable compressed webhook payloads; this endpoint verifies the raw uncompressed body. Truncated message notifications are supported by fetching the complete message.
4. Generate a random `CRON_SECRET` of at least 32 characters. The owner's Sync now button brings in and reads their new mail on demand, and each signed webhook reads waiting mail right after it's accepted, so nothing has to check often. `vercel.json` also runs `GET /api/email/work` and `GET /api/email/sync` once a day as a safety net, since Vercel's Hobby plan only allows daily jobs; the scheduler must send `Authorization: Bearer <CRON_SECRET>`. On a paid plan, or with an external scheduler sending the same header, run them more often. No secret is placed in a URL.
5. Run `npm run db:migrate` on the deployment database before serving these routes. The migration backfills existing catalog totals and item-name snapshots.
6. In the app, the owner selects **Connect business email** and authorizes the business mailbox. The callback is bound to that signed-in owner and a short-lived HttpOnly state cookie. Disconnect revokes the grant; reconnecting another inbox detaches old messages.

Missing configuration leaves manual entry, uploads and pasted text available. No account, webhook, DNS record or deployment is provisioned automatically by the repository change.

## Background processing and sending

Webhooks authenticate their HMAC before looking up a stored connection. They enqueue provider message IDs, acknowledge promptly and never invoke AI inline. A separate scheduled sync scans for missed mail with a persisted pagination cursor, so reading a slow invoice does not delay mailbox catch-up. Catch-up starts at connection time, with a short overlap; it does not import historical mail before connection. Intake currently processes direct incoming mail addressed to the connected account, excluding that account's own sent mail. Aliases and BCC-only delivery require additional recipient handling.

The database queue leases work, retries failures with backoff and stops after five processing attempts. AI quotas apply to background intake as well as interactive runs. Paused connections stop processing connected mail. Failed items expose a retry control. The UI refreshes visible operations every 15 seconds while connected or waiting on intake.

PDF/image attachments are downloaded only from the fixed provider API, validated by file signatures, bounded to 4 MB, and saved unchanged. Up to three readable attachments per message are read concurrently; extra or oversized attachments require review in the original inbox. Encrypted, unreadable or unsupported files need manual entry or a clearer upload. PDF/image reading depends on the configured model's capabilities.

Reply drafts are intentionally conservative templates built in code from checked extracted facts. The owner edits and approves the exact text and recipient. Newer messages in the stored thread block older replies. An atomic send reservation prevents double clicks; network or persistence uncertainty blocks resending and asks the owner to check Sent mail. A scheduled sweep settles abandoned send reservations as uncertain. Pasted messages and practice output cannot send mail.

Follow-up reminders are in-app flags, configurable to 1, 2, 3 or 7 days for a connected inbox. No automatic customer follow-up, reminder email, payment synchronization or calendar booking is performed.

## Validation

Tests cover source evidence, offline fixtures, business templates, allowed progress transitions, balances, deposits, refunds, owner isolation, duplicate intake, approval and stock changes. Browser tests exercise catalog stock, service-job payments, pasted email and PDF invoice upload. Live provider authorization, webhook delivery and mailbox sending need a separately configured test mailbox before enabling the deployment for owners.
