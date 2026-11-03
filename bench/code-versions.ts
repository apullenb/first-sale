import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyEdit, buildVersion, codeEdit } from "@/lib/brand/code-build";
import { kitColors } from "@/lib/brand/colors";
import { letterCount } from "@/lib/brand/layout";
import { logoColors } from "@/lib/brand/pixels";
import { decodePng, encodePng } from "@/lib/brand/png";
import { VERSION_KINDS } from "@/lib/brand/types";

// Runs the code-built versions and edits over the logos of an image-quality run, with no model calls.
// npx tsx bench/code-versions.ts <run folder> [out folder]

const EDITS = ["Make the lettering bolder", "Make the symbol bigger"];

function main() {
  const [runDir, outArg] = process.argv.slice(2);
  if (!runDir) throw new Error("Usage: npx tsx bench/code-versions.ts <run folder> [out folder]");
  const out = outArg ?? path.join("bench", "results", "code-versions");
  mkdirSync(out, { recursive: true });
  const lines = ["# Code-built logo versions", "", `From ${runDir}. No model calls: every file is cut from the logo’s own pixels.`, ""];
  const imagesDir = path.join(runDir, "images");
  for (const scenario of readdirSync(imagesDir).sort()) {
    for (const file of readdirSync(path.join(imagesDir, scenario)).filter((name) => /^01-logo-idea-\d\.png$/.test(name)).sort()) {
      const bytes = new Uint8Array(readFileSync(path.join(imagesDir, scenario, file)));
      const record = path.join(imagesDir, scenario, file.replace(/\.png$/, ".json"));
      const prompt = existsSync(record) ? String(JSON.parse(readFileSync(record, "utf8")).prompt ?? "") : "";
      const name = /Business name, spelled exactly: “([^”]+)”/.exec(prompt)?.[1] ?? "";
      const tagline = /Tagline, smaller than the name and spelled exactly: “([^”]+)”/.exec(prompt)?.[1] ?? "";
      const letters = name ? letterCount(name) + letterCount(tagline) : null;
      const pixels = decodePng(bytes);
      const ink = kitColors((pixels ? logoColors(pixels) : []).map((hex) => ({ hex, name: hex }))).ink;
      const base = `${scenario}-${file.replace(/^01-logo-|\.png$/g, "")}`;
      writeFileSync(path.join(out, `${base}-original.png`), bytes);
      lines.push(`## ${scenario}, ${file} (“${name}”)`, "", `![original](${base}-original.png)`, "");
      const results = [
        ...VERSION_KINDS.map((kind) => ({ label: kind, built: buildVersion(bytes, kind, { letters, ink }) })),
        ...EDITS.map((change) => ({ label: change, built: applyEdit(bytes, codeEdit(change)!, letters) })),
      ];
      for (const { label, built } of results) {
        const slug = label.toLowerCase().replace(/[^a-z]+/g, "-");
        if (built.ok) {
          writeFileSync(path.join(out, `${base}-${slug}.png`), encodePng(built.image));
          lines.push(`- **${label}**: built in code. ${built.note}`, "", `  ![${label}](${base}-${slug}.png)`, "");
        } else lines.push(`- **${label}**: would go to the image model. ${built.note}`, "");
      }
      console.log(base, results.map(({ label, built }) => `${label}: ${built.ok ? "code" : "model"} ${built.confidence}`).join(" | "));
    }
  }
  writeFileSync(path.join(out, "index.md"), lines.join("\n"));
}

main();
