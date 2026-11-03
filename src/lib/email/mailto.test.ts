import { describe, expect, it } from "vitest";
import { MAX_MAILTO_LENGTH, replyLink, replySubject } from "./mailto";

describe("reply links", () => {
  it("opens a reply with the subject and text", () => {
    const link = replyLink("sam.lee+orders@example.com", "Fwd: Order for Friday", "Hi Sam,\nYes & thanks!");
    expect(link?.full).toBe(
      "mailto:sam.lee%2Borders@example.com?subject=Re%3A%20Order%20for%20Friday&body=Hi%20Sam%2C%0D%0AYes%20%26%20thanks%21",
    );
    expect(link?.short).toBe("mailto:sam.lee%2Borders@example.com?subject=Re%3A%20Order%20for%20Friday");
  });

  it("copies a long reply instead", () => {
    const link = replyLink("sam@example.com", "Order", "x ".repeat(MAX_MAILTO_LENGTH));
    expect(link?.full).toBeNull();
    expect(link?.short).toContain("subject=Re%3A%20Order");
  });

  it("refuses addresses that could add recipients or headers", () => {
    for (const bad of ["sam@example.com,eve@evil.test", "sam@example.com?cc=eve@evil.test", "sam@example.com\nBcc: eve@evil.test", "", "not an email"])
      expect(replyLink(bad, "Order", "Hi")).toBeNull();
  });

  it("keeps one Re: and drops line breaks from the subject", () => {
    expect(replySubject("RE: Re: FW: Cake\nBcc: x")).toBe("Re: Cake Bcc: x");
    expect(replySubject("")).toBe("Re: Your message");
  });
});
