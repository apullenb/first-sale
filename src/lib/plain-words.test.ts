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

  it("leaves a market organizer alone on a vendor permit step", () => {
    const text = "Ask the market organizer for the vendor packet. Bring your health permit.";
    expect(explainTerms(text, new Set(), "Farmers market vendor permit")).toBe(text);
    expect(explainTerms("The event organizer signs off. You form an LLC later.", new Set())).toBe("The event organizer signs off. You form an LLC later.");
  });

  it("explains organizer when the step is about forming an LLC", () => {
    expect(explainTerms("The organizer signs it.", new Set(), "File your certificate of formation")).toContain("creates the LLC");
    expect(explainTerms("You are the organizer of your LLC.", new Set())).toContain("creates the LLC");
    expect(explainTerms("The organizer signs it.", new Set(), "Get a food truck permit")).toBe("The organizer signs it.");
  });

  it("finds terms in a title without changing it", () => {
    const explained = new Set<string>();
    expect(termsIn("Texas Form 205: Certificate of Formation", explained).map((word) => word.term)).toEqual(["certificate of formation"]);
    expect(explainTerms("File the certificate of formation.", explained)).toBe("File the certificate of formation.");
  });
});
