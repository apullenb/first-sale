# Customer email, orders and jobs

## Owner workflow

`/run` links to `/email` and `/orders`.

1. **Connect your inbox.** On `/email`, the owner selects **Connect business email** and authorizes their business mailbox through Nylas hosted authorization. The callback (`/api/email/callback`) is bound to the signed-in owner and a short-lived HttpOnly state cookie. **Disconnect** revokes the grant; connecting a different inbox detaches messages from the old one.
2. **Import new emails.** The owner presses **Import new emails**. The first import brings in the newest 25 messages from the past 7 days; each later import brings in up to 50 messages received since the last one, with a 5-minute overlap. Messages are keyed by the provider's message id, so each is imported once. The owner's own mail is skipped. The import runs as one `runWorkflow` job (`email_import`): it applies the AI limit, refuses a second copy while one runs, and a reload or another tab follows the running job. Each press reads up to 10 waiting emails with AI, one AI request each; the rest wait for the next press. A message that can't be read shows **Retry reading**.
3. **Turn emails into orders or requests.** Reading an email drafts its details with exact source excerpts. Orders and jobs are added to the tracker as **Needs review**; questions stay in the inbox. Messages in the same thread attach to the same work. The owner checks and confirms; code in `src/lib/rules` calculates prices, totals, stock and status.
4. **Reply.** Each read email gets a reply draft built in code from the checked details. The owner edits it, ticks the approval box and sends it from their own inbox. An atomic reservation sends each reply once; a newer message in the thread blocks an older reply; if sending can't be confirmed, the owner checks Sent mail before replying again.

The tracker also takes manual entry, pasted emails and invoice uploads (PDF, PNG, JPEG or WebP up to 4 MB, kept unchanged in Documents). Pasted messages have no inbox to reply from, so their drafts are for copying.

Practice mode labels every drafted result. Practice results can't confirm an order or send a reply.

## Orders and jobs

The tracker chooses product, made-to-order or service defaults from saved business facts; each record can use a different work type. List, board and dated schedule views share the same records. Due-date priority uses the viewer's local date; job times are local to the business.

Catalog lines use saved prices and exact options; confirmation takes stock in one transaction, once. Custom work needs a description and customer, with an optional agreed total that can't drop below payments already recorded. Payments and refunds record money already exchanged; invoices and payment claims in an email are read as information only. Shipped or completed work keeps its stock when cancelled; refunds are recorded separately.

## Setup

1. Create a Nylas application and configure its Google, Microsoft or other connector, including the provider's production authorization requirements. Use only the mailbox read and send permissions this app needs.
2. Set `NYLAS_API_KEY`, `NYLAS_CLIENT_ID`, `NYLAS_REGION` (`us` or `eu`) and `NYLAS_REDIRECT_URI`, and register that exact callback in Nylas, for example `https://your-app.example/api/email/callback`. Keep the API key server-side.
3. Run `npm run db:migrate` on the deployment database.

Without these settings, `/email` says connecting isn't set up on this site yet, and manual entry, pasted emails and invoice uploads work as usual.

Attachments (PDF and images, up to 3 per email, 4 MB each) are downloaded from the provider's API, checked by file signature and saved unchanged in Documents before they're read.

## Tests

Unit tests cover the import window, duplicate imports, skipping the owner's own mail, reconnecting, creating review orders, sending an approved reply once, owner isolation, balances, refunds and stock. Browser tests cover pasted email, invoice upload, catalog stock and service-job payments. A live mailbox needs its own Nylas test application.
