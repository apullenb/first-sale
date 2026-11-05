# Validation

11 businesses in 11 states, run live through SnapStart and graded item by item against answer keys built independently from official government pages.

| What we measured | Result |
|---|---|
| Requirements needed **before the first sale** that SnapStart found | **45 of 57** (79%) |
| Requirements that come **later** (renewals, tax returns) that it found | 32 of 39 (82%) |
| Requirements wrongly marked **"Not needed"** | **0** |
| Steps listed that the owner doesn't need | 12 across 11 businesses |
| Steps marked verified that the key disagrees with | 3 of 50 |
| Average time and AI cost per business | 6.6 minutes, $1.73 |

**What holds up:** SnapStart finds most of what an owner must do, both before opening and after, and it never told an owner they could skip something they need: no requirement in any of these businesses was marked "Not needed" by mistake. 5 of 6 "Confirm with the office" steps were something worth confirming.

**What we're improving next:** a few steps are listed without checking an exemption that covers the owner, a few rest on a source that doesn't settle them, and fees show only when their quote passes the word-for-word check, so many fees are left for the owner to read on the official page. Product rules for shipped goods (like federal mail-order and labeling rules) are the most common miss.


## How we tested

### Ten businesses in ten states, plus one small-town edge case

| Business | Place | What makes it a good test |
|---|---|---|
| Home bakery: cookies, breads and cakes | Austin, Travis County, Texas | Texas cottage food law; the curated source pack covers this place |
| Handmade soy candles, sold online and at craft fairs | Denver, Colorado | City and county are one government; Denver runs its own sales tax; many official pages are on `denvergov.org`, not `.gov` |
| Freelance graphic design, online only | Portland, Multnomah County, Oregon | No sales tax; city and county business taxes with exemptions; a service, not a product |
| Vintage clothing resale, two owners | Columbus, Franklin County, Ohio | A partnership; vendor's licenses; secondhand-goods rules |
| House cleaning, hiring within a year | Miami, Miami-Dade County, Florida | Florida's business registry and tax sites aren't `.gov`; county and city tax receipts; employer steps |
| Screen-printed t-shirts | Phoenix, Maricopa County, Arizona | Arizona's transaction privilege tax instead of sales tax; city tax rates |
| Lawn care, hiring two employees now | Nashville, Davidson County, Tennessee | A metro government; workers' comp and contractor thresholds; employer steps right away |
| Home-made jams and baked goods | Bozeman, Gallatin County, Montana | No sales tax; Montana's food freedom law; the city's site isn't `.gov` |
| Sneaker resale, online only | Chicago, Cook County, Illinois | Marketplace sales tax rules; Chicago licenses home businesses even online-only |
| Home-baked dog treats | Asheville, Buncombe County, North Carolina | Pet food is commercial feed, not cottage food: a rule that's easy to miss |
| **Edge case:** backyard honey and beeswax lip balm | Decorah, Winneshiek County, Iowa (about 7,500 people) | Added as a sanity check: a small town whose own code sits behind a bot check, honey with its own exemptions, and lip balm, which is a cosmetic under federal law |

Only the Austin case uses SnapStart's curated Texas, Travis County and Austin source packs. The other ten rely entirely on live search of each government's official sites. Decorah was added after the first ten, as an edge case, to see how SnapStart handles a small town. The profiles are in [`bench/validation-cases.ts`](../bench/validation-cases.ts).

### Answer keys, built independently

For each business, a separate research agent built an answer key from official government pages. It never saw SnapStart's code or output, and it worked from the same plain description of the business. Every item in a key has the official page's address and a word-for-word quote of 40 words or fewer, plus a verdict: required, required later, depends on something, not required, or unconfirmed. Each key also lists its hard calls: places where official pages disagree, are out of date, or say nothing. The keys hold 264 items in all, and they're published in [`validation/answer-keys/`](validation/answer-keys/).

To check the keys themselves, we reopened three of their quotes at the live official pages (Chicago's home-based business license, Oregon's corporate activity tax threshold, and Texas's food handler training rule for cottage food). All three matched word for word. The keys weren't reviewed by a lawyer, so read them as a careful second opinion, not legal advice.

### SnapStart, run live

Each business ran through SnapStart's own research, with the same code the app uses, live on Meta Muse (`muse-spark-1.3`): search each government's official sites, read the pages, draft the requirements, check every quote in code, give the quotes a second reading, run the deeper look with its second search, and build the plan. Nothing was hand-tuned per city. The runner is [`bench/validate.ts`](../bench/validate.ts), and what each owner would see is saved in [`validation/runs/`](validation/runs/).

### Graded against the keys

Separate grading agents compared each run with its answer key, item by item, using one fixed rubric, and wrote their grades to [`validation/grades/`](validation/grades/).


## Results

| Business and place | Required before first sale, found | Required later, found | Wrongly "not needed" | Required, but only a "likely doesn't apply" note | Unneeded steps | Steps with a verified official quote | "Confirm with the office" steps | Time and cost |
|---|---|---|---|---|---|---|---|---|
| Home bakery · Austin, TX | 3 of 3 | 3 of 3 | 0 | 0 | 1 | 5 of 18 | 0 (0 irrelevant) | 401 s, $1.74 |
| Candles · Denver, CO | 4 of 7 | 1 of 4 | 0 | 0 | 2 | 4 of 16 | 1 (1 irrelevant) | 382 s, $1.49 |
| Graphic design · Portland, OR | 1 of 1 | 4 of 5 | 0 | 0 | 2 | 3 of 15 | 0 (0 irrelevant) | 300 s, $1.07 |
| Vintage resale, 2 owners · Columbus, OH | 3 of 4 | 5 of 5 | 0 | 0 | 1 | 6 of 20 | 0 (0 irrelevant) | 451 s, $1.91 |
| House cleaning, hiring · Miami, FL | 4 of 5 | 7 of 7 | 0 | 0 | 1 | 2 of 18 | 0 (0 irrelevant) | 361 s, $1.82 |
| T-shirts · Phoenix, AZ | 2 of 2 | 1 of 2 | 0 | 0 | 1 | 7 of 21 | 0 (0 irrelevant) | 418 s, $1.87 |
| Lawn care, 2 employees · Nashville, TN | 6 of 8 | 5 of 5 | 0 | 0 | 1 | 4 of 20 | 0 (0 irrelevant) | 287 s, $1.36 |
| Jams · Bozeman, MT | 3 of 3 | 2 of 2 | 0 | 0 | 2 | 7 of 19 | 0 (0 irrelevant) | 355 s, $1.47 |
| Sneaker resale · Chicago, IL | 4 of 5 | 1 of 2 | 0 | 0 | 0 | 2 of 17 | 2 (0 irrelevant) | 481 s, $1.60 |
| Dog treats · Asheville, NC | 7 of 10 | 1 of 1 | 0 | 0 | 0 | 6 of 16 | 2 (0 irrelevant) | 476 s, $1.87 |
| **Edge case:** honey and lip balm · Decorah, IA | 8 of 9 | 2 of 3 | 0 | 0 | 1 | 4 of 15 | 1 (0 irrelevant) | 467 s, $2.80 |

Columns, in plain words:
- **Required before first sale, found:** answer-key items needed before the first sale, that SnapStart listed as a step, a question about the owner's plans, or something to confirm.
- **Required later, found:** the same for duties that come after opening, such as renewals and returns.
- **Wrongly "not needed":** required items SnapStart said aren't needed. The one mistake that could hurt an owner most.
- **Unneeded steps:** items the answer key shows don't apply, listed as steps anyway.
- **Verified:** steps whose official quote passed both checks.

Conditional items (such as children's product rules, for an owner who makes no children's products) were graded against what this owner actually does, and left out when they don't apply. Grades for every item, with a one-line reason, are in [`validation/grades/`](validation/grades/).


## Private numbers in uploaded documents

SnapStart doesn't keep Social Security, ITIN, EIN, card, bank routing or account numbers, or ID document numbers, and the owner still keeps their document. Two made-up PDFs went through the exact steps a real upload takes (`uploadDocumentAction`, then `readAndSave`): checked before storage, redacted when needed, stored encrypted, read and scrubbed. The test is [`src/lib/documents/sensitive-upload.test.ts`](../src/lib/documents/sensitive-upload.test.ts), and it runs with every `npm test`.

### 1. A tax letter with a made-up Social Security number

[Original PDF](validation/privacy/1-ssn-letter.original.pdf) → [the redacted file SnapStart keeps](validation/privacy/1-ssn-letter.stored-file.pdf) · [the text it keeps](validation/privacy/1-ssn-letter.stored-text.pdf)

- **The owner keeps their document, with the numbers blacked out.** The original's bytes never reached the database: its text was checked in code first, and SnapStart stored a redacted copy instead.
- **True redaction, not a box drawn on top.** Each number's exact place came from the PDF's own text positions; the pages were drawn as images with those places painted over and rebuilt into a PDF with no text layer, so nothing is left underneath to copy or extract. Code checks the copy before it's kept.
- **Everything else is intact.** The name, address, ZIP+4, phone, dates and amounts read exactly as on the original, in both the file and the stored text.
- **The numbers appear nowhere in the stored record**, in any format, with or without dashes, and the owner is told what was removed.

| Line on the original | What SnapStart stored | Result | Why |
|---|---|---|---|
| `SAMPLE NOTICE - NOT A REAL DOCUMENT. EVERY NUMBER IS MADE UP.` | `SAMPLE NOTICE - NOT A REAL DOCUMENT. EVERY NUMBER IS MADE UP.` | ✅ Kept as written | Heading |
| `Notice of taxpayer account` | `Notice of taxpayer account` | ✅ Kept as written | Heading |
| `Taxpayer: Jordan Example, Rise & Crumb` | `Taxpayer: Jordan Example, Rise & Crumb` | ✅ Kept as written | Names are needed to match the document to the business |
| `Address: 1200 Barton Springs Rd, Austin, TX 78704-1234` | `Address: 1200 Barton Springs Rd, Austin, TX 78704-1234` | ✅ Kept as written | ZIP+4 is five digits, then four |
| `Date of this notice: 11/04/2026` | `Date of this notice: 11/04/2026` | ✅ Kept as written | A date |
| `Social Security number: 123-45-6789` | `Social Security number: [Social Security number removed]` | ✅ Removed: Social Security number | Formatted 3-2-4 in the SSA's issued ranges |
| `Phone: (512) 555-0143` | `Phone: (512) 555-0143` | ✅ Kept as written | Phone numbers are 3-3-4 |
| `Amount due: $0.00 by 12/01/2026` | `Amount due: $0.00 by 12/01/2026` | ✅ Kept as written | Money and dates |
| `Refund bank routing number: 021000021` | `Refund bank routing number: [routing number removed]` | ✅ Removed: routing number | Labeled, and passes the ABA checksum |
| `Account number: 000123456789` | `Account number: [account number removed]` | ✅ Removed: account number | Labeled bank account number |
| `Keep this notice for your records.` | `Keep this notice for your records.` | ✅ Kept as written | Heading |

### 2. A vendor application full of numbers that only look sensitive

[Original PDF](validation/privacy/2-lookalikes.original.pdf) → [file SnapStart gives back](validation/privacy/2-lookalikes.stored-file.pdf) · [text SnapStart stored](validation/privacy/2-lookalikes.stored-text.pdf)

- **Nothing was removed.** Every phone number, ZIP code, permit number, date, fee and measurement is kept exactly as written.
- **The file was kept, encrypted.** In the database it's sealed (`SSE1` envelope, AES-256-GCM), and reading it back gives the original byte for byte.

| Line on the original | What SnapStart stored | Result | Why |
|---|---|---|---|
| `SAMPLE FORM - NOT A REAL DOCUMENT. EVERY NUMBER IS MADE UP.` | `SAMPLE FORM - NOT A REAL DOCUMENT. EVERY NUMBER IS MADE UP.` | ✅ Kept as written | Heading |
| `City vendor permit application` | `City vendor permit application` | ✅ Kept as written | Heading |
| `Business phone: 512-555-0123` | `Business phone: 512-555-0123` | ✅ Kept as written | Phone, 3-3-4 |
| `Mailing ZIP code: 78704-1234` | `Mailing ZIP code: 78704-1234` | ✅ Kept as written | ZIP+4, 5-4 |
| `Permit number: 2026-001234` | `Permit number: 2026-001234` | ✅ Kept as written | Year and serial, 4-6 |
| `Order number: 123456789` | `Order number: 123456789` | ✅ Kept as written | Nine digits, but no SSN or tax ID label |
| `Invoice 021000021` | `Invoice 021000021` | ✅ Kept as written | Passes the ABA checksum, but isn't labeled as a routing number |
| `Gift card reference: 4111 1111 1111 1112` | `Gift card reference: 4111 1111 1111 1112` | ✅ Kept as written | Card-shaped, but fails the Luhn check |
| `Tracking number: 9400 1000 0000 0000 0000 00` | `Tracking number: 9400 1000 0000 0000 0000 00` | ✅ Kept as written | 22 digits, longer than any card |
| `Social Security number: ___-__-____` | `Social Security number: ___-__-____` | ✅ Kept as written | A blank to fill in |
| `Example only: 000-00-0000` | `Example only: 000-00-0000` | ✅ Kept as written | The SSA never issues area 000 |
| `Case 07-1234567` | `Case 07-1234567` | ✅ Kept as written | EIN-shaped, but the IRS never assigns prefix 07 |
| `Zoning: City Code section 25-2-901` | `Zoning: City Code section 25-2-901` | ✅ Kept as written | A code section |
| `Texas taxpayer number: 32012345678` | `Texas taxpayer number: 32012345678` | ✅ Kept as written | Eleven digits: not an SSN or EIN |
| `Application fee: $25.00, due 2026-12-01` | `Application fee: $25.00, due 2026-12-01` | ✅ Kept as written | Money and an ISO date |
| `Booth size: 10 x 10 feet, 2 tables, 120 volt outlet` | `Booth size: 10 x 10 feet, 2 tables, 120 volt outlet` | ✅ Kept as written | Measurements |
| `Sign and date below.` | `Sign and date below.` | ✅ Kept as written | Heading |

### How it tells the difference

Each kind of number is checked with its own rules, in code:

| Kind | Removed when |
|---|---|
| Social Security number | Written 3-2-4 in the ranges the SSA issues (never area 000, 666 or 900+, group 00 or serial 0000), or 9 digits right after a label like "SSN" or "Social Security No." that also pass those ranges |
| ITIN | Starts with 9 and uses the IRS's ITIN group ranges |
| EIN | Written 2-7 with a prefix the IRS assigns, or 9 digits right after "EIN" or "Employer Identification Number" |
| Card number | 13 to 19 digits that pass the Luhn check and fall in a card network's number range |
| Bank routing number | 9 digits right after "routing" or "ABA" that pass the ABA checksum |
| Bank account number | 6 to 17 digits right after "account number" or "acct" |
| ID document number | Right after "driver's license" or "passport" |

A label never overrides a number's own rules, so "Social Security number: 000-00-0000" on a blank form stays. The same scrub runs on every message to the AI, as a last line of defense. The detector has [its own tests](../src/lib/privacy/sensitive.test.ts), including the lookalikes above.

There's one trade-off we chose on purpose: a number written exactly like an SSN (3-2-4, in issued ranges) is removed even when it's something else, because keeping a real one would be the worse mistake. Photos and scans are read by the AI as images, so the upload box asks owners to cover these numbers first. SnapStart blacks out what the reading finds, and keeps that copy only once a fresh reading of it shows nothing left.

The redactor has its own pixel-level tests ([`redact.test.ts`](../src/lib/documents/redact.test.ts)) that don't reuse its box math: for each number, the pixels that change when the number is removed from the page must all be black in the copy, on normal and rotated pages, while the words beside it stay over 95% unchanged. Numbers typed into fillable form fields are covered too.


## The checks behind these results, and their tests

Each runs in code at a fixed point, with a regression test:

| What could go wrong | What SnapStart does | Test |
|---|---|---|
| A made-up exemption quote marks a step "Not needed" | Only a quote found word for word on the cited page, which the second reading also accepted, can say *Not needed*. Without one, SnapStart's best read is at most a *Likely doesn't apply* note, never a confident "no". | `follow-up.test.ts`: "never calls a rule 'not needed' on a made-up exemption quote…" |
| The second reading of quotes fails or runs out of time | Quotes stay but aren't shown as verified, and the deeper look reads them again, a few at a time | `claims.test.ts`, `requirements.test.ts`: "marks quotes the claims check never read…" |
| The AI returns nothing for a rule | It stays a step, as the first check had it, never "not needed" | `follow-up.test.ts`: "keeps a rule as the first check had it, a step…" |
| An owner is sent to chase a rule that doesn't fit them | A *Confirm with the office* step only when SnapStart's AI, looking at the facts the owner gave, reasonably thinks it could apply but isn't sure. A rule that sounds related but can't cover them (a marine-animal ban and a goldfish) is a note. | `follow-up.test.ts`: "makes a step to confirm only when the AI reasonably thinks it could apply…", "drops the step when logic shows a rule a page names can't really cover this owner" |
| "Probably not needed" is left unexplored | Unsettled rules get a third, targeted search for who needs it and who's exempt, and are settled with a quote whenever one turns up | `follow-up.test.ts`: "settles it on the second search when a page there shows it" |
| A quote joins two real sentences that aren't side by side | Accepted when each sentence is word for word on the same page, close together; a sentence from elsewhere, like a fee for something else, still fails | `verify.test.ts`: "whole sentences quoted together" |
| An official site isn't on `.gov` | Seven vetted government sites count, each backed by a `.gov` page that links to it | `official-sites.test.ts`: "vetted sites outside .gov" |
| A busy AI service is slow | Research runs as two half-size calls at once, each hedged by a lower-effort backup; time limits are enforced even on calls that can be cancelled | `structured.test.ts`, `openai-compatible.test.ts`: "enforces the time limit on a call that can also be cancelled" |
| A search times out | Shown as "the search didn't finish", never as "found nothing" | `follow-up.test.ts`: "says when a search didn't finish…" |

## Reproduce it

```bash
npx tsx bench/validate.ts --case portland-or-design --live --yes --budget 3
```

The runner reads `MUSE_API_KEY` from `.env.local` (or `--env-file`). Without `--live` it runs offline in practice mode. Case ids are in [`bench/validation-cases.ts`](../bench/validation-cases.ts).

```bash
PUBLISH_PRIVACY_REPORT=1 npx vitest run src/lib/documents/sensitive-upload.test.ts
```

That rewrites the before-and-after PDFs in [`validation/privacy/`](validation/privacy/).
