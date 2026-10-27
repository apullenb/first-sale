import { describe, expect, it } from "vitest";
import { isAllowedHost, sourcePackSchema } from "@/lib/research/source-pack";
import federal from "./federal.json";
import { SOURCE_PACKS } from "./index";

describe("source packs", () => {
  it.each(SOURCE_PACKS.map((pack) => [pack.jurisdiction.name, pack] as const))(
    "%s only lists pages on its allowed hosts, with unique ids",
    (_name, pack) => {
      for (const source of pack.sources) {
        expect(isAllowedHost(source.url, pack.allowedHosts), source.url).toBe(true);
      }
      const ids = pack.sources.map((source) => source.id);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  // Requirements cite sources by id across every pack read for a business
  it("uses each source id once across all packs", () => {
    const ids = SOURCE_PACKS.flatMap((pack) => pack.sources.map((source) => source.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(["", "gov", "IRS.gov", "https://irs.gov", "irs.gov/"])("rejects allowed host %j", (host) => {
    expect(sourcePackSchema.safeParse({ ...federal, allowedHosts: [host] }).success).toBe(false);
  });
});
