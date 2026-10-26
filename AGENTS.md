<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

- AI drafts, rules calculate, the owner approves. Money, stock, order status and task order live in `src/lib/rules` as plain, tested code — never model output.
- Talk to models only through `src/lib/ai` (`getModel`, `generateObject`). No vendor SDKs elsewhere: the hackathon requires Meta Muse, and the app must run on any OpenAI-compatible model.
- Every structured AI call registers an offline answer with `registerMockFixture` (see src/lib/intake/suggest.ts), so the app works without an API key.
- Requirements shown to owners must pass `verifyCitations`; anything else is "Needs verification".
- Nothing is filed, published or sent without owner approval. Sample orders are labeled DEMO.
- US only for now (federal, state, county, city).
- Each owner sees only their own businesses. Pages, actions and route handlers read data through `src/lib/data/my-businesses.ts`, which takes the owner from `getCurrentUser()`; the `*ForOwner` functions are for those wrappers and tests. A layout's session check doesn't protect its pages, so every data read must go through these wrappers.
- After sign-in, sign-up or log-out, do a full page load (`window.location`), not a client route change: Cache Components keeps old screens mounted with their state.
- Anything that reads the session must sit inside a `<Suspense>` boundary (Cache Components is on).
- Schema changes need a migration: `npm run db:generate`, then commit the file in `drizzle/`.
- No seed scripts or built-in sample businesses; demo businesses are created through the app.
- UI follows the guided-workspace direction in PLAN.md (UI direction). Use the theme colors in `globals.css` and `ActorChip` for AI / Rules / You labels.
- Comments: 1–2 short lines, only when needed, no history.
