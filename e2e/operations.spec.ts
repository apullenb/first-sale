import { expect, test } from "@playwright/test";
import { candles } from "./scenarios";
import { newOwner, open } from "./support";

test("pasted email appears automatically in tracking, is labeled practice and cannot send", async ({
  browser,
}) => {
  const { page } = await newOwner(browser, candles);
  await open(page, "/email");
  await expect(
    page.getByText("Live email needs administrator setup.", { exact: false }),
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
  await expect(
    inbox.getByRole("button", { name: "Send approved reply" }),
  ).toHaveCount(0);
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
