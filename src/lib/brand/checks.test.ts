import { describe, expect, it } from "vitest";
import type { CompletionRequest, ModelProvider } from "@/lib/ai";
import { checkBrandImage, checkLogo, checkVersion, compareLettering, type Expected, marksFor, onlyMarks } from "./checks";

const name: Expected = { name: "Rise Bakery", tagline: "", marks: "none" };
const file = { mimeType: "image/png", data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) };
const logoFile = { mimeType: "image/png", data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]) };
const now = new Date("2026-10-27T12:00:00Z");

describe("the spelling check", () => {
  it("accepts the exact name whatever the case or line breaks", () => {
    expect(compareLettering(name, ["RISE BAKERY"], true).status).toBe("matches");
    expect(compareLettering(name, ["Rise", "Bakery"], true).status).toBe("matches");
  });

  it("flags a misspelled name, saying what AI read", () => {
    const check = compareLettering(name, ["RISE BAKEY"], true);
    expect(check.status).toBe("misspelled");
    expect(check.problems[0]).toContain("AI read “RISE BAKEY”, but your name is “Rise Bakery”");
  });

  it("flags a doubled or extra letter, not only a missing one", () => {
    expect(compareLettering(name, ["RISE BAKERYY"], true).status).toBe("misspelled");
    expect(compareLettering(name, ["RISSE BAKERY"], true).status).toBe("misspelled");
  });

  it("counts letters in every script, including accents", () => {
    expect(compareLettering({ ...name, name: "東京 Sushi" }, ["SUSHI"], true).status).toBe("misspelled");
    expect(compareLettering({ ...name, name: "Smørrebrød" }, ["SMRREBRD"], true).status).toBe("misspelled");
    expect(compareLettering({ ...name, name: "Peña Tacos" }, ["PENA TACOS"], true).status).toBe("misspelled");
    expect(compareLettering({ ...name, name: "Peña Tacos" }, ["PEÑA TACOS"], true).status).toBe("matches");
  });

  it("warns when words are split or joined differently", () => {
    expect(compareLettering({ ...name, name: "Ann Arbor Pies" }, ["ANNA RBOR PIES"], true).status).toBe("spacing");
    expect(compareLettering(name, ["RISEBAKERY"], true).status).toBe("spacing");
  });

  it("says punctuation isn't checked when the name has some", () => {
    expect(compareLettering({ ...name, name: "Mia’s Café" }, ["MIA’S CAFÉ"], true)).toMatchObject({ status: "matches", note: expect.stringContaining("punctuation") });
    expect(compareLettering(name, ["Rise Bakery"], true).note).toBeNull();
  });

  it("flags words that aren't the name or tagline", () => {
    const check = compareLettering(name, ["RISE BAKERY", "EST. 2024"], true);
    expect(check.status).toBe("extra_words");
    expect(check.problems[0]).toContain("words that aren’t your name");
  });

  it("allows initials only where the kind of logo uses them", () => {
    expect(compareLettering({ ...name, marks: "initials" }, ["RB", "Rise Bakery"], true).status).toBe("matches");
    expect(compareLettering(name, ["RISE BAKERY", "B"], true).status).toBe("extra_words");
    expect(compareLettering({ ...name, marks: "letter" }, ["K", "Rise Bakery"], true).status).toBe("matches");
    expect(marksFor({ kind: "monogram", symbol: "interlocked R and B" }, "logo")).toBe("initials");
    expect(marksFor({ kind: "illustrative", symbol: "a wheat stalk" }, "profile")).toBe("none");
    expect(marksFor({ kind: "wordmark", symbol: null }, "profile")).toBe("initials");
    expect(marksFor({ kind: "wordmark", symbol: null }, "logo")).toBe("none");
  });

  it("checks the tagline too, even when it repeats the name", () => {
    const withTagline = { ...name, tagline: "Baked at dawn" };
    expect(compareLettering(withTagline, ["Rise Bakery", "Baked at dawn"], true).status).toBe("matches");
    expect(compareLettering(withTagline, ["Rise Bakery", "Baked at dusk"], true).status).toBe("misspelled");
    expect(compareLettering({ name: "Rise", tagline: "Rise and shine", marks: "none" }, ["Rise and shine", "RISE"], true).status).toBe("matches");
  });

  it("asks the owner to look when nothing could be read", () => {
    expect(compareLettering(name, [], true).status).toBe("unreadable");
    expect(compareLettering(name, ["Rise Bakery"], false).status).toBe("unreadable");
  });

  it("keeps the profile picture to the symbol, even with a misspelled name", () => {
    expect(onlyMarks(name, []).status).toBe("matches");
    expect(onlyMarks({ ...name, marks: "initials" }, ["RB"]).status).toBe("matches");
    expect(onlyMarks(name, ["RISE BAKERY"]).problems[0]).toContain("Your business name is in it");
    expect(onlyMarks(name, ["RISE BAKRY"]).status).toBe("has_words");
  });
});

function vision(reply: (request: CompletionRequest) => object) {
  const requests: CompletionRequest[] = [];
  const model: ModelProvider = {
    name: "Test vision",
    model: "test-vision",
    capabilities: { vision: true, pdf: false, jsonSchema: true, reasoningEffort: true, webSearch: false },
    simulated: false,
    async complete(request) {
      requests.push(request);
      return { text: JSON.stringify(reply(request)), finishReason: "stop", usage: null };
    },
  };
  return { model, requests };
}

const images = (request: CompletionRequest) =>
  (request.messages[1].content as { type: string; url?: string }[]).filter((part) => part.type === "image").map((part) => part.url);

describe("reading the lettering with AI", () => {
  it("never tells the model the name, so it can't read what it expects", async () => {
    const { model, requests } = vision(() => ({ lettering: ["Rise Bakey"], readable: true, notes: "" }));
    const check = await checkLogo(model, file, name, now);
    expect(check).toMatchObject({ method: "ai", lettering: { status: "misspelled" } });
    expect(JSON.stringify(requests[0].messages)).not.toContain("Rise Bakery");
  });

  it("reads a version's lettering on its own, apart from the logo it's compared with", async () => {
    const { model, requests } = vision((request) =>
      request.responseFormat?.name === "brand_lettering" ? { lettering: ["RISE BAKRY"], readable: true, notes: "" } : { flags: [{ kind: "color", detail: "Two colors" }] },
    );
    const check = await checkVersion(model, logoFile, file, "solid", name, now);
    expect(check.drift).toEqual([{ kind: "color", detail: "Two colors" }]);
    expect(check.lettering?.status).toBe("misspelled");
    const reading = requests.find((request) => request.responseFormat?.name === "brand_lettering")!;
    const comparing = requests.find((request) => request.responseFormat?.name === "brand_version_check")!;
    expect(images(reading)).toHaveLength(1);
    // The chosen logo first, then the version
    expect(images(comparing)).toHaveLength(2);
    expect(images(comparing)[0]).not.toBe(images(comparing)[1]);
  });

  it("flags words in a profile picture", async () => {
    const { model } = vision((request) => (request.responseFormat?.name === "brand_lettering" ? { lettering: ["RISE BAKRY"], readable: true, notes: "" } : { flags: [] }));
    const check = await checkVersion(model, logoFile, file, "profile", name, now);
    expect(check.lettering?.status).toBe("has_words");
  });

  it("expects the name and no other words in every brand image", async () => {
    const hero = await checkBrandImage(vision(() => ({ lettering: ["Rise Bakery", "BREAD"], readable: true, notes: "" })).model, file, "website_hero", name, now);
    expect(hero.lettering?.status).toBe("extra_words");
    const banner = await checkBrandImage(vision(() => ({ lettering: ["Rise Bakery"], readable: true, notes: "" })).model, file, "youtube_banner", name, now);
    expect(banner.lettering?.status).toBe("matches");
  });
});
