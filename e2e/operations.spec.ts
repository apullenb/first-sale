import { expect, test } from "@playwright/test";
import { candles } from "./scenarios";
import { newOwner, open } from "./support";

test("pasted email appears automatically in tracking, is labeled practice and cannot send", async ({
  browser,
}) => {
  const { page } = await newOwner(browser, candles);
  await open(page, "/email");
  await expect(
    page.getByRole("button", { name: "Get my SnapStart address" }),
  ).toBeVisible();
  const importer = page.getByRole("region", {
    name: "Add a customer message or invoice",
  });
  await importer
    .getByLabel("Or paste a customer email or invoice")
    .fill(
      "Order\nCustomer: Sam\nEmail: sam@example.test\nDescription: Two candles\nDate: 2026-12-01\nTotal: $48.00",
    );
  await importer.getByRole("button", { name: "Read & add for review" }).click();
  const inbox = page.getByRole("region", {
    name: "Customer messages",
    exact: true,
  });
  await expect(inbox).toContainText("Practice mode.", { timeout: 60_000 });
  await expect(inbox).toContainText("this reply uses stand-in details");
  await inbox.getByRole("link", { name: "Open order or job" }).click();
  const detail = page.getByRole("region", { name: "Two candles", exact: true });
  await expect(detail).toContainText("Needs review");
  await expect(
    detail.getByRole("button", { name: "Confirm reviewed order or job" }),
  ).toHaveCount(0);
  await expect(detail).toContainText("cannot change real stock or payments");
  await open(page, "/email");
  await importer
    .getByLabel("Or paste a customer email or invoice")
    .fill(
      "Order\nCustomer: Sam\nEmail: sam@example.test\nDescription: Two candles\nDate: 2026-12-01\nTotal: $48.00",
    );
  await importer.getByRole("button", { name: "Read & add for review" }).click();
  await expect(inbox.getByRole("article")).toHaveCount(1);
});

test("an uploaded invoice keeps its original and adds a review record automatically", async ({
  browser,
}) => {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  const sheet = pdf.addPage();
  const lines = [
    "Invoice",
    "Customer: Jordan",
    "Email: jordan@example.test",
    "Description: Custom candle order",
    "Date: 2026-12-10",
    "Total: $120.00",
    "Invoice: INV-100",
    "Please review this customer invoice before confirming stock, fulfillment and payment details.",
  ];
  lines.forEach((line, index) =>
    sheet.drawText(line, { x: 40, y: 750 - index * 25, font, size: 12 }),
  );
  const { page } = await newOwner(browser, candles);
  await open(page, "/email");
  const importer = page.getByRole("region", {
    name: "Add a customer message or invoice",
  });
  await importer
    .getByLabel("Invoice PDF or image (up to 4 MB)")
    .setInputFiles({
      name: "customer-invoice.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
  await importer.getByRole("button", { name: "Read & add for review" }).click();
  const inbox = page.getByRole("region", {
    name: "Customer messages",
    exact: true,
  });
  await expect(
    inbox.getByRole("link", { name: "Download original invoice" }),
  ).toBeVisible({ timeout: 60_000 });
  await inbox.getByRole("link", { name: "Open order or job" }).click();
  await expect(
    page.getByRole("region", { name: "Custom candle order", exact: true }),
  ).toContainText("Needs review");
});

test("a forwarded email reaches the owner's address, becomes an order and is answered from their own email", async ({
  browser,
}) => {
  const { page } = await newOwner(browser, candles, "forwarding");
  await open(page, "/email");
  await page.getByRole("button", { name: "Get my SnapStart address" }).click();
  const card = page.getByRole("region", { name: "Your SnapStart email address" });
  const address = (await card.getByLabel("Your SnapStart address").textContent())!.trim();
  expect(address).toMatch(/^e2e123\+[a-z2-7]{26}@inbound\.postmarkapp\.com$/);
  await expect(card).toContainText("No new emails waiting");
  await expect(card).toContainText("SnapStart can’t see anything else in your inbox");
  await page.getByRole("tab", { name: "Test it" }).click();
  await expect(page.getByText("Waiting for your first email…")).toBeVisible();

  const token = address.split("+")[1].split("@")[0];
  const sample = {
    From: "Pat Owner <pat@owner.test>",
    FromFull: { Email: "pat@owner.test", Name: "Pat Owner" },
    To: address,
    ToFull: [{ Email: address, Name: "" }],
    Subject: "Fwd: Candle order",
    TextBody: [
      "---------- Forwarded message ---------",
      "From: Sam Lee <sam@example.test>",
      "Date: Mon, Nov 2, 2026 at 9:14 AM",
      "Subject: Candle order",
      "To: <pat@owner.test>",
      "",
      "Order",
      "Customer: Sam",
      "Email: sam@example.test",
      "Description: Three candles",
      "Date: 2026-12-01",
      "Total: $36.00",
    ].join("\n"),
    HtmlBody: "",
    MessageID: `e2e-${token}`,
    Date: "Mon, 2 Nov 2026 10:00:00 -0600",
    MailboxHash: token,
    Headers: [],
    Attachments: [],
  };
  const post = (password: string) =>
    page.request.post("/api/email/inbound", {
      data: sample,
      headers: { authorization: `Basic ${Buffer.from(`e2e-postmark:${password}`).toString("base64")}` },
    });
  expect((await post("wrong")).status()).toBe(401);
  expect((await post("e2e-inbound-password")).status()).toBe(200);
  expect((await post("e2e-inbound-password")).status()).toBe(200);

  await expect(page.getByText("It works! We got your email from pat@owner.test.").first()).toBeVisible({ timeout: 40_000 });
  await open(page, "/email");
  await expect(card).toContainText("1 new email waiting");
  await card.getByRole("button", { name: "Read new emails" }).click();
  await expect(card).toContainText("Read 1 email", { timeout: 60_000 });

  const inbox = page.getByRole("region", { name: "Customer messages", exact: true });
  const message = inbox.getByRole("article").filter({ hasText: "Candle order" });
  await expect(message).toContainText("From Sam Lee (sam@example.test) · forwarded by pat@owner.test");
  await expect(message).toContainText("Practice mode.");
  const reply = message.getByRole("link", { name: "Reply in your email" });
  const href = (await reply.getAttribute("href"))!;
  expect(href).toMatch(/^mailto:sam@example\.test\?subject=Re%3A%20Candle%20order&body=/);
  await message.getByLabel(/Your reply/).fill("Hi Sam,\nThanks for your order!");
  expect(await reply.getAttribute("href")).toContain("body=Hi%20Sam%2C%0D%0AThanks%20for%20your%20order%21");
  await message.getByRole("button", { name: "I sent it" }).click();
  await expect(inbox.getByRole("article").filter({ hasText: "Candle order" })).toContainText("Sent from your email");

  await inbox.getByRole("article").filter({ hasText: "Candle order" }).getByRole("link", { name: "Open order or job" }).click();
  await expect(page.getByRole("region", { name: "Three candles", exact: true })).toContainText("Needs review");
});
