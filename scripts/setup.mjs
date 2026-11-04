// Local setup: .env.local from .env.example, with a fresh sign-in secret
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const file = ".env.local";
if (!existsSync(file)) copyFileSync(".env.example", file);
const text = readFileSync(file, "utf8");
if (/^BETTER_AUTH_SECRET=\s*$/m.test(text)) {
  writeFileSync(file, text.replace(/^BETTER_AUTH_SECRET=\s*$/m, `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64")}`));
  console.log("Created .env.local with a new BETTER_AUTH_SECRET.");
} else {
  console.log(".env.local already has a BETTER_AUTH_SECRET; left as is.");
}
