# First Sale

Step-by-step help for first-time US business owners: research what applies to them, choose a structure, work through formation, then run daily work with AI help while staying in control.

See [PLAN.md](PLAN.md) for the full plan.

## Quick start

Requires Node 24 (`nvm use`).

```bash
npm install
cp .env.example .env.local
npm run db:push
npm run dev
```

Open http://localhost:3000. Without an API key the app uses a mock model. There are no built-in sample businesses; once intake is built, demo businesses are created through the app.

The local database is PGlite in `.pglite/`, and only one process can use it at a time. Stop `npm run dev` before running `db:push`.

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
| `npm test` | Runs unit tests |
| `npm run typecheck` | Runs TypeScript checks |
| `npm run lint` | Runs ESLint |
| `npm run db:push` | Creates or updates tables (local PGlite, or `DATABASE_URL`) |
