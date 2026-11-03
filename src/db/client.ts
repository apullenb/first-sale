import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Override for throwaway databases, such as the e2e run
export const PGLITE_DIR = process.env.PGLITE_DIR || "./.pglite";

// Hosted Postgres when DATABASE_URL is set, otherwise local PGlite (no install needed).
function createDb() {
  const url = process.env.DATABASE_URL;
  // A deployed app must never fall back to a throwaway local database
  if (!url && process.env.VERCEL) throw new Error("DATABASE_URL is not set.");
  if (!url) return drizzlePglite(PGLITE_DIR, { schema });
  // Close idle sockets before a paused function or sleeping database leaves them half-open
  const client = postgres(url, { idle_timeout: 20, connect_timeout: 10, max_lifetime: 60 * 5 });
  return drizzlePostgres(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

// One instance per process, even across dev reloads: two PGlites on one folder lose writes.
const globalForDb = globalThis as typeof globalThis & { firstSaleDb?: Db };

export function getDb(): Db {
  globalForDb.firstSaleDb ??= createDb();
  return globalForDb.firstSaleDb;
}
