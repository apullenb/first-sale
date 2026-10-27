# First Sale

Step-by-step help for first-time US business owners: research what applies to them, choose a structure, work through formation, then run daily work with AI help while staying in control.

See [PLAN.md](PLAN.md) for the full plan.

## Quick start

Requires Node 24 (`nvm use`).

```bash
npm install
cp .env.example .env.local
# Put a secret in BETTER_AUTH_SECRET: openssl rand -base64 32
npm run db:migrate
npm run dev
```

Open http://localhost:3000, create an account and answer the intake questions. There are no built-in sample businesses: create each demo business through the intake like any other, one per account.

Without an AI key the app runs in **practice mode**: built-in rules stand in for the model, nothing is searched, and photos and scans can't be read. Every result made this way carries a "Practice mode" label, so it's never mistaken for real research.

AI requests (intake suggestions, research, reading and explaining forms, drafting answers and business plans) are limited to 10 an hour and 50 a day per owner, and 500 a day across everyone (`AI_DAILY_LIMIT`), to cap cost.

The local database is PGlite in `.pglite/`, and only one process can use it at a time. Stop `npm run dev` before running `db:migrate`. If `db:migrate` fails with "already exists", or with "is duplicated" (an account made more than one business before the one-per-owner rule), your local `.pglite/` predates the current migrations: delete it and run `db:migrate` again.

Sign-in only accepts requests from `BETTER_AUTH_URL`, so run the app on that address (port 3000 by default).

## Accounts

Owners sign up and log in with an email and password, handled by [Better Auth](https://www.better-auth.com) in our own database:
- Passwords are hashed with scrypt.
- Sessions live in the `sessions` table, behind an httpOnly cookie.
- Signed-out visitors are sent to `/login`.

Each owner has one business and sees only their own. Pages read data through `src/lib/data/my-business.ts`, which takes the owner from the verified session.

Sign-up and log-in attempts are rate-limited in production, with counts kept in the database.

Not built yet: password reset and email verification. Both need an email-sending service.

## Deploying (Vercel)

1. Create a hosted Postgres database and set `DATABASE_URL`. The app refuses to start on Vercel without it.
2. Set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `BETTER_AUTH_URL` (the production address).
3. Run `DATABASE_URL=… npm run db:migrate` against the production database before the first deploy and after each schema change.
4. Each preview's deployment URL and branch URL are trusted for sign-in automatically (`VERCEL_URL`, `VERCEL_BRANCH_URL`). List custom preview domains in `BETTER_AUTH_TRUSTED_ORIGINS`, comma-separated.

Research and form reading can take a few minutes, so those pages allow up to 300 seconds (`maxDuration`). Check that your Vercel plan allows that. Uploads are capped at 4 MB to fit Vercel's request size limit.

Rate limiting keys on the visitor's IP from `X-Real-IP`, which Vercel sets. On a host that doesn't overwrite that header, visitors can fake it, so configure trusted proxies there. The limit is 3 sign-in or sign-up tries per 10 seconds per IP, so a room of people on one Wi-Fi network may need to pause between sign-ups.

## Requirements research

"Find my requirements" on the Requirements page:
1. Reads the federal pages listed in `src/data/source-packs/`.
2. Searches for the owner's state, county and city pages with Muse web search, one narrow question per topic.
   - Only pages on domains in CISA's official .gov registry count, and only when the registry says the site belongs to the owner's own state, county or city. Code decides this, not the model.
   - The registry snapshot is `src/data/dotgov/domains.json`. Refresh it with `node scripts/update-dotgov.mjs`.
   - Some real government sites aren't on .gov (Florida's business registry, for one). Their rules show as "Needs verification" until they're confirmed by phone.
3. Fetches every page itself (HTML or PDF), following redirects only within the same site.
4. Asks the model which requirements apply. The pages are evidence: instructions inside them are ignored.
5. Checks every requirement in code:
   - Its quote must appear word for word on a page it cites.
   - Fees and deadlines must appear inside that quote, or they're dropped.
   - State and local requirements need a page from that government.

Anything that fails is shown as "Needs verification," with who to call and what to ask. Topics the search found nothing for become open questions, never "no requirement." Results are saved, and "Re-check sources" runs it again. Reading the pages needs an internet connection, even in practice mode.

## Startup plan

Each research run turns the checked requirements into ordered steps (`src/lib/rules/plan.ts`). Business structure, name registration, tax registrations and permits are always separate steps. Each step has:
- what to do and why it may apply
- who handles it, with official links
- fees only when the page confirmed them, with the date checked
- what to gather, what's uncertain, what "done" looks like, and what comes next

The first plan applies straight away. After that, a re-check that changes anything that matters (a step added or removed, a fee, a link, a prerequisite) waits for the owner to review it on the plan page, and steps they've finished stay finished.

## Documents and the paperwork companion

Owners can upload a PDF or photo (up to 4 MB), paste a form's text, or have the app fetch an official PDF from a .gov link. Code reads PDF text and fill-in boxes. The model reads photos and scans, and flags anything it couldn't read clearly instead of guessing. Then the companion can:
- explain the form, with each point tied to the form's own words (checked in code), kept apart from researched guidance from the plan
- answer questions about a field or term
- draft answers from details the owner has confirmed. The model only matches blanks to facts; the values come from saved details. Signatures, ID numbers and sworn statements are always left for the owner.
- make a filled copy (fillable PDFs) or an answer sheet, with only answers the owner confirmed. The answer sheet says "Not filed" on the page. The filled copy says so in the PDF's details instead, so a printed copy can still be filed. First Sale never submits anything.

It also drafts a business plan from the owner's answers. Numbers the owner didn't give are flagged, and missing facts become [bracketed] placeholders.

**Storage and privacy, as built:**
- Files are stored in the app's Postgres database, readable only through the owner's session, and kept until the owner deletes them.
- Deleting removes the file, its text, explanations and drafts. Database backups kept by the hosting provider may hold copies until they expire.
- Sent to the configured AI service when a document is read or the owner asks for help: the document's text and images, and the owner's details when drafting answers.
  - With Muse, the app uses Standard-mode models, which Meta's docs say aren't used for training. Meta's docs don't state how long requests are kept, so the app makes no promise about that.
  - The Documents page states what applies to whichever service is configured (`dataHandling` in `src/lib/ai/registry.ts`).
- Search requests set `store: false`.
- Logs record only which job failed, never document text or answers.
- No Social Security or tax id numbers are stored: inputs that look like one are refused.

## Product photos

On the Product photos page, owners upload an ordinary phone photo of something they sell, choose a look and a shape, and get a polished store photo. They never write instructions for the AI.

1. **Upload.** The browser turns the photo upright, shrinks it to under 4 MB, and strips hidden details such as location. The server checks the file's own bytes (JPEG, PNG or WebP) and its size.
2. **Check.** Muse Spark looks at the photo first.
   - It names specific problems that stop an accurate edit (blur, something in the way, too small, cut off), with retake tips. Code also refuses photos under 300 pixels on the short side. An unusable photo can't be edited.
   - When there are several things in the photo, the owner ticks what they're selling. The rest is removed so it doesn't look included.
   - It asks one short question only when it can't tell something essential.
3. **Edit.**
   - Code builds the instruction from the look, the shape, the kind of product (clothing, handmade, food or other, each with its own rules) and the details to keep.
   - It sends that to Muse Image's `/v1/images/edits` with the owner's original photo as the product reference.
   - Muse Image's own web and image search are turned off, so it can't swap in a similar product found online.
4. **Refine.** The owner asks for changes in plain words ("Make the background ivory"). Every refinement sends the original again as image 1, plus the draft being changed as image 2.
5. **Review.** Muse Spark compares each result with the original and flags changes to lettering, color, quantity or shape. The owner sees the two side by side or with a slider. They must confirm the photo is accurate before approving it into their product library. There they can download the file exactly as it came back.

**Stored:** the original upload is never changed. Each result is a separate version, saved byte for byte as returned, with its pixel size read from the file. A failed edit saves nothing.

**Cost and retries:** Muse Image costs $0.01 per returned image, and its API has no idempotency key. So the app guards against paying twice itself:
- the button is disabled while an edit runs;
- one edit runs per photo at a time (`runWorkflow`);
- each request carries a key from the browser, so a retry after a lost connection returns the version already saved;
- edits are never retried automatically.

Limits: 30 photos, 20 versions per photo, and 200 MB per business.

**Configuration:**
- `AI_PROVIDER=muse` with `MUSE_API_KEY` turns photo editing on. `MUSE_IMAGE_MODEL` defaults to `muse-image-1.0`.
- Other providers have no photo editing, because the JSON edit request is Meta's own.
- In practice mode, each "result" is the original photo, unchanged, labeled "Development preview, not made by Muse" everywhere it appears, including the download's file name.

The app doesn't claim a resolution, a transparent background, or marketplace compliance. It shows the pixel size it actually got back.

## AI models

The app works with any OpenAI-compatible model. Set `AI_PROVIDER` in `.env.local`:

| Value | Uses |
|---|---|
| `muse` | Meta Muse through the Meta Model API. Needs `MUSE_API_KEY`; the model defaults to `muse-spark-1.3`. |
| `openai-compatible` | Any other endpoint. Needs `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL`. Turn on what it supports with `AI_VISION`, `AI_PDF` and `AI_WEB_SEARCH`. |
| `mock` | Practice mode. No network calls. The default outside production, used by tests. |

**About Muse.** The app uses the developer Model API (`https://api.meta.ai/v1`), not the consumer Meta AI app. Checked against Meta's docs (dev.meta.ai) on 2026-10-27:
- `muse-spark-1.3` handles Chat Completions with JSON Schema output, plus image and PDF input. PDFs are sent as `file` parts, and Meta converts them to text and page images.
- Web search ("search grounding") is only on the Responses API, so research searches through `/v1/responses` with the `web_search` tool.
- Long calls stream to avoid timeouts. Each request carries a hashed owner id as `safety_identifier`.
- `-contributor` models may train on prompts and are refused unless `AI_ALLOW_CONTRIBUTOR_MODELS=true`.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Starts the dev server |
| `npm test` | Runs unit tests (each database test gets its own in-memory Postgres) |
| `npm run typecheck` | Runs TypeScript checks |
| `npm run lint` | Runs ESLint |
| `npm run db:generate` | Writes a new migration in `drizzle/` after a schema change |
| `npm run db:migrate` | Applies migrations (local PGlite, or `DATABASE_URL`) |
| `node scripts/update-dotgov.mjs` | Refreshes the official .gov registry snapshot used to decide which sites are official |
