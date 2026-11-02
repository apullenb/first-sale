import { expect, test } from "@playwright/test";
import { candles } from "./scenarios";
import { newOwner, open } from "./support";

test("orders by option: an order takes stock from the exact option, and cancelling puts it back", async ({ browser }) => {
  const { page } = await newOwner(browser, candles);

  await open(page, "/products");
  const form = page.getByRole("region", { name: "Add a product" });
  await form.getByRole("textbox", { name: "Name" }).fill("Cedar & Smoke candle");
  await form.getByRole("textbox", { name: "Price" }).fill("24");
  await form.getByRole("button", { name: "Add an option" }).click();
  await form.getByRole("textbox", { name: "Option 1 name" }).fill("Size");
  await form.getByRole("textbox", { name: "Option 1 choices, separated by commas" }).fill("8 oz, 12 oz");
  await form.getByRole("textbox", { name: "Price for 12 oz" }).fill("32");
  await form.getByRole("textbox", { name: "Stock for 8 oz" }).fill("25");
  await form.getByRole("textbox", { name: "Stock for 12 oz" }).fill("10");
  await form.getByRole("button", { name: "Add product" }).click();
  const options = page.getByRole("list", { name: "Options for Cedar & Smoke candle" });
  await expect(options).toContainText("12 oz · $32 · 10 in stock", { timeout: 30_000 });

  await open(page, "/orders");
  const entry = page.getByRole("region", { name: "Enter an order" });
  await entry.getByRole("textbox", { name: "Customer name" }).fill("Sam Rivera");
  await entry.getByRole("combobox", { name: "Item" }).selectOption({ label: "Cedar & Smoke candle" });
  await entry.getByRole("combobox", { name: "Option" }).selectOption({ label: "12 oz · $32 · 10 in stock" });
  await entry.getByRole("textbox", { name: "How many" }).fill("3");
  await entry.getByRole("button", { name: "Add to order" }).click();
  await expect(entry.getByRole("list", { name: "In this order" })).toContainText("3 × Cedar & Smoke candle (12 oz)");
  await entry.getByRole("button", { name: "Save order" }).click();
  const saved = page.getByRole("region", { name: "Your orders" }).getByRole("listitem", { name: "Order for Sam Rivera" });
  await expect(saved).toContainText("3 × Cedar & Smoke candle (12 oz) · $32 each · $96", { timeout: 30_000 });
  await expect(saved).toContainText("Total $96");
  await expect(saved).toContainText("3 taken from stock");

  // Only the 12 oz count drops
  await open(page, "/products");
  await expect(options).toContainText("12 oz · $32 · 7 in stock");
  await expect(options).toContainText("8 oz · 25 in stock");
  await expect(page.getByRole("article", { name: "Cedar & Smoke candle" })).toContainText("32 in stock");

  // More than that option has is refused, and nothing changes
  await open(page, "/orders");
  await entry.getByRole("textbox", { name: "Customer name" }).fill("Lee");
  await entry.getByRole("combobox", { name: "Option" }).selectOption({ label: "12 oz · $32 · 7 in stock" });
  await entry.getByRole("textbox", { name: "How many" }).fill("8");
  await entry.getByRole("button", { name: "Add to order" }).click();
  await entry.getByRole("button", { name: "Save order" }).click();
  await expect(page.getByText("Only 7 Cedar & Smoke candle (12 oz) in stock, and the order asks for 8.")).toBeVisible();

  await saved.getByRole("button", { name: "Cancel order for Sam Rivera" }).click();
  await expect(saved).toContainText("Cancelled");
  await expect(saved).toContainText("3 put back in stock");
  await open(page, "/products");
  await expect(options).toContainText("12 oz · $32 · 10 in stock");
});
