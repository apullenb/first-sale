import { describe, expect, it } from "vitest";
import { parseIncoming, parseLooseDate, parsePerson, threadKey } from "./forwarded";

const owner = { name: "Pat Owner", email: "pat@owner.test" };
const body = "Hi! Could I order two dozen cupcakes for Friday?\nThanks,\nSam";
const parse = (text: string, subject = "Fwd: Order for Friday") =>
  parseIncoming({ from: owner, subject, date: new Date("2026-11-03T12:00:00Z"), text });

describe("forwarded emails", () => {
  it("reads Gmail's forward block (web and app)", () => {
    const result = parse(`Can you handle this one?

---------- Forwarded message ---------
From: Sam Lee <Sam.Lee@Example.com>
Date: Mon, Nov 2, 2026 at 9:14 AM
Subject: Order for Friday
To: <pat@owner.test>


${body}
`);
    expect(result.from).toEqual({ name: "Sam Lee", email: "sam.lee@example.com" });
    expect(result.forwardedBy).toEqual(owner);
    expect(result.subject).toBe("Order for Friday");
    expect(result.note).toBe("Can you handle this one?");
    expect(result.body).toBe(body);
    expect(result.date?.getFullYear()).toBe(2026);
    expect(result.date?.getMonth()).toBe(10);
  });

  it("reads Outlook's underscore block and the bold classic one", () => {
    const web = parse(`Get Outlook for iOS
________________________________
From: Sam Lee <sam.lee@example.com>
Sent: Monday, November 2, 2026 9:14 AM
To: Pat Owner <pat@owner.test>
Subject: Order for Friday

${body}`, "FW: Order for Friday");
    expect(web.from?.email).toBe("sam.lee@example.com");
    expect(web.subject).toBe("Order for Friday");
    expect(web.body).toBe(body);
    expect(web.date?.getDate()).toBe(2);

    const classic = parse(`-----Original Message-----
*From:* "Lee, Sam" [mailto:sam.lee@example.com]
*Sent:* Monday, November 2, 2026 9:14 AM
*To:* pat@owner.test
*Subject:* Order for Friday

${body}`, "FW: Order for Friday");
    expect(classic.from).toEqual({ name: "Lee, Sam", email: "sam.lee@example.com" });
    expect(classic.subject).toBe("Order for Friday");
  });

  it("reads Apple Mail's block on iPhone and Mac", () => {
    const result = parse(`Sent from my iPhone

Begin forwarded message:

From: Sam Lee <sam.lee@example.com>
Date: November 2, 2026 at 9:14:00 AM CST
To: pat@owner.test
Subject: Order for Friday


${body}`);
    expect(result.from?.email).toBe("sam.lee@example.com");
    expect(result.note).toBe("Sent from my iPhone");
    expect(result.date?.toISOString()).toBe("2026-11-02T15:14:00.000Z");
    expect(result.body).toBe(body);
  });

  it("reads Yahoo's block", () => {
    const result = parse(`

----- Forwarded Message -----
From: Sam Lee <sam.lee@example.com>
To: pat@owner.test <pat@owner.test>
Sent: Monday, November 2, 2026, 09:14:00 AM CST
Subject: Order for Friday

${body}`);
    expect(result.from).toEqual({ name: "Sam Lee", email: "sam.lee@example.com" });
    expect(result.date?.toISOString()).toBe("2026-11-02T15:14:00.000Z");
    expect(result.body).toBe(body);
  });

  it("reads a quoted forward and one with no separator line", () => {
    const quoted = parse(`> ---------- Forwarded message ---------
> From: Sam Lee <sam.lee@example.com>
> Subject: Order for Friday
>
> ${body.replaceAll("\n", "\n> ")}`);
    expect(quoted.from?.email).toBe("sam.lee@example.com");
    expect(quoted.body).toBe(body);

    const bare = parse(`From: Sam Lee <sam.lee@example.com>
Sent: Monday, November 2, 2026 9:14 AM
Subject: Order for Friday

${body}`);
    expect(bare.from?.email).toBe("sam.lee@example.com");
  });

  it("treats an email with no forward block as from its sender", () => {
    const customer = { name: "Sam Lee", email: "sam.lee@example.com" };
    const result = parseIncoming({ from: customer, subject: "Order for Friday", date: null, text: body });
    expect(result).toMatchObject({ from: customer, forwardedBy: null, subject: "Order for Friday", body });
    // A From line in an ordinary email isn't a forward
    expect(parseIncoming({ from: customer, subject: "Hi", date: null, text: "From: me\nhello" }).forwardedBy).toBeNull();
  });
});

describe("helpers", () => {
  it("reads names and addresses", () => {
    expect(parsePerson("sam@example.com")).toEqual({ name: "", email: "sam@example.com" });
    expect(parsePerson("no address here")).toBeNull();
  });
  it("leaves unreadable dates empty", () => {
    expect(parseLooseDate("sometime next week")).toBeNull();
  });
  it("groups a conversation by customer and subject", () => {
    expect(threadKey("Sam@x.test", "RE: Fwd: Order")).toBe(threadKey("sam@x.test", "Order"));
  });
});
