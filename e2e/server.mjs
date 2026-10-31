// Starts the app for e2e on a fresh, migrated PGlite folder, never the hosted database
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const dir = process.env.PGLITE_DIR ?? "";
if (!dir.includes("e2e")) throw new Error("PGLITE_DIR must be the e2e folder.");
if (process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED) throw new Error("DATABASE_URL must be empty for e2e.");
if (process.env.AI_PROVIDER !== "mock") throw new Error("e2e runs in practice mode only (AI_PROVIDER=mock).");

rmSync(dir, { recursive: true, force: true });
const client = new PGlite(dir);
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
await client.close();

const child = spawn("npx", ["next", "dev", "-p", process.env.E2E_PORT ?? "3117"], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
