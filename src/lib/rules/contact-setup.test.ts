import { describe, expect, it } from "vitest";
import { GMAIL_GUIDE, VOICE_GUIDE } from "@/data/contact-setup";
import { detailProblem } from "@/lib/details";
import { contactHaveKey, contactLaterKey, contactStatus, isEmailAddress, isUsPhone } from "./contact-setup";
import { sidebarStatus, startSteps } from "./section-status";

describe("contactStatus", () => {
  it("asks until each item has a choice", () => {
    expect(contactStatus([], [])).toEqual({ asked: false, items: { email: "open", phone: "open" }, step: "none" });
    expect(contactStatus(["business_email"], []).asked).toBe(false);
    expect(contactStatus(["business_email"], [contactLaterKey("phone")]).asked).toBe(true);
  });

  it("puts a step in the plan once something is put off, done when both are in hand", () => {
    const later = contactStatus([], [contactLaterKey("email"), contactLaterKey("phone")]);
    expect(later).toMatchObject({ asked: true, items: { email: "todo", phone: "todo" }, step: "todo" });
    const finished = contactStatus(["business_email"], [contactLaterKey("email"), contactLaterKey("phone"), contactHaveKey("phone")]);
    expect(finished).toMatchObject({ items: { email: "done", phone: "done" }, step: "done" });
  });

  it("needs no step when the owner had both from the start", () => {
    expect(contactStatus(["business_email", "business_phone"], []).step).toBe("none");
  });
});

describe("the email and phone step in the menu", () => {
  it("sits after the fixed steps, and counts as a step left until done", () => {
    expect(startSteps([], true).map((step) => step.href)).toEqual(["/business", "/structure", "/requirements", "/contact", "/start#paperwork"]);
    expect(startSteps([]).map((step) => step.href)).not.toContain("/contact");
    const base = { business: true, research: "none", questionsOpen: 0, structureChosen: false, structureStep: { left: 0, minutes: 0 }, groups: [], libraryToCheck: 0, logoChosen: false, brandDescribed: false, websiteFinished: false, websiteConnected: false, products: 0, marketingApproved: false, socialPlatforms: [], socialHave: [], marks: new Set<string>() } as const;
    expect(sidebarStatus({ ...base, contact: "todo" })["/contact"]).toMatchObject({ state: "todo", count: 1 });
    expect(sidebarStatus({ ...base, contact: "done" })["/contact"]).toMatchObject({ state: "done" });
    expect(sidebarStatus({ ...base, contact: "none" })["/contact"]).toBeUndefined();
  });
});

describe("contact details", () => {
  it.each(["(512) 555-0123", "512-555-0123", "+1 512 555 0123", "5125550123", "512.555.0123 ext 4"])("takes the US phone %s", (phone) => {
    expect(isUsPhone(phone)).toBe(true);
  });

  it.each(["555-0123", "+44 20 7946 0958", "call me", "512-555-01234"])("refuses %s as a US phone", (phone) => {
    expect(isUsPhone(phone)).toBe(false);
  });

  it("checks email addresses and phones when they're saved as details", () => {
    expect(isEmailAddress("hello@maplecrumb.example")).toBe(true);
    expect(detailProblem("business_email", "hello at maplecrumb")).toMatch(/email address like/);
    expect(detailProblem("business_phone", "555-0123")).toMatch(/area code/);
    expect(detailProblem("business_phone", "(940) 555-0101")).toBeNull();
  });
});

describe("Google's sign-up steps", () => {
  it("cite Google's own pages with the date checked, and link to Google to sign up", () => {
    for (const guide of [GMAIL_GUIDE, VOICE_GUIDE]) {
      expect(guide.steps.length).toBeGreaterThan(2);
      for (const source of [guide.stepsSource, ...guide.facts.map((fact) => fact.source)]) {
        expect(new URL(source.url).hostname).toMatch(/(^|\.)google\.com$/);
        expect(source.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(source.handChecked).toBe(true);
      }
      expect(new URL(guide.signUp.url).hostname).toMatch(/(^|\.)google\.com$/);
    }
  });

  it("never says SnapStart makes the account", () => {
    const text = JSON.stringify([GMAIL_GUIDE, VOICE_GUIDE]);
    expect(text).not.toMatch(/SnapStart (?:creates|makes|sets up)/i);
  });
});
