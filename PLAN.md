# First Sale: project plan

*First Sale* is a working name. The app is an AI assistant for first-time business owners in the US. It helps them:

- research what their business legally needs
- choose a business structure
- work through a formation checklist
- run daily work they can't hire for yet, while staying in control

It's built for a daughter who wants to open a bakery, two brothers who make wooden housewares, and a friend who dreams of a clothing boutique.

## Ground rules

- **US only for now.** Requirements come from federal, state, county and city governments. The data model covers all 50 states and DC, but the demo goes deep on 2–3 places.
- **Works with any AI model.** The hackathon requires Meta's Muse, so Muse Spark is the default. No code outside `src/lib/ai` knows which model is running.
- **AI drafts, rules calculate, the owner approves.**
  - Money, stock, order status and task order are handled by plain code.
  - AI writes drafts and explanations.
  - Nothing is filed, published or sent without the owner.
- **Every requirement shows its source.** If no official source backs it, it's labeled "Needs verification."
- **Owners sign up and log in.** Each owner sees only their own businesses.
- **No built-in sample businesses.** Demo businesses are created through the app, like any other.

## UI direction

Decided 2026-10-26: a **guided workspace**, direction A in the [prototype](https://claude.ai/artifact/Ps9Q3mDxgBJaDw1f77CTjD). The alternative was chat-first. The prototype is private; share it from its Share menu before sending the link to teammates.

- **Layout.** A left menu holds Today, then two groups:
  - "Start your business": Your business, Requirements, Structure and path, Checklist.
  - "Run your business": Products and marketing, Orders, Planning for help.

  On a phone, the menu becomes one scrollable row above the content. A bottom tab bar, like the prototype's phone screen, is still an option.
- **Before the workspace:** sign up or log in, then the intake questions one at a time. The prototype shows this flow.
- **Today is the home page.** It shows setup progress, the next step, and everything waiting for the owner's OK.
- **AI works inside each screen,** drafting and explaining where the owner already is. There's no separate chat window.
- **Every step says who did it.**
  - Small labels mark each one as **AI** (drafts), **Rules** (stock, money, steps) or **You** (approvals).
  - Drafts stay drafts until the owner approves them, and anything flagged must be decided first.
- **Every requirement carries a label.** It's either "Official source" (green) or "Needs verification" (amber), with who to call and what to ask.
- **Look.**
  - Colors: a light warm gray background, white cards and a deep green accent. Amber marks things to check, and blue marks AI drafts.
  - Fonts: Bricolage Grotesque for headings, Figtree for text.
  - Tap targets are at least 44 px, and it's light mode only for now.

## What changed from the first draft

- **Removed Claude-specific features:** server-side web search, the citations API, and model-specific prompt caching.
  - The app now fetches official pages itself and checks citations in its own code.
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

**Rules for feature code**
- Call `getModel()` and `generateObject()`. Never import a vendor SDK.
- Effort is `high` for research and decisions, `low` for drafting. It maps to `reasoning_effort` where the model supports it.
- Owners' data never goes to Muse "contributor" models, which may train on prompts. The registry refuses them with any provider unless `AI_ALLOW_CONTRIBUTOR_MODELS=true`.
- Production never falls back to the mock model.
- Switching models is an environment change, and evals run on whichever model is configured.

**Notes on Muse,** from Meta's docs as of 2026-10-26:
- Chat Completions is OpenAI-compatible.
- The model always reasons, so `reasoning_effort: "none"` is rejected.
- `response_format` with `json_schema` is supported.
- Images go in user messages as `image_url` parts.
- Long requests that don't stream can time out with HTTP 504, so stream the research calls (milestone 3).
- The API is a public preview for US developers.

## Research engine

1. **Source packs** (`src/data/source-packs/`). A hand-picked list of official pages for each place, plus the domains the app may read.
   - The federal pack (IRS, SBA) is in. Its links were confirmed working on 2026-10-26, but each page still needs a content read in milestone 3.
   - The state, county and city packs for the demo places come next. This takes the longest, and a non-coder can do it.
2. **Retrieve.** The app fetches the pack's pages itself and extracts the text. A search API limited to the pack's domains could be added later to find more pages.
3. **Extract.** The model reads the fetched pages and the business profile, and returns requirements that point to source ids.
4. **Verify in code** (`verifyCitations`). A requirement counts as sourced only if it cites pages the app actually fetched, from approved domains. Anything else gets "Needs verification," plus who to call and what to ask.
   - Fees and deadlines the model quotes must appear in the fetched page's text. Otherwise they're dropped and the requirement is marked "Needs verification."
   - The app records the page's final URL after redirects, and refuses redirects to unapproved domains.
5. **Snapshot.** Results are saved per place and business type, with the date checked. The demo runs from saved results, and a "Re-check sources" button runs live.

## Stages

| Stage | Route | What the owner gets |
|---|---|---|
| Understand the business | `/business` | A saved business profile |
| Research requirements | `/requirements` | Requirements with sources, plus gaps to verify |
| Explain formation options | `/structure` | A plain-language comparison: sole proprietorship, partnership, LLC, DBA |
| Support a decision | `/structure` | A suggested path with reasoning and tradeoffs, plus when to see a professional |
| Build the checklist | `/checklist` | Steps in order, where to complete each one, what to prepare, fees |
| Guide completion | `/checklist` | Progress, uploaded confirmations, next steps |

**What's decided by rules vs. by AI:**
- Fixed rules decide which structures are possible. These rules are written only after checking official sources, never from a guess.
- AI explains the options for this owner.
- Code orders the checklist by prerequisites (`orderTasks`, `taskReadiness`).

## AI workflows

- **Product → marketing (`/products`)**
  - The owner enters the photo, materials, price and quantity.
  - AI drafts a listing and a social post from those facts only. Claims like "gluten-free" are flagged for the owner to confirm, never added.
  - Drafts are cross-checked against the owner's own requirements, such as a home-kitchen label rule.
  - Nothing is exported until the owner approves it.
- **Order → customer reply (`/orders`)**
  - Sample orders are labeled DEMO.
  - `applyOrder` checks and updates stock all at once or not at all; it never comes from the model.
  - AI drafts the reply from the owner's pickup and shipping settings and flags missing details.
  - Each order's history labels every step: rule, AI or owner.
- **Planning for help (`/planning-for-help`)**
  - The owner logs which tasks take the most time.
  - `estimateHire` shows the formula:
    - monthly cost = hours/week × hourly cost × 52 ÷ 12
    - sales needed = monthly cost ÷ gross margin
  - AI drafts a role description.
  - The wording says "estimate," never "you will."

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
  data/
    source-packs/       official sources by place
  db/                   schema (including account tables), client
  lib/
    ai/                 model-agnostic layer (the only place that talks to models)
    auth/               account config, session check, form rules
    data/               owner-scoped data access
    research/           source pack schema, citation verification
    rules/              stock, checklist order, hiring math (plain code, unit-tested)
    domain.ts           shared schemas and enums
    sections.ts         navigation
  test/                 in-memory database for tests
drizzle/                migrations
```

## Build order

| # | Milestone | Priority | Status |
|---|---|---|---|
| 0 | Project setup, database schema, AI layer, rules, federal sources, app layout | Must | Done |
| 1 | Accounts: sign up, log in, and each owner sees only their own businesses | Must | Built; password reset and email verification wait on an email service |
| 2 | Intake: the business profile questions, one at a time, as in the prototype | Must | |
| 3 | Research engine, requirements view, gaps, streaming calls, state source packs | Must | |
| 4 | Structure and path, checklist | Must | |
| 5 | Product → marketing | Must | |
| 6 | Order → customer reply | Must | |
| 7 | Planning for help | Must | |
| 8 | Completion: uploads, help chat on each task | Should | |
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
3. **1:30** – A 15-second switch to a second demo business, to show the requirements and path change.
4. **1:50** – Photo → listing, with a flagged claim; the owner edits and approves.
5. **2:20** – A demo order arrives: stock goes down, a reply is drafted, and a missing detail is flagged.
6. **2:45** – Planning for help: 15 hrs/week at $18/hr is about $1,170 a month, or about $2,925 in sales at a 40% margin → role description → "someone's first job."

## Open decisions

1. Hackathon timeline and team size.
2. Which states and cities the demo supports.
3. Repo visibility for submission. It's private for now.
4. Whether the rules require every AI call, including eval graders, to use Muse.
5. Which email service sends password resets and verification emails, and whether a hackathon demo needs them.
