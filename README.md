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

Open http://localhost:3000, create an account and answer the intake questions. Without an AI key the app uses a mock model; AI suggestions then come from simple keyword matching. There are no built-in sample businesses: create each demo business through the intake like any other, one per account.

AI requests (intake suggestions and requirements research) are limited to 10 an hour and 50 a day per owner, and 500 a day across everyone (`AI_DAILY_LIMIT`), to cap cost.

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

Rate limiting keys on the visitor's IP from `X-Real-IP`, which Vercel sets. On a host that doesn't overwrite that header, visitors can fake it, so configure trusted proxies there. The limit is 3 sign-in or sign-up tries per 10 seconds per IP, so a room of people on one Wi-Fi network may need to pause between sign-ups.

## Requirements research

"Find my requirements" on the Requirements page reads the official pages listed in `src/data/source-packs/` (federal for now), asks the model which requirements apply, then checks every one in code:
- Its quote must appear word for word on a page it cites.
- Fees and deadlines must appear inside that quote, or they're dropped.
- State and local requirements need a page from that government.

Anything that fails is shown as "Needs verification," with who to call and what to ask. Results are saved, and "Re-check sources" runs it again. Reading the pages needs an internet connection, even with the mock model.

## AI models

The app works with any OpenAI-compatible model. Set `AI_PROVIDER` in `.env.local`:

| Value | Uses |
|---|---|
| `muse` | Meta Muse through the Meta Model API. Needs `MUSE_API_KEY`; the model defaults to `muse-spark-1.3`. |
| `openai-compatible` | Any other endpoint. Needs `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL`. |
| `mock` | No network calls. The default, used by tests. |

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Starts the dev server |
| `npm test` | Runs unit tests (each database test gets its own in-memory Postgres) |
| `npm run typecheck` | Runs TypeScript checks |
| `npm run lint` | Runs ESLint |
| `npm run db:generate` | Writes a new migration in `drizzle/` after a schema change |
| `npm run db:migrate` | Applies migrations (local PGlite, or `DATABASE_URL`) |
