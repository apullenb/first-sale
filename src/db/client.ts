import { attachDatabasePool } from "@vercel/functions";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

// Override for throwaway databases, such as the e2e run
export const PGLITE_DIR = process.env.PGLITE_DIR || "./.pglite";

// Hosted Postgres when DATABASE_URL is set, otherwise local PGlite (no install needed).
function createDb() {
  const url = process.env.DATABASE_URL;
  // A deployed app must never fall back to a throwaway local database
  if (!url && process.env.VERCEL) throw new Error("DATABASE_URL is not set.");
  if (!url) return drizzlePglite(PGLITE_DIR, { schema });
  const pool = new Pool({ connectionString: url, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 10_000 });
  // Keeps the function awake until idle connections close, so a pause can't strand one
  attachDatabasePool(pool);
  return drizzlePostgres(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;

// One instance per process, even across dev reloads: two PGlites on one folder lose writes.
const globalForDb = globalThis as typeof globalThis & { firstSaleDb?: Db };

export function getDb(): Db {
  globalForDb.firstSaleDb ??= createDb();
  return globalForDb.firstSaleDb;
}
