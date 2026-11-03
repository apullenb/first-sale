# SnapStart Business Assembly Kit: project plan

*SnapStart Business Assembly Kit* (SnapStart) is an AI assistant for first-time business owners in the US. It helps them:

- research what their business legally needs
- choose a business structure
- work through a formation checklist
- run daily work they can't hire for yet, while staying in control

It's built for a daughter who wants to open a bakery, two brothers who make wooden housewares, and a friend who dreams of a clothing boutique.

## Principles

- **US only for now.** Requirements come from federal, state, county and city governments. The data model covers all 50 states and DC, but the demo goes deep on 2–3 places.
- **Works with any AI model.** The hackathon requires Meta's Muse, so Muse Spark is the default. No code outside `src/lib/ai` knows which model is running.
- **AI drafts; plain, tested code calculates; the owner approves.**
  - Money, stock, order status and task order are handled by plain code.
  - AI writes drafts and explanations.
  - Nothing is filed, published or sent without the owner.
- **Every requirement shows its source.** If no official source backs it, it's labeled "Needs verification."
- **Owners sign up and log in.** Each owner has one business and sees only their own.
- **No built-in sample businesses.** Demo businesses are created through the app, like any other, each with its own account.

## UI direction

Decided 2026-10-26: a **guided workspace**, direction A in the clickable prototype. The alternative was chat-first.

- **Layout.** A left menu holds Today, then two groups:
  - "Start your business": Your business, Requirements, Structure and path, Checklist.
  - "Run your business": Branding, Website, Product photos, Products and marketing, Orders. Product photos sits under Website, as the owner asked ("under website creation").

  On a phone, the menu becomes one scrollable row above the content. A bottom tab bar, like the prototype's phone screen, is still an option.
- **Getting started:** sign up, then answer the intake questions one at a time, inside the workspace. Returning owners log in to Today.
- **Today is the home page.** It shows setup progress, the next step, and everything waiting for the owner's OK.
- **AI works inside each screen,** drafting and explaining where the owner already is. There's no separate chat window.
- **Every step says who did it.**
  - Small labels mark each one as **AI** (drafts), **Code** (stock, money, steps) or **You** (approvals).
  - Drafts stay drafts until the owner approves them, and anything flagged must be decided first.
- **Every requirement carries a label.** It's either "Official source" (green) or "Needs verification" (amber), with who to call and what to ask.
- **Look.**
  - Colors: a light warm gray background, white cards and a deep green accent. Amber marks things to check, and blue marks AI drafts.
  - Fonts: Bricolage Grotesque for headings, Figtree for text.
  - Tap targets are at least 44 px, and it's light mode only for now.

## What changed from the first draft

- **Removed vendor-specific features:** server-side web search, a vendor citations API, and model-specific prompt caching.
  - The app now fetches official pages itself and checks citations in its own code.
  - Search uses Muse's own web search tool only to find addresses. The app still reads each page and checks it.
  - That works with any model, and the check is stricter, because the app knows exactly which pages it read.
- **Added a provider layer.** It supports Meta Muse, any OpenAI-compatible endpoint, and a mock model for tests and offline demos.
- **Structured output works with every model.**
  - It sends a JSON Schema where the model supports one, and puts the schema in the prompt where it doesn't.
  - Either way, code validates the reply and asks for one correction.
- **Image input is optional.** Product listings can be drafted from text fields alone.
- **US only.** The second-country stretch goal is dropped.

## AI layer

| Piece | What it does |
|---|---|
| `ModelProvider` (`src/lib/ai/types.ts`) | One interface: messages in, text out. Each model declares what it can do: images, JSON Schema, reasoning effort. |
| OpenAI-compatible adapter | Sends Chat Completions requests over `fetch`. For Muse, the base URL is `https://api.meta.ai/v1` and the model is `muse-spark-1.3`. |
| Mock provider | Needs no key or network. Used by tests and saved demo data. |
| `getModel()` | Picks the provider from the environment: `AI_PROVIDER=muse`, `openai-compatible` or `mock`. |
| `generateObject()` | Converts a zod schema to JSON Schema and validates the reply. Retries once with the validation error, and rejects replies cut off by the token limit. |
| `ImageModel` (`src/lib/ai/image-types.ts`) | Optional image editing and text-to-image (`generate`), separate from `ModelProvider`. `getImageModel()` returns Muse Image for `muse`, a labeled practice preview for `mock`, and null otherwise. |

**Guidelines for feature code**
- Call `getModel()` and `generateObject()`. Never import a vendor SDK.
- Effort is `high` for research and decisions, `low` for drafting. It maps to `reasoning_effort` where the model supports it.
- Owners' data never goes to Muse "contributor" models, which may train on prompts. The registry refuses them with any provider unless `AI_ALLOW_CONTRIBUTOR_MODELS=true`.
- Production never falls back to the mock model.
- Switching models is an environment change, and evals run on whichever model is configured.

**Notes on Muse,** from Meta's docs (dev.meta.ai) as of 2026-10-27:
- The app uses the developer Model API, not the consumer Meta AI app. The models are `muse-spark-1.1` to `1.3` and `muse-wonder-1.0`, and the app uses `muse-spark-1.3`.
- Chat Completions is OpenAI-compatible.
- The model always reasons, so `reasoning_effort: "none"` is rejected.
- `response_format` with `json_schema` is supported.
- Input:
  - Images go in user messages as `image_url` parts.
  - PDFs go as `file` parts, which Meta turns into text plus page images (50 pages of images, 100 of text, 50 MB inline).
- Web search ("search grounding") is a `web_search` tool on the Responses API only, not Chat Completions. Requests can return the raw results (`include: ["web_search_call.results"]`), and the app sends `store: false`.
- Standard-mode models don't train on content. `-contributor` models may.
- `muse-image-1.0` edits images through `/v1/images/edits`, taking a JSON `images` array of data URLs.
  - Size sets only the aspect ratio.
  - It costs $0.01 per returned image, and there's no idempotency key.
  - Its own image and web search are on by default; the app turns them off with `tool_enablement`.
- `/v1/images/generations` takes the same `tool_enablement`, `size` (shape only) and `output_format`. There's no `background` option, and the response's `background` is always `opaque`. Muse Image's limit is 150 requests a minute.
- Long requests that don't stream can time out with HTTP 504, so long calls stream.

## Research engine

1. **Source packs** (`src/data/source-packs/`). A hand-picked list of official pages, plus the domains the app may read.
   - The federal pack (IRS, SBA) is in: nine sources, several of them sections of one SBA page. Their content was read on 2026-10-26.
   - The Texas, Travis County and Austin packs are in: nine official pages and forms, read by the server on 2026-10-27. The Texas statutes site can't be read by the server, so agency pages stand in.
2. **Search** (`src/lib/research/discover.ts`). Muse web search finds state, county and city pages, one narrow question per topic.
   - Topics: name registration, LLC formation, sales tax, cottage food, employer registration, county license, county health, city license, home business, zoning.
   - A page counts only if it's on CISA's official .gov registry and the registry says it belongs to the owner's own state, county or city (`official-sites.ts`). The registry, not the model, decides each page's level.
   - Topics with nothing official found become open questions, never "no requirement."
3. **Retrieve.** The app fetches every page itself, HTML or PDF, and extracts the text, one section when a link has a `#` anchor.
4. **Extract.** The model reads the fetched pages and the business profile. It returns requirements that point to source ids, each with a word-for-word quote, a topic, the responsible agency, what to gather, what done looks like, and its prerequisites. It also returns its assumptions and open questions. Page text is evidence, never instructions.
   - Each requirement also gets the model's read of whether it applies (applies, conditional with what it depends on, optional, outside coverage), whether it's before the first sale or later, which structures it's for, and any renewal. The model also lists where sources disagree.
5. **Verify in code** (`verifyRequirements`). A requirement counts as sourced only if it cites pages the app actually fetched, from approved domains.
   - The quote must appear in a cited page's text, and any fee or deadline inside that quote. Otherwise fees and deadlines are dropped and the requirement is marked "Needs verification."
   - A state, county or city requirement needs a page from that government.
   - The app records the page's final URL after redirects, and refuses redirects to unapproved domains.
   - Fees written in words (as some state laws write them) count, but not as part of a larger amount. A renewal fee must sit in a sentence about renewing.
6. **Classify** (`src/lib/research/applicability.ts`). Code, not the model, gives each requirement its status: verified, conditional, optional, needs confirmation or outside coverage. It adds conditions of its own: city limits not confirmed, county not given, a structure not decided. "Unsure" is never "no". A coverage summary records what each research category found at each level of government (`coverage.ts`).
7. **Plan** (`src/lib/rules/plan.ts`). Code turns the checked requirements into ordered steps.
   - Prerequisites the model named are kept only if they point to a real step and don't create a loop.
   - Re-checks reuse step keys, so progress carries over.
   - Consequential changes wait for the owner's review.
   - Following the IRS page, code puts the EIN after forming an LLC or corporation, ahead of the model's order. Changing a decision re-plans from saved research (`replanForOwner`), and the changes wait for review.
8. **Snapshot.** Results are saved per business with the date checked, whether it was practice mode, the answers and structure decision they ran on (`profile`, `structure`), the coverage and the conflicts. So the page can say which answers changed since and what that affects (`changes.ts`).

## Paperwork companion

- **Documents** (`documents` table) hold uploads (PDF, PNG, JPEG or WebP, up to 4 MB, checked by their first bytes), pasted form text, official PDFs fetched from .gov links, and generated documents.
- **Reading:** code reads PDF text and fill-in fields (`pdf.ts`). The model transcribes photos and scans, and marks unclear parts instead of guessing.
- **Explaining:** every explanation quotes the form, and the quote is checked against the form's text. Researched guidance comes from the linked plan step and is labeled separately.
- **Drafting:** the model only matches blanks to confirmed facts (the business profile and `business_details`). Code fills in the values. Signatures, ID numbers and sworn statements are always left for the owner.
- **Owner review:** the owner confirms each answer. Typed answers can be saved to business details only when the owner ticks that.
- **Prepared copies:** only confirmed answers go into a filled copy (fillable PDFs) or an answer sheet. Both say "Not filed."
- **Business plan:** drafted from the owner's answers and plan. Numbers the owner didn't give are flagged, and missing facts become [bracketed] placeholders. The owner edits and approves it, which saves a PDF to the library.
- **Official forms** (`src/data/official-forms`, `src/lib/documents/official-forms.ts`, `autofill.ts`): a hand-checked catalog. The app downloads a form only from its agency's .gov site, checks its title and revision, keeps the original unchanged, and fills blanks in code from confirmed facts. Each answer records every fact it rests on. Online applications get the same review as an answer guide.
- **Library:** each document has a role, and versions share a family (`role`, `family_id`, `version`). Drafts record the facts they used (`facts_used`), so a changed fact flags them as outdated. Request keys make retries safe.
- **Filing status** is separate from research and document status: "submitted", then "done" once approved, recorded by the owner.
- **Workflow registry** (`src/lib/workflows.ts`): every long job, who does it (AI or code), its time limit, and which plan topics offer it. `workflow_runs` records each run, so a reload shows one still running or one that was cut off.

## Stages

| Stage | Route | What the owner gets |
|---|---|---|
| Understand the business | `/business` | A saved business profile |
| Research requirements | `/requirements` | Requirements with sources, plus gaps to verify |
| Explain formation options | `/structure` | Four separate decisions (structure, name registration, tax treatment, licenses), each structure explained with sourced lines |
| Support a decision | `/structure` | A suggested path with reasoning and tradeoffs, plus when to see a professional |
| Build the checklist | `/checklist` | The next step, what can happen at the same time, what waits, before-selling vs later vs optional, and costs with renewals |
| Guide completion | `/checklist` | Numbered filing steps with sources, official forms filled for review, submitted and approved recorded separately, receipts saved to the step |

**What's decided in code vs. by AI:**
- Code decides which structures are possible. That code is written only after checking official sources, never from a guess.
- AI explains the options for this owner.
- Code orders the checklist by prerequisites (`orderTasks`, `taskReadiness`).

## AI workflows

- **Branding (`/brand`)**
  - Autofilled brief → one-click feel words → brand picture (Muse Spark; the owner approves or rewrites it) → creative-director concepts (Muse Spark) → code-built drawing instructions (Muse Image) → blind lettering check (code decides) → owner picks → versions from the chosen logo → brand pictures → brand kit (`getMyBrand`).
- **Website (`/website`)**
  - Three vendor-checked options with code-worked costs and a code-based suggestion → "Explain more" from the card's facts → "Find more options" by web search, kept only where its own sources back it → registry check of a web address → drafted words from public facts only, numbers flagged → owner approves (PDF to Documents) → preview with the brand kit → setup checklist.
- **Product photos (`/photos`)**
  - The photo is checked first, edited from the original, compared with it by AI, then approved by the owner.
  - Approved photos form the product library. They aren't linked to `products` rows yet.
- **Product → marketing (`/products`)**
  - The owner enters the photo, materials, price and quantity.
  - AI drafts a listing and a social post from those facts only. Claims like "gluten-free" are flagged for the owner to confirm, never added.
  - Drafts are cross-checked against the owner's own requirements, such as a home-kitchen label requirement.
  - Nothing is exported until the owner approves it.
- **Customer operations (`/run`, `/email`, `/orders`)**
  - Adaptive product, made-to-order and service-job workspaces, with list, board and dated schedule views.
  - Manual work, uploaded invoices and customer emails enter the same tracker. Imported work needs owner confirmation before stock changes.
  - Nylas hosted authorization; the owner presses Import new emails to bring in and read new mail through `runWorkflow`. Setup in `docs/CUSTOMER-OPERATIONS.md`.
  - Invoice/email facts keep exact source excerpts. Unsupported facts are omitted; invoices never establish payment. Practice results are labeled and cannot change stock or send replies.
  - Payments and refunds use an append-only ledger; code calculates paid amounts and balances independently of fulfillment. Overdue work is flagged in the tracker.
  - Replies are conservative code-built drafts from checked extracted facts, editable by the owner, and require explicit approval before sending. Uncertain sends cannot retry automatically.
  - Catalog orders snapshot names and prices and update stock transactionally. Custom work has an owner-confirmed total; completed or shipped work cannot restore stock through cancellation.

## Architecture

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router) with TypeScript and Tailwind 4 |
| Data | Postgres through Drizzle, with migrations in `drizzle/`. Locally it uses PGlite (no install needed); in production, set `DATABASE_URL` to a hosted Postgres. |
| Accounts | Better Auth with email and password, stored in our own database. Decided 2026-10-26. |
| Validation | zod 4, which also produces the JSON Schemas sent to models |
| Tests | Vitest |
| Hosting | Vercel |
| Runtime | Node 24 |

```
src/
  app/
    (app)/              signed-in pages: one per stage and workflow
    (auth)/             sign up and log in
    api/auth/           Better Auth endpoints
  components/
    intake/             intake wizard, answer choices, place pickers
    structure/          structure comparison, suggested path, decision form
    plan/               startup plan review, step status, structure decision
    documents/          document library, paperwork companion, business plan
    photos/             product photo upload, looks, comparison, review
    brand/              brand brief, feel picks, logo ideas, versions, brand pictures, kit
    website/            platform cards, web address finder, words editor, preview, setup checklist
  data/
    source-packs/       official sources by place
    dotgov/             CISA's .gov registry snapshot (who owns each .gov site)
    places/             Census Bureau county and place lists
    official-forms/     hand-checked official forms, with quotes and dates
    website-platforms.ts  Square, Wix and Shopify facts, from their own pages
  db/                   schema (including account tables), client
  lib/
    ai/                 model-agnostic layer (the only place that talks to models)
    auth/               account config, session check, form validation
    intake/             intake catalog, questions, answers, change impact, AI suggestions and their offline stand-in
    structure/          sourced federal facts, structure options, code-based suggestion
    data/               owner-scoped data access
    research/           source packs, search, .gov ownership, page reading, the research run, citation checks
    documents/          upload checks, PDF reading and filling, companion, business plan, PDF writer
    photos/             photo checks, edit instructions, product-photo guidance
    brand/              brand brief, concepts, drawing instructions, lettering checks, sizes
    website/            recommendation logic, costs, web address checks, words drafting, option search
    rules/              stock, checklist order, startup plan, hiring math (plain code, unit-tested)
    details.ts          business details forms ask for, and the owner's decisions
    workflows.ts        registry of long jobs: who does them and their time limits
    domain.ts           shared schemas and enums
    sections.ts         navigation
  test/                 in-memory database for tests
drizzle/                migrations
```

## Build order

| # | Milestone | Priority | Status |
|---|---|---|---|
| 0 | Project setup, database schema, AI layer, tested calculations, federal sources, app layout | Must | Done |
| 1 | Accounts: sign up, log in, and each owner sees only their own business | Must | Built; password reset and email verification wait on an email service |
| 2 | Intake: the business profile questions, one at a time, as in the prototype | Must | Built: click-based branching intake with examples, "not sure" help, autosave and resume, a confirmed-vs-open summary, and change impact with history. AI can pre-fill answers from a description. One business per owner. |
| 3 | Research engine, requirements view, gaps, streaming calls, state source packs | Must | Built: federal, Texas, Travis County and Austin source packs, Muse web search for state, county and city pages filtered by the .gov registry, checked citations, applicability statuses decided in code, coverage by category, conflicts and written questions. Live Muse search is untested until there's an API key. |
| 4 | Structure and path, checklist | Must | Startup plan built: next action and parallel steps, costs with renewals, numbered filing steps, submitted and approved status, review for re-check and decision changes, a PDF copy. Structure comparison page built: sourced explanations, code-based suggested path, what-ifs, confirmed decisions with history. |
| 5 | Product → marketing | Must | Product photos built (Muse Image editing from the owner's own photo, with an AI comparison and the owner's approval). Branding built (logo ideas, versions, brand pictures, brand kit). Website built (three checked options, more by search, web address check, drafted words, setup checklist). Listings and posts not built. |
| 6 | Order → customer reply | Must | |
| 8 | Completion: uploads, help chat on each task | Should | Paperwork companion and official forms built: IRS SS-4 downloaded, checked and filled in code; Texas Forms 205, 503 and AP-201 and the Travis County certificate checked and filled for review; reviewed copies as versions; outdated-draft flags; a library grouped by step with receipts and approvals. |
| 9 | Your demo businesses polished end to end | Should | |
| 10 | One-page shop, turning a pasted DM into an order, Spanish | Stretch | |
| 11 | Evals, saved demo results, video, README | Must — save the last ~20% of your time | |

**Today** fills in as milestones land: setup progress and the next step from milestone 4, then drafts and orders from milestones 5 and 6.

**For a 48-hour event:** do one demo business only, run research from saved results, keep milestones 1–7 simple, and skip uploads.

## Credibility

- **Hand-checked requirement lists:** 10–15 for each demo business, built while making the source packs.
  - The eval runs the same list against whichever model is configured. Report two numbers: requirements found, and requirements invented.
  - Citation validity is 100%, because code checks every citation.
- **Draft checks:** marketing drafts are graded for claims the owner didn't provide.
- **Unit tests:** stock, checklist order and hiring math are already tested, along with accounts (password hashing, wrong passwords, duplicate emails) and owner-only data access.

## Three-minute demo

1. **0:00** – The story.
2. **0:20** – Sign up, then intake → requirements with sources and one flagged gap → structure options → checklist.
3. **1:30** – A 15-second look at a second demo business, logged in as its owner, to show the requirements and path change.
4. **1:50** – Photo → listing, with a flagged claim; the owner edits and approves.
5. **2:20** – A demo order arrives: stock goes down, a reply is drafted, and a missing detail is flagged.
6. **2:45** – Planning for help: 15 hrs/week at $18/hr is about $1,170 a month, or about $2,925 in sales at a 40% margin → role description → "someone's first job."

## Open decisions

1. Hackathon timeline and team size.
2. Which states and cities the demo supports. Decided: Austin, Travis County, Texas. Its state, county and city pages are read live; anything they don't cover stays "To confirm".
3. Repo visibility for submission. It's private for now.
4. Whether the hackathon requires every AI call, including eval graders, to use Muse.
5. Which email service sends password resets and verification emails, and whether a hackathon demo needs them.
6. ~~Which generated legal documents to offer beyond prepared forms.~~ Decided: an owners' agreement for LLCs (a company agreement in Texas) and partnerships, from fixed wording filled in code, plus Texas Form 401-A. Corporate bylaws aren't offered yet.
7. Whether to map Form AP-201's 231 blanks by hand. For now its answers are drafted by matching.
