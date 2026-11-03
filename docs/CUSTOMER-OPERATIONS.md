# Customer email, orders and jobs

## Owner workflow

`/run` links to `/orders` and, until inbound email opens to owners, to a sample-data demo at `/email/demo` (client-side only, saves nothing). The real page stays at `/email`.

1. **Get your SnapStart address.** On `/email`, the owner taps **Get my SnapStart address** once. Each business gets its own private address, `local+token@inbound.postmarkapp.com`, where `token` is 26 random characters (130 bits) stored in `email_inboxes`. The page shows it in a big box with **Copy address**. **Get a new address** replaces the token; the old address stops working at once.
2. **Send emails to it.** The setup card has three tabs:
   - **Forward one email** (the default; works on a phone): numbered steps for the Gmail app, iPhone Mail and the Outlook app.
   - **Forward automatically**: every click for Gmail (on a computer), Outlook.com, Yahoo Mail, iCloud Mail and other email, with a recommended filter that forwards only emails with words like order, quote or booking. The steps and their sources (with dates checked) are in `src/data/email-forwarding.ts`.
   - **Test it**: send any email to the address. The page checks on its own and says **It works! We got your email from …** when the first one arrives.
   When Gmail, Yahoo or another service emails the address to confirm forwarding, the code and/or link shows at the top of `/email` instead of becoming a customer message. Only links on the service's own domain are shown, and only when the sender passed its SPF check (if reported). SnapStart never opens these links.
3. **Read new emails.** The page counts emails waiting. **Read new emails** runs one `runWorkflow` job (`email_import`): it applies the AI limit, refuses a second copy while one runs, and reads up to 10 waiting emails, one AI request each; the rest wait for the next press. A message that can't be read shows **Retry reading**.
4. **Turn emails into orders or requests.** Reading an email drafts its details with exact source excerpts. Orders and jobs are added to the tracker as **Needs review**; questions stay in the inbox. Emails from the same customer with the same subject (ignoring Re:/Fwd:) attach to the same work. The owner checks and confirms; code in `src/lib/rules` calculates prices, totals, stock and status.
5. **Reply from your own email.** Each read email gets a reply draft built in code from the checked details. The owner edits it, then **Reply in your email** opens a `mailto:` reply to the customer with "Re: …" and the text. A reply too long for a link shows **Copy reply** and **Open email** instead. The owner taps **I sent it** to mark it "Sent from your email". SnapStart sends nothing.

Only emails sent or forwarded to the address reach SnapStart; it can't see the rest of the owner's inbox.

The tracker also takes manual entry, pasted emails and invoice uploads (PDF, PNG, JPEG or WebP up to 4 MB, kept unchanged in Documents).

Practice mode labels every drafted result and its reply. Practice results can't confirm an order.

## How an email is received

`POST /api/email/inbound` (`src/app/api/email/inbound/route.ts`, logic in `src/lib/email/inbound.ts`):

1. Checks HTTP Basic auth against `INBOUND_WEBHOOK_USER` / `INBOUND_WEBHOOK_PASSWORD` in constant time, before reading the body. Unset credentials refuse every request.
2. Caps the body at 12 MB and validates the Postmark JSON.
3. Finds the business by `MailboxHash` (or the `+token` in the recipient). Unknown tokens get the same `200` as stored mail and are dropped.
4. Detects forwarding confirmations (`src/lib/email/confirmation.ts`) and saves them on the business's inbox row.
5. Otherwise stores the email once per Postmark `MessageID`, at most 60 an hour per business. For an email forwarded by hand, the customer, subject, date and text come from the forwarded part (Gmail, Outlook, Apple Mail and Yahoo formats, `src/lib/email/forwarded.ts`), and the forwarder is kept separately. With no forward block (automatic forwarding), the sender is the customer.
6. Saves up to 3 PDF or image attachments (4 MB each, checked by file signature) unchanged in Documents. They're read with the email later.

No AI runs in the webhook. Email text is treated as evidence and kept inside tags in the prompt.

## Orders and jobs

The tracker chooses product, made-to-order or service defaults from saved business facts; each record can use a different work type. List, board and dated schedule views share the same records. Due-date priority uses the viewer's local date; job times are local to the business.

Catalog lines use saved prices and exact options; confirmation takes stock in one transaction, once. Custom work needs a description and customer, with an optional agreed total that can't drop below payments already recorded. Payments and refunds record money already exchanged; invoices and payment claims in an email are read as information only. Shipped or completed work keeps its stock when cancelled; refunds are recorded separately.

## Setup (Postmark inbound)

1. Sign in to Postmark and choose **Servers** → **Create server**. Name it (for example "SnapStart inbound") and create it.
2. Open the server and choose the **Default Inbound Stream**, then its **Settings** tab.
3. Copy the **Inbound email address** shown there, like `abc123…@inbound.postmarkapp.com`. Set it as `POSTMARK_INBOUND_ADDRESS`.
4. Make two long random values, for example with `openssl rand -hex 24`, and set them as `INBOUND_WEBHOOK_USER` and `INBOUND_WEBHOOK_PASSWORD`.
5. In the same Settings tab, set the **Webhook URL** to `https://USER:PASSWORD@snapstartkit.vercel.app/api/email/inbound`, with the two values from step 4.
6. Leave **Include raw email content in JSON payload** off.
7. Save. Postmark's check button sends a sample email; it gets a `200` and is dropped, since its address has no token.
8. Run `npm run db:migrate` on the deployment database and redeploy with the three settings.

Without `POSTMARK_INBOUND_ADDRESS`, `/email` says the forwarding address isn't set up on this site yet, and manual entry, pasted emails and invoice uploads work as usual.

Postmark retries a webhook that doesn't answer `200`, so a passing database error isn't lost. The host caps a request at about 4.5 MB, so larger emails (usually big attachments) don't arrive; the owner can paste the email or upload the file instead.

## Tests

Unit tests cover the webhook password check, token lookup and new addresses, unknown addresses, storing an email once, the hourly limit, attachments, forward parsing for Gmail, Outlook, Apple Mail and Yahoo, confirmation detection, reply links, reading waiting emails into review orders, marking a reply sent, owner isolation, balances, refunds and stock. Browser tests post a sample Postmark email to the local webhook, read it into an order and open the reply, plus pasted email, invoice upload, catalog stock and service-job payments.
