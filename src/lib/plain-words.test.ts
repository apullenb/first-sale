import { describe, expect, it } from "vitest";
import { explainTerms, termsIn } from "./plain-words";

describe("explainTerms", () => {
  it("explains a term once per page, after the sentence it first shows in", () => {
    const explained = new Set<string>();
    expect(explainTerms("Get your registered agent’s consent first. Then file.", explained)).toBe(
      "Get your registered agent’s consent first. A registered agent is the person or company that accepts legal mail for your business. It can be you. Then file.",
    );
    expect(explainTerms("Your registered agent signs it.", explained)).toBe("Your registered agent signs it.");
  });

  it("finds terms in a title without changing it", () => {
    const explained = new Set<string>();
    expect(termsIn("Texas Form 205: Certificate of Formation", explained).map((word) => word.term)).toEqual(["certificate of formation"]);
    expect(explainTerms("File the certificate of formation.", explained)).toBe("File the certificate of formation.");
  });
});
