import { describe, expect, it } from "vitest";
import { detectConfirmation } from "./confirmation";

const at = new Date("2026-11-03T12:00:00Z");

describe("forwarding confirmations", () => {
  it("finds Gmail's code and link", () => {
    const found = detectConfirmation({
      from: "forwarding-noreply@google.com",
      subject: "(#123456789) Gmail Forwarding Confirmation - Receive Mail from pat@gmail.com",
      text: `pat@gmail.com has requested to automatically forward mail to your email address.
Confirmation code: 123456789

To allow pat@gmail.com to automatically forward mail to your address, please click the link below to confirm the request:

https://mail-settings.google.com/mail/vf-%5BANGjdJ8%5D-abc&amp;x=1

If you click the link and it appears to be broken, please copy and paste it into a new browser window.`,
      receivedAt: at,
    });
    expect(found).toEqual({
      provider: "Gmail",
      code: "123456789",
      link: "https://mail-settings.google.com/mail/vf-%5BANGjdJ8%5D-abc&x=1",
      receivedAt: at.toISOString(),
    });
  });

  it("finds Yahoo's verification link", () => {
    const found = detectConfirmation({
      from: "no-reply@cc.yahoo-inc.com",
      subject: "Verify your forwarding address",
      text: "Click to verify: https://login.yahoo.com/account/verify?x=1 or ignore https://evil.example/verify",
      receivedAt: at,
    });
    expect(found).toMatchObject({ provider: "Yahoo", code: null, link: "https://login.yahoo.com/account/verify?x=1" });
  });

  it("ignores look-alikes and links off the provider's site", () => {
    expect(
      detectConfirmation({ from: "forwarding-noreply@google.com.evil.test", subject: "(#1234) Gmail Forwarding Confirmation", text: "", receivedAt: at }),
    ).toBeNull();
    expect(
      detectConfirmation({ from: "sam@example.com", subject: "(#123456789) Gmail Forwarding Confirmation", text: "Confirmation code: 123456789", receivedAt: at }),
    ).toBeNull();
    const offSite = detectConfirmation({
      from: "forwarding-noreply@google.com",
      subject: "(#123456789) Gmail Forwarding Confirmation",
      text: "https://mail.google.com.evil.test/x http://mail.google.com/insecure",
      receivedAt: at,
    });
    expect(offSite).toMatchObject({ code: "123456789", link: null });
    // An ordinary email from Google isn't a confirmation
    expect(detectConfirmation({ from: "no-reply@google.com", subject: "Security alert", text: "https://mail.google.com/", receivedAt: at })).toBeNull();
  });
});
