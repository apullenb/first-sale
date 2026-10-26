import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export const PGLITE_DIR = "./.pglite";

// Hosted Postgres when DATABASE_URL is set, otherwise local PGlite (no install needed).
function createDb() {
  const url = process.env.DATABASE_URL;
  return url ? drizzlePostgres(url, { schema }) : drizzlePglite(PGLITE_DIR, { schema });
}

export type Db = ReturnType<typeof createDb>;

// One instance per process, even across dev reloads: two PGlites on one folder lose writes.
const globalForDb = globalThis as typeof globalThis & { firstSaleDb?: Db };

export function getDb(): Db {
  globalForDb.firstSaleDb ??= createDb();
  return globalForDb.firstSaleDb;
}
