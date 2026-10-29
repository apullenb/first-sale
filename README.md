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

AI requests (intake suggestions, research, reading and explaining forms, drafting answers, business plans and marketing plans, product photos, logos and brand pictures, and website words and explanations) are limited to 10 an hour and 50 a day per owner, and 500 a day across everyone (`AI_DAILY_LIMIT`), to cap cost.

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

## Your business (intake)

Owners answer mostly by clicking: they pick the kind of business closest to theirs, click examples of what they'll sell, then answer a few questions at a time. A home baker, a woodworker and a boutique owner get different follow-ups (food kept cold; items for children and items that touch food; where stock comes from). Typing is limited to short fields: the business name, and optionally "anything else". Describing the business in a sentence is optional; AI (or practice-mode word matching) can suggest answers from it, marked until the owner confirms them.

- "Not sure" is offered wherever it fits. It opens a short explanation with ways to find out, and it's saved as an open question, never as "no".
- Answers that other answers clearly imply (cheesecake needs to be kept cold; pickup at home means customers visit) are filled in and marked "Filled in from your answers" until the owner continues past them.
- County and city are searchable, from the US Census Bureau's 2020 county and place lists (`scripts/update-places.mjs`; census.gov last updated them in February 2023, so places formed since are missing). Picking a city that sits in one county fills the county; one that spans several asks which. A Census-designated community is labeled "no city government", and the city-limits question still asks rather than assuming. Owners can always type their own.
- Progress saves automatically (`intake_drafts`), so owners can leave and pick up where they left off.
- Before anything is researched, the owner checks a summary that keeps confirmed answers, filled-in answers and open questions apart.
- Changing answers later shows what the change affects (requirements, plan, suggested structure, a recorded decision, drafted forms, website and branding) before the owner confirms. Each confirmed change is kept in the business history (`business_events`).

## Structure and path

/structure explains four separate things: ownership structure, business name registration (DBA), tax treatment, and licenses and permits. A DBA is never shown as an alternative to an LLC, and no structure is assumed.

- Each applicable structure shows what it means, why people choose it, setup, ongoing obligations and tradeoffs. Every line about an obligation links to the IRS or SBA page it comes from (quotes in `src/lib/structure/facts.ts`, re-checked by `facts.test.ts` against saved page text) or is marked "Needs confirming for {state}". State fees and filings come only from the owner's requirements research.
- A suggested starting point is worked out by fixed rules (`src/lib/structure/suggest.ts`) and lists the answers it rests on, what it assumes, other reasonable options, answers that would change it, and questions to take to a professional. It's labeled as a suggestion, not a legal decision.
- "Try a what-if" (add a co-owner, sign a lease, hire, customers at home) compares suggestions without touching the saved answers.
- The owner records their decision (structure, name plan, tax plan) only after a confirm step that shows what will be saved and what it's based on. Each change is kept with a date and the answers behind it; if answers change later, the page says the decision was made with older answers.

## Requirements research

"Find my requirements" on the Requirements page:
1. Reads the federal pages listed in `src/data/source-packs/`.
2. Searches for the owner's state, county and city pages with Muse web search, one narrow question per topic.
   - Results are kept for 7 days in `search_cache`, shared by every owner, so the same question for the same place isn't paid for twice. They're kept only when they include an official page for that place, so a search that found none runs again. The pages themselves are still fetched fresh on every check.
   - Only pages on domains in CISA's official .gov registry count, and only when the registry says the site belongs to the owner's own state, county or city. Code decides this, not the model.
   - The registry snapshot is `src/data/dotgov/domains.json`. Refresh it with `node scripts/update-dotgov.mjs`.
   - Some real government sites aren't on .gov (Florida's business registry, for one). Their rules show as "Needs verification" until the owner confirms them in writing.
3. Fetches every page itself (HTML or PDF), following redirects only within the same site.
4. Asks the model which requirements apply. The pages are evidence: instructions inside them are ignored.
5. Checks every requirement in code:
   - Its quote must appear word for word on a page it cites.
   - Fees and deadlines must appear inside that quote, or they're dropped.
   - State and local requirements need a page from that government.

6. Decides, in code, whether each one applies (`classify` in `src/lib/research/applicability.ts`), from the owner's answers and decisions:
   - **Applies to you:** an official page confirms it, and it fits the answers.
   - **Depends on something:** it applies only if something is true, and the card says what. For example, a city rule while the owner hasn't confirmed they're inside city limits, or an LLC step while the structure is undecided. "Not sure" and unanswered are treated as unknown, never as "no".
   - **Your choice:** optional, such as an EIN for a sole proprietor with no employees.
   - **To confirm:** no official page confirmed it yet.
   - **Outside what we check:** rules First Sale doesn't research, such as children's product safety, with who does.

   A step for a structure the owner ruled out stays on record but leaves the plan.

The page shows where the rules come from (state, county, and whether the address is inside city limits; never guessed from a ZIP code). It also shows what changed in the owner's answers since the check, and a "What we checked" list for each research category and level of government. A gap there says "not searched", "no official page found" or "the site didn't let First Sale read it", never "no rule". Where official pages disagree, both are shown.

Calling an office is never a required step. Anything unconfirmed has a prepared written question to copy into the office's contact form or email, with the best official link. Results are saved, and "Re-check sources" runs it again. Changing a decision such as the structure re-plans from the saved research instead, and the owner reviews the changes first. Reading the pages needs an internet connection, even in practice mode.

**Demo place: Austin, Travis County, Texas.** Official Texas, Travis County and Austin pages are source packs read live (`src/data/source-packs/`):
- the Secretary of State's Form 205 (LLC certificate of formation, $300) and Form 503 (assumed name for an LLC or corporation, $25)
- the Travis County Clerk's assumed name page ($23 for a sole proprietor or partnership)
- the Comptroller's sales and use tax permit (no fee), franchise tax (report due May 15) and bakery-item tax pages
- DSHS cottage food rules (what Texas requires of a home kitchen, and what it doesn't)
- Austin's home-business page

The server can't read the Texas statutes site, so agency pages are the sources. Other places rely on search, and anything these pages don't cover stays "To confirm" with a written question.

## Startup plan

Each research run turns the checked requirements into ordered steps (`src/lib/rules/plan.ts`). Business structure, name registration, tax registrations and permits are always separate steps. The plan page shows:
- the one next step, and what can happen at the same time
- what depends on an answer first, what waits on another step, and what's submitted and waiting to hear back
- what comes later (renewals, hiring) and what's optional
- costs: fees confirmed on official pages to get started, renewals each year after that (not counted twice in the first year), "maybe" fees for conditional steps, and the steps whose fee no official page states. Each form's fee counts once.

Each step has numbered self-filing instructions (`src/lib/rules/filing.ts`): what has to happen first, what to have ready, the form or application, fees and deadlines, how to submit, where to save the receipt, and what happens next. Every fee, time and method shows the official page it came from and the date it was checked; anything not confirmed says "unknown".

The owner records progress themselves. "I submitted it" and "approved" are separate, and opening a link or a form never changes a step. A step that a later plan drops stays on record once it's submitted or done.

The first plan applies straight away. After that, a re-check or a changed decision that changes anything that matters waits for the owner's review.

## Official forms

Forms First Sale knows by hand are in `src/data/official-forms/`, each with word-for-word quotes from the official pages and the date they were checked.

- **IRS Form SS-4 (EIN), from irs.gov:**
  - "Get the official form" downloads it and checks that it's from the IRS's own site and the exact revision First Sale checked (Rev. December 2025).
  - The original is kept unchanged.
  - Fixed rules fill the blanks the owner's confirmed details answer, such as line 6, "Travis County, Texas". SSN, EIN and signature blanks always stay empty.
  - A newer revision is flagged and isn't filled by these rules.
  - The online EIN application gets an answer guide instead.
- **Texas Forms 205 (LLC certificate of formation) and 503 (assumed name certificate), from sos.texas.gov:** downloaded and checked (Revised 09/26).
  - Form 205: rules fill the LLC's name, who runs it and the franchise-tax mailing address.
  - Form 503: rules fill the assumed name, entity type and principal office.
  - The registered agent, organizer and signatures are left for the owner.
- **Texas Form 401-A (registered agent's consent), from sos.texas.gov:** downloaded and checked (Revised 12/09).
  - Texas requires the agent's written consent before Form 205 names them. The form is signed and kept, not filed, and it doesn't count as the step's filed form.
  - When the agent is one of the owners, rules fill the business name and the agent's name. The part for an agent company is left blank.
- **Travis County assumed name certificate, from traviscountytx.gov:** for a sole proprietor or partnership. It's downloaded and checked, and rules fill the name, address and owners. It's signed before a notary to mail, or filed in person with every owner's ID.
- **Texas Form AP-201 (sales and use tax permit), from comptroller.texas.gov:** downloaded and checked (Rev.7-26/31). Its 231 blanks aren't mapped by hand, so the paper form is drafted by matching, and the online application gets an answer guide.

A step offers the forms that fit the owner's county and structure. An LLC gets Form 503, and a sole proprietor or partnership in Travis County gets the county's form.

Links and quotes from sites that refuse automated requests are marked "checked by hand", with the date. First Sale never gets past a site's bot check.

The owner reviews every answer and saves a reviewed copy (a filled PDF or an answer guide). It's a new version next to the original, marked "Not filed". If a detail a draft used changes later, such as the address or the structure, the draft and its copies are flagged outdated, and "Update the answers" drafts those blanks again.

## Owners' agreement

An LLC's or partnership's own rules: who owns what, who runs it, and how decisions and money are handled. In Texas an LLC's is called a company agreement. It isn't filed with the state, but banks commonly ask for it, and without one Texas law decides how profits are split.

- **Where:** on the step that forms the business (or the structure step, for a partnership) and on the Documents page, once an LLC or partnership is recorded.
- **Filled by rules, not AI.** Fixed wording is filled from the saved name, owners, who runs it, purpose, address and state. The owner adds each owner's share (they must add up to 100%), what each puts in, how owners decide, and the manager's name if there is one.
- **Approve, then sign.** Approving makes a PDF with Schedule A (the owners' shares) and a signature line for each owner. It says it's a starting point, not legal advice.
- **Outdated.** If a detail it used changes, it's flagged and can't be approved until it's prepared again. Preparing again removes the old PDF.
- **Not covered:** buyouts, death or disability, deadlocks, competing businesses and pay. The page lists these for a lawyer.
- Sole proprietors don't need one. Corporations adopt bylaws instead, which First Sale doesn't prepare yet.

## Documents and the paperwork companion

Owners can upload a PDF or photo (up to 4 MB), paste a form's text, or have the app fetch an official PDF from a .gov link. Code reads PDF text and fill-in boxes. The model reads photos and scans, and flags anything it couldn't read clearly instead of guessing. Then the companion can:
- explain the form, with each point tied to the form's own words (checked in code), kept apart from researched guidance from the plan
- answer questions about a field or term
- draft answers from details the owner has confirmed. The model only matches blanks to facts; the values come from saved details. Signatures, ID numbers and sworn statements are always left for the owner.
- make a filled copy (fillable PDFs) or an answer sheet, with only answers the owner confirmed. The answer sheet says "Not filed" on the page. The filled copy says so in the PDF's details instead, so a printed copy can still be filed. First Sale never submits anything.

The document library is grouped by plan step. Each document shows its role (official original, form you added, answer guide, reviewed copy, receipt, approval or prepared document), its status (draft with answers to check, reviewed copy saved, outdated, record of filing), where it came from, the date it was downloaded or added, and its earlier versions. Owners can preview, download and delete, replace an uploaded file with a newer version (the earlier one stays), and save receipts and approvals to a step. Receipts aren't sent to the AI service. A retried download or upload returns the document already saved instead of a copy.

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

## Marketing plan

"Build your marketing plan" is the first page under Marketing and branding.

1. **Questions.** Three short screens. Each question has a "Why we ask" line.
   - Where to show up: Instagram, Facebook, Google Business Profile, TikTok, Pinterest, YouTube, Nextdoor, Yelp, LinkedIn or an email list, with the note "It’s okay if you don’t have these accounts. We’ll set them up together." Then which accounts they already have, and which they don’t want at all.
   - How familiar they are with social media, how much they know about SEO, and how much marketing content (photos, video, writing) they’ve made.
   - What they’ve done for marketing so far.

   What First Sale already knows (name, what they sell and how, where, budget, launch date, logo, website) isn’t asked again. Answers are saved per business and can be changed later.
2. **Plan.** Muse Spark reads the business answers, the business plan’s customer, difference, price and monthly-goal answers, the brand brief, the website choice, approved photos and startup plan progress. It drafts goals, who to reach, platforms with reasons and how often, things to post about, a weekly rhythm and first actions, behind a progress screen that ticks off each part. Code then checks the draft (`checkPlan` in `src/lib/rules/marketing.ts`):
   - Platforms the owner ruled out are removed, along with every sentence that names them (plurals and other names, like “IG”, too).
   - Platforms they didn’t pick stay only as up to two suggestions, and every one they picked gets a place. If they picked none, the top suggestion leads.
   - One platform always leads, and someone new to social media gets only one.
   - Dollar amounts they didn’t give are flagged.

   The owner approves it, which saves a PDF to My Business Library. If their answers change, the plan says so until it’s written again, and anything naming a platform they’ve since ruled out is hidden.
3. **Steps.** Approving makes the steps, in order, by rules (`buildMarketingSteps`): a profile picture, setting up each platform the plan uses now (or tidying one they already have), photos, two weeks of posts, search words for their website if they chose one, then the plan’s first actions. How much help a step gets follows the owner’s answer for its area:
   - New to it: every step, open, with a "Take me there" link.
   - A little: a short checklist, with the step-by-step one tap away.
   - Confident: a short checklist.

   Setup steps follow each platform’s own help page, with the date checked (`src/data/marketing-platforms.ts`). TikTok’s page couldn’t be read, so its steps say they’re general. The email list step quotes the FTC’s rule that marketing emails need a postal address and a way to opt out. The owner ticks steps off. Writing the plan again keeps the current steps until the new plan is approved, and ticks carry over to steps that stay.

**Stored:** `marketing_plans` holds the answers, the plan, when it was approved, the steps and which are done. Saved plans carry a `version` and are read leniently, so new sections can be added later without breaking them.

**Practice mode:** the plan is a template built from the owner’s answers, labeled on the plan, the steps and the PDF.

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

## Branding

On the Branding page, owners get a logo made for their business, its versions, and matching pictures for their pages. They never write instructions for the AI.

1. **Your business.** The name in the logo, what they sell and who buys it are filled in from the intake answers and shown as a summary with an Edit button. The fields open on their own only when a name or product is missing. The tagline is optional.
2. **Feel.** One click each:
   - 3 to 8 words from about 50, grouped by era, place, mood and look ("vintage", "retro ’80s", "neon vibes", "farmhouse", "rustic", "western"…)
   - four this-or-that questions (old-fashioned or modern, playful or serious, quiet or loud, handmade or polished)
   - up to 3 color families
   More options hold colors to avoid, a symbol idea and anything to avoid.
3. **Brand picture.** Muse Spark turns the picks into a 2–3 sentence scene ("Rise Bakery is a porch swing on an old wooden back porch…"). The owner chooses "This feels like my business", "Try again with different adjectives" or "Revise this description" (an editable text box). Logo ideas wait until they approve one, and it then guides every idea, drawing and picture.
4. **Ideas.** Muse Spark acts as a creative director, working from the brand picture. It writes 5 concepts that are genuinely different from each other, each with a kind (wordmark, monogram, badge, drawn symbol, abstract, or a letter and symbol), a specific idea, a lettering direction, a 1–3 color palette (hex) and a plain-words rationale.
5. **Drawing.** Code builds each Muse Image instruction from the concept plus fixed quality rules:
   - the business name, spelled exactly and letter by letter, and no other words
   - recognizable at 32 pixels
   - flat and vector-like, 1–3 colors, works in one color
   - centered on plain white
   - no mockups, 3D, photorealism, gradients, shadows or clip art
   It calls `/v1/images/generations` with Muse Image's own web and image search turned off (`tool_enablement`), so it doesn't copy marks it finds online.
6. **Spelling check.** Muse Spark reads each logo's lettering without being told the name, so it can't "see" what it expects. Versions are read on their own, apart from the logo they're compared with. Code then compares what it read with the exact name and tagline, letter for letter in any script, accents included. It flags:
   - misspellings
   - words split or joined differently
   - extra words; initials count as extra except on a monogram or letter mark
   - lettering it couldn't read
   It says when punctuation isn't checked.
7. **Refine or explore.** The owner can change a logo in plain words: the logo goes back to `/v1/images/edits` as image 1. Or they can ask for 3 more ideas like one they liked.
8. **Versions.** From the chosen logo, `/v1/images/edits` makes a stacked version, a profile-picture version (the symbol only, padded for a circle crop) and a one-color version. The chosen logo is image 1 every time. Muse Spark compares each version with the logo, and code adds its own rules: the name must never appear in the profile picture, and the stacked and one-color versions must spell the name exactly. The owner approves the three together.
9. **Brand pictures.** Pictures for a Facebook cover, a YouTube banner, a website header and a link preview are made from the approved logo in its colors and style. They're flat artwork, never photos of products the owner may not sell. Guides show what each site crops or covers, and exact-size downloads are made in the browser, because Muse Image only sets the shape.
10. **Brand kit.** The chosen logo, approved versions, palette and approved pictures, with downloads. Other sections read it through `getMyBrand()`.

**Stored:** every file is saved byte for byte as Muse returned it, with its pixel size read from the file. A failed drawing saves nothing.

**Cost and retries:** Muse Image costs $0.01 per returned picture, and Meta doesn't bill pictures that fail or are blocked. Every button says how many pictures it makes:

| Action | Pictures | Cost |
|---|---|---|
| Ideas | 5 | $0.05 |
| More like this | 3 | $0.03 |
| A change | 1 | $0.01 |
| Versions | 3 | $0.03 |
| Brand pictures | 4 | $0.04 |

Muse Spark's writing and checks are billed by length on top of that. There's no idempotency key, so:
- each request carries a key from the browser
- drawing an idea is keyed by the idea itself
- `runWorkflow` blocks double runs
- room is checked before paying

Limits: 20 rounds of ideas, 120 files, and 250 MB per business. The owner can remove the ideas they didn't choose.

**Not claimed:** transparent backgrounds (Meta's docs say output is always opaque), exact pixel sizes from Muse, and that a logo is free to use. The page links the USPTO trademark search.

**Practice mode:** ideas are labeled placeholders, and every "logo" is a plain text wordmark SVG that says "Practice preview, not made by Muse" inside the image. It's labeled the same way on the page and in download names.

## Website

On the Website page, owners pick where to build their site, choose a web address and get the words for each page. They build the site themselves on the platform they pick.

1. **Choose.** Square, Wix and Shopify, with prices checked on each company's own pages (`src/data/website-platforms.ts`, with sources and the date checked). Each card shows the plans, card fees, what a web address costs, a first-year total worked out by code, pros and cons, and what isn't included that the owner will likely need. Fixed rules (`src/lib/website/recommend.ts`) suggest one from the owner's answers and say why.
2. **Explain more.** Muse Spark explains one option for this owner, using only that card's facts. Numbers that aren't in the facts are flagged. An explanation is kept until the card's facts change.
3. **Find more options.** Only when the owner asks, Muse searches the web for other builders. Code keeps an option only if its website is among the results and carries its name. Prices, other numbers and money words ("free", "no fees") stay only if they appear in that option's own sources.
4. **Web address.** Ideas from the business name and town, and a check of any .com or .net against the official registry (Verisign RDAP). "Not registered yet" is a snapshot, not a promise. Checks are limited per owner, so the shared registry isn't flooded.
5. **Words.** Muse Spark drafts each page from the intake answers, the business email, phone and purpose, and the business plan's answers about customers, what sets the business apart, and prices. Owner names, addresses, costs and funding are never sent. Numbers the owner didn't give are flagged, and missing facts become [bracketed] notes. The owner edits and approves; approving saves a PDF of the words to Documents.
6. **Preview and build.** A rough preview with the brand kit's colors, logo and header picture. Then the platform's setup steps, each linking to its own help, as a checklist, and every piece of text ready to copy.

Words written for one platform must be drafted again before approving if the owner switches platforms. Prices change, so each card shows the date they were checked.

**Practice mode:** the words are a fill-in-the-blanks template, "Explain more" restates the card's facts, and "Find more options" says it needs the AI service. Each is labeled.

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
- Every structured call streams, so long thinking doesn't hit a timeout. Each request carries a hashed owner id as `safety_identifier`.
- Temporary failures (rate limits, server errors, dropped connections) are retried twice with backoff and jitter, waiting as long as `Retry-After` asks. Each call's time limit covers every attempt and wait together, and a retry happens only if a quarter of that time is left after the wait, so each page's time limit holds. Bad requests and gateway timeouts (504, which Meta says usually time out again) are never retried.
- Each task's system prompt is a stable prefix sent first, and its schema name goes out as `prompt_cache_key`, so repeat calls reuse Meta's prompt cache. Research sends the official pages first (federal, then state, county, city) and the owner's answers last, so owners in the same state share a cached start, and only research asks for `prompt_cache_retention: "24h"` (never calls with uploaded documents). Cached input costs $0.15 per million tokens against $1.25 (Meta's pricing page, 2026-10-28).
- Each call logs its token counts (input, cached, output, reasoning), never the prompt or reply. Web searches also log how many queries ran, since Meta bills $2.50 per 1,000 queries on top of tokens.
- Reasoning effort is the lowest that fits the task: high for research, medium for writing, judging and reading scans (handwriting and glare need the care), low for extraction like filling form fields. Thinking bills as output.
- After research's code checks, a second model call judges whether each quote actually says what its requirement claims (`src/lib/research/claims.ts`). Requirements it doesn't back become "to confirm". If that call fails, the code checks stand alone.
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
| `node scripts/update-places.mjs` | Refreshes the Census Bureau county and place lists behind the county and city pickers |
