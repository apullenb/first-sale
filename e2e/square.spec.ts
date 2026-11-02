import { expect, test } from "@playwright/test";
import { candles } from "./scenarios";
import { newOwner, open } from "./support";

test("Square description entry point and safe unconfigured connection", async ({ browser }) => {
  const { page } = await newOwner(browser, candles);
  await open(page, "/products");
  await expect(page.getByRole("button", { name: "Get products from Square" })).toBeDisabled();
  const form = page.getByRole("region", { name: "Add a product" });
  await form.getByRole("textbox", { name: "Name", exact: true }).fill("Library candle");
  await form.getByRole("textbox", { name: "Short description (optional)" }).fill("Handmade soy candle");
  await form.getByRole("textbox", { name: "Price", exact: true }).fill("12");
  await form.getByRole("button", { name: "Add product", exact: true }).click();
  const row = page.getByRole("article", { name: "Library candle", exact: true });
  await expect(row.getByText("Only in your product library — not published to Square")).toBeVisible();
  await expect(row.getByRole("button", { name: "Publish to Square", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Connect Square", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your Square descriptions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Square", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Connect Square", exact: true }).click();
  await expect(page.getByRole("status", { name: "Square connection status" })).toContainText("Square connection is not configured yet");
  await expect(page.getByRole("button", { name: "Approve and update Square" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Connect Square", exact: true })).toBeVisible();
  await page.context().close();
});
