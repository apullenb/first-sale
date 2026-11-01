import { expect, test } from "@playwright/test";
import { candles, groomer } from "./scenarios";
import { choose, expectPracticeBanner, newOwner, open, pngBuffer, sidebar } from "./support";

test.describe("products and product photos", () => {
  test("candles: a product photo in practice mode, then products with costs and stock", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);

    // Product photos: the practice “edit” is the original, unchanged, and labeled so
    await open(page, "/photos");
    await expectPracticeBanner(page);
    await expect(page.getByText("each one is your original photo, unchanged.", { exact: false })).toBeVisible();
    const add = page.getByRole("region", { name: "Add a product photo" });
    await expect(add.getByRole("button", { name: "Upload and check photo" })).toBeDisabled();
    await add.locator("input[type=file]").first().setInputFiles({ name: "cedar-candle.png", mimeType: "image/png", buffer: pngBuffer(600, [230, 220, 200]) });
    await add.getByRole("textbox", { name: "What is it? (optional)" }).fill("Cedar & Smoke candle");
    await add.getByRole("button", { name: "Upload and check photo" }).click();
    await page.waitForURL(/\/photos\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await expectPracticeBanner(page);
    await expect(page.getByText("This photo wasn’t looked at by AI", { exact: false })).toBeVisible();
    const make = page.getByRole("region", { name: "Make a store photo" });
    await choose(make.getByRole("group", { name: "What kind of product is this?" }), "Something handmade");
    await choose(make.getByRole("group", { name: "Choose a look" }), /^White background/);
    await make.getByRole("button", { name: "Make my store photo" }).click();
    const version = page.getByRole("region", { name: "Version 1 · White background · Square" });
    await expect(version.getByText("Development preview.", { exact: false })).toBeVisible({ timeout: 60_000 });
    await expect(version.getByRole("figure", { name: "Your original" })).toBeVisible();
    await version.getByRole("button", { name: "Comparison slider" }).click();
    await expect(version.getByRole("button", { name: "Comparison slider" })).toHaveAttribute("aria-pressed", "true");
    await version.getByText("I compared it with my original photo").click();
    await version.getByRole("button", { name: "Approve and save to my product library" }).click();
    // Wait for the save before leaving the page
    await expect(page.getByText("In your product library · approved", { exact: false })).toBeVisible({ timeout: 30_000 });
    await open(page, "/photos");
    await expect(page.getByRole("region", { name: "Your product library" }).getByRole("img").first()).toBeVisible({ timeout: 30_000 });

    // Products: price, cost and stock; what's left from each sale is worked out by rules
    await open(page, "/products");
    const form = page.getByRole("region", { name: "Add a product" });
    for (const [index, product] of candles.products.entries()) {
      // After the first, the form folds away behind “Add a product”
      if (index > 0) await page.getByRole("button", { name: "Add a product" }).click();
      await form.getByRole("textbox", { name: "Name" }).fill(product.name);
      await form.getByRole("textbox", { name: "Short description (optional)" }).fill(product.description);
      await form.getByRole("textbox", { name: "Price" }).fill(product.price);
      if (product.cost) await form.getByRole("textbox", { name: "What one costs you (optional)" }).fill(product.cost);
      if (product.stock) await form.getByRole("textbox", { name: "How many you have (optional)" }).fill(product.stock);
      await form.getByRole("button", { name: "Add product" }).click();
      await expect(page.getByRole("region", { name: "Your products" }).getByText(product.name).first()).toBeVisible({ timeout: 30_000 });
    }
    const list = page.getByRole("region", { name: "Your products" });
    // $24.00 price, $7.50 cost: $16.50 left from each sale
    const cedar = list.getByRole("article", { name: "Cedar & Smoke candle" });
    await expect(cedar).toContainText("Costs you $7.50, so $16.50 is left from each sale (69%)");
    await expect(cedar).toContainText("40 in stock");
    await expect(sidebar(page).getByRole("link", { name: /^Add your products , done/ })).toBeVisible();

    // The approved photo can go with a product
    await list.getByRole("button", { name: "Edit Wildflower tin" }).click();
    const photo = page.getByRole("group", { name: "Photo (optional)" });
    await expect(photo.getByRole("radio").first()).toBeAttached();
    await expect(photo.getByRole("radio", { name: "No photo" })).toBeChecked();
    // Practice photos are labeled as such wherever they're offered
    await choose(photo, "Cedar & Smoke candle Practice preview");
    await page.getByRole("button", { name: /^Save/ }).first().click();
    const tin = list.getByRole("article", { name: "Wildflower tin" });
    await expect(tin.getByRole("img", { name: "Photo of Wildflower tin" })).toBeVisible({ timeout: 30_000 });
    await expect(tin).toContainText("Its photo is a practice preview.");

    // Remove a product
    page.once("dialog", (dialog) => dialog.accept());
    await list.getByRole("button", { name: "Remove Wildflower tin" }).click();
    await expect(list.getByRole("article", { name: "Wildflower tin" })).toHaveCount(0);
  });

  test("groomer: services without stock, and “My products are already listed somewhere”", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    await open(page, "/products");
    const form = page.getByRole("region", { name: "Add a product" });
    // A price is needed
    await form.getByRole("textbox", { name: "Name" }).fill(groomer.products[0].name);
    await form.getByRole("button", { name: "Add product" }).click();
    await expect(form.getByRole("alert").first()).toBeVisible();
    await form.getByRole("textbox", { name: "Price" }).fill(groomer.products[0].price);
    await form.getByRole("button", { name: "Add product" }).click();
    await expect(page.getByRole("region", { name: "Your products" }).getByText(groomer.products[0].name).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "My products are already listed somewhere" }).click();
    const listed = page.getByRole("region", { name: "My products are already listed somewhere" });
    await listed.getByRole("textbox", { name: "Your shop’s address (optional)" }).fill("https://sudsypaws.example/services");
    await listed.getByRole("button", { name: "Mark as done" }).click();
    await expect(page.getByText("You already have this.")).toBeVisible();
    await expect(page.getByRole("link", { name: "https://sudsypaws.example/services" })).toBeVisible();
  });
});
