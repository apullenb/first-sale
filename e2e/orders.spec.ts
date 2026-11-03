import { expect, test } from "@playwright/test";
import { candles, groomer } from "./scenarios";
import { newOwner, open } from "./support";

test("catalog orders count exact options, record a deposit and restore stock once", async ({
  browser,
}) => {
  const { page } = await newOwner(browser, candles);
  await open(page, "/products");
  const product = page.getByRole("region", { name: "Add a product" });
  await product
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Cedar candle");
  await product.getByRole("textbox", { name: "Price", exact: true }).fill("24");
  await product.getByRole("button", { name: "Add an option" }).click();
  await product.getByRole("textbox", { name: "Option 1 name" }).fill("Size");
  await product
    .getByRole("textbox", { name: "Option 1 choices, separated by commas" })
    .fill("8 oz, 12 oz");
  await product.getByRole("textbox", { name: "Price for 12 oz" }).fill("32");
  await product.getByRole("textbox", { name: "Stock for 8 oz" }).fill("25");
  await product.getByRole("textbox", { name: "Stock for 12 oz" }).fill("10");
  await product.getByRole("button", { name: "Add product" }).click();
  const options = page.getByRole("list", { name: "Options for Cedar candle" });
  await expect(options).toContainText("12 oz · $32 · 10 in stock", {
    timeout: 30_000,
  });
  await open(page, "/orders");
  await page.getByRole("button", { name: "Add order", exact: true }).click();
  const entry = page.getByRole("region", { name: "New order", exact: true });
  await entry.getByLabel("Customer name", { exact: true }).fill("Sam Rivera");
  await entry.getByLabel("Order description").fill("Three candles");
  await entry
    .getByLabel("Item", { exact: true })
    .selectOption({ label: "Cedar candle · $24" });
  await entry
    .getByLabel("Option", { exact: true })
    .selectOption({ label: "12 oz · 10 in stock" });
  await entry.getByLabel("Quantity").fill("3");
  await entry.getByRole("button", { name: "Add item", exact: true }).click();
  await entry.getByRole("button", { name: "Save order or job" }).click();
  const tile = page.getByRole("button").filter({ hasText: "Sam Rivera" });
  await expect(tile).toContainText("$96 owed");
  // Saving the order takes the stock, so cancelling it later has something to give back
  await open(page, "/products");
  await expect(options).toContainText("12 oz · $32 · 7 in stock");
  await open(page, "/orders");
  await tile.click();
  const detail = page.getByRole("region", {
    name: "Three candles",
    exact: true,
  });
  await detail.getByText("Record payment or refund", { exact: true }).click();
  await detail.getByLabel("Amount ($)", { exact: true }).fill("20");
  await detail.getByRole("button", { name: "Save payment record" }).click();
  await expect(tile).toContainText("$20 paid · $76 owed");
  await detail.getByText("Cancel this order", { exact: true }).click();
  await detail.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(detail).toContainText("Cancelled");
  await expect(
    detail.getByRole("button", { name: "Confirm cancellation" }),
  ).toHaveCount(0);
  await open(page, "/products");
  await expect(options).toContainText("12 oz · $32 · 10 in stock");
});

test("service jobs tailor their fields, keep balances after completion and support rescheduling", async ({
  browser,
}) => {
  const { page } = await newOwner(browser, groomer);
  await open(page, "/orders");
  await page.getByRole("button", { name: "Add job", exact: true }).click();
  const entry = page.getByRole("region", { name: "New service job" });
  await entry.getByLabel("Customer name", { exact: true }).fill("Jo");
  await entry.getByLabel("What is the job?").fill("Groom Bailey");
  await entry.getByLabel("Agreed total ($, optional)").fill("80");
  await entry.getByLabel("Job date", { exact: true }).fill("2026-12-05");
  await entry.getByLabel("Job time (local to the business)").fill("10:00");
  await expect(entry.getByLabel("Fulfillment", { exact: true })).toHaveCount(0);
  await entry.getByRole("button", { name: "Save order or job" }).click();
  const tile = page.getByRole("button").filter({ hasText: "Groom Bailey" });
  await expect(tile).toContainText("Scheduled");
  await tile.click();
  const detail = page.getByRole("region", {
    name: "Groom Bailey",
    exact: true,
  });
  await detail.getByText("Record payment or refund", { exact: true }).click();
  await detail.getByLabel("Amount ($)", { exact: true }).fill("25");
  await detail.getByRole("button", { name: "Save payment record" }).click();
  await expect(tile).toContainText("$25 paid · $55 owed");
  await detail.getByRole("button", { name: "Mark completed" }).click();
  await expect(detail).toContainText("Completed");
  await expect(detail).toContainText("$55");
  await page.getByLabel("Show", { exact: true }).selectOption("closed");
  await expect(tile).toBeVisible();
  await page.reload();
  await page.getByLabel("Show", { exact: true }).selectOption("closed");
  await expect(tile).toContainText("$25 paid · $55 owed");
});
