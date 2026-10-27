import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SOURCE_PACKS } from "@/data/source-packs";
import { governmentFor } from "@/lib/research/official-sites";
import { isAllowedHost } from "@/lib/research/source-pack";
import { pageWithExcerpt } from "@/lib/research/verify";
import { FACT_SOURCES, FACTS, type FactSourceId } from "./facts";

// Page text as the app's own reader extracted it on CHECKED_ON
const pageText = (id: FactSourceId) => readFileSync(new URL(`./fixtures/${id}.txt`, import.meta.url), "utf8");

describe("structure facts", () => {
  it("quote each official page word for word", () => {
    for (const [id, fact] of Object.entries(FACTS)) {
      const found = pageWithExcerpt([{ number: 1, text: pageText(fact.source) }], fact.quote);
      expect(found, id).toBe(1);
    }
  });

  it("come only from federal .gov sites the research engine may read", () => {
    const federal = SOURCE_PACKS.find((pack) => pack.jurisdiction.level === "federal")!;
    for (const source of Object.values(FACT_SOURCES)) {
      expect(governmentFor(source.url)?.level, source.url).toBe("federal");
      expect(isAllowedHost(source.url, federal.allowedHosts), source.url).toBe(true);
    }
  });
});
