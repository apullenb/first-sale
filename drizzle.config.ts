import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Same env files as the app, so DATABASE_URL in .env.local is honored
loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL;

export default defineConfig(
  url
    ? { dialect: "postgresql", schema: "./src/db/schema.ts", out: "./drizzle", dbCredentials: { url } }
    : {
        dialect: "postgresql",
        driver: "pglite",
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dbCredentials: { url: process.env.PGLITE_DIR || "./.pglite" },
      },
);
