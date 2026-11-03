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
    await expect(version.getByText("Practice preview.", { exact: false })).toBeVisible({ timeout: 60_000 });
    await expect(version.getByRole("figure", { name: "Your original" })).toBeVisible();
    await version.getByRole("button", { name: "Comparison slider" }).click();
    await expect(version.getByRole("button", { name: "Comparison slider" })).toHaveAttribute("aria-pressed", "true");
    await version.getByText("I compared it with my original photo").click();
    await version.getByRole("button", { name: "Approve and save to my product library" }).click();
    // Wait for the save before leaving the page
    await expect(page.getByText("In your product library · approved", { exact: false })).toBeVisible({ timeout: 30_000 });
    await open(page, "/photos");
    await expect(page.getByRole("region", { name: "Your product library" }).getByRole("img").first()).toBeVisible({ timeout: 30_000 });

    // Products: price, cost and stock; what's left from each sale is worked out in code
    await open(page, "/products");
    await expect(page.getByRole("heading", { level: 1, name: "Add your products" })).toBeVisible();
    await expectPracticeBanner(page);
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
    // Once something is confirmed, the step is about managing them
    await expect(page.getByRole("heading", { level: 1, name: "Manage your products" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /^Manage your products , done/ })).toBeVisible();

    // Options: each size with its own price and stock; the range and total come from rules
    await cedar.getByRole("button", { name: "Edit Cedar & Smoke candle" }).click();
    const editor = page.getByRole("region", { name: "Edit Cedar & Smoke candle" });
    await editor.getByRole("button", { name: "Add an option" }).click();
    await editor.getByRole("textbox", { name: "Option 1 name" }).fill("Size");
    await editor.getByRole("textbox", { name: "Option 1 choices, separated by commas" }).fill("8 oz, 12 oz");
    await editor.getByRole("textbox", { name: "Price for 12 oz" }).fill("32");
    await editor.getByRole("textbox", { name: "Stock for 8 oz" }).fill("25");
    await editor.getByRole("textbox", { name: "Stock for 12 oz" }).fill("10");
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(cedar).toContainText("$24–$32", { timeout: 30_000 });
    await expect(cedar).toContainText("Size: 8 oz, 12 oz");
    await expect(cedar).toContainText("35 in stock");
    await expect(cedar.getByRole("list", { name: "Options for Cedar & Smoke candle" })).toContainText("12 oz · $32 · 10 in stock");

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

  test("candles: suggestions from answers, a description from a photo, a picture from a description, and prices nearby", async ({ browser }) => {
    const { page } = await newOwner(browser, candles, "candles-ai");
    await open(page, "/products");
    await expectPracticeBanner(page);

    // Suggested from intake: names only, a labeled practice draft, no price
    const suggest = page.getByRole("region", { name: "Start from your answers" });
    await expect(suggest.getByRole("list", { name: "Suggested from your answers" })).toContainText("Hand-poured soy candles");
    await suggest.getByRole("button", { name: "Add these suggestions" }).click();
    const list = page.getByRole("region", { name: "Your products" });
    const suggested = list.getByRole("article", { name: "Hand-poured soy candles" });
    await expect(suggested).toContainText("Suggested", { timeout: 30_000 });
    await expect(suggested).toContainText("Practice draft, not written by AI");
    await expect(suggested).toContainText("No price yet");
    // Not confirmed yet, so the step isn't about managing yet
    await expect(page.getByRole("heading", { level: 1, name: "Add your products" })).toBeVisible();

    // Confirming needs a price
    await suggested.getByRole("button", { name: "Review and confirm Hand-poured soy candles" }).click();
    const review = page.getByRole("region", { name: "Review Hand-poured soy candles" });
    await review.getByRole("textbox", { name: "Short description (optional)" }).fill("Soy candles poured by hand in small batches");
    await review.getByRole("button", { name: "Confirm" }).click();
    await expect(review.getByRole("alert")).toBeVisible();
    await review.getByRole("textbox", { name: "Price" }).fill("22");
    await review.getByRole("button", { name: "Confirm" }).click();
    const confirmed = list.getByRole("article", { name: "Hand-poured soy candles" });
    await expect(confirmed).toContainText("$22", { timeout: 30_000 });
    await expect(confirmed).not.toContainText("Suggested");
    await expect(confirmed).not.toContainText("Practice draft");
    await expect(page.getByRole("heading", { level: 1, name: "Manage your products" })).toBeVisible();

    // Pictures: a main photo first, approved by the owner, then three views made from it; all labeled practice previews
    await confirmed.getByRole("button", { name: "Pictures of Hand-poured soy candles" }).click();
    const pictures = confirmed.getByRole("region", { name: "Pictures of Hand-poured soy candles" });
    await pictures.getByRole("button", { name: "Make a main photo from the description" }).click();
    const newest = pictures.getByRole("figure", { name: "Newest main photo of Hand-poured soy candles" });
    await expect(newest).toContainText("Practice preview, not made by AI", { timeout: 60_000 });
    await expect(pictures.getByRole("button", { name: "Make 3 more views" })).toHaveCount(0);
    await pictures.getByRole("textbox", { name: "Ask for a change to the newest main photo" }).fill("Warmer light");
    await pictures.getByRole("button", { name: "Make this change (Main photo)" }).click();
    await expect(pictures.getByRole("figure", { name: "Newest main photo of Hand-poured soy candles" })).toContainText("Change: Warmer light", { timeout: 60_000 });
    const latest = pictures.getByRole("figure", { name: "Newest main photo of Hand-poured soy candles" });
    await latest.getByRole("button", { name: "Use as main photo" }).click();
    await expect(latest.getByRole("alert")).toBeVisible();
    await latest.getByText("I understand this is only a practice preview").click();
    await latest.getByRole("button", { name: "Use as main photo" }).click();
    await expect(confirmed.getByRole("img", { name: "Photo of Hand-poured soy candles", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(confirmed).toContainText("Its photo is a practice preview.");

    await pictures.getByRole("button", { name: "Make 3 more views" }).click();
    for (const view of ["another angle", "close-up", "in use"]) {
      await expect(pictures.getByRole("figure", { name: `Newest ${view} of Hand-poured soy candles` })).toContainText("Practice preview, not made by AI", { timeout: 60_000 });
    }
    const angle = pictures.getByRole("figure", { name: "Newest another angle of Hand-poured soy candles" });
    await angle.getByText("I understand this is only a practice preview").click();
    await angle.getByRole("button", { name: "Approve" }).click();
    await expect(angle).toContainText("Approved, in the gallery", { timeout: 30_000 });
    await pictures.getByRole("button", { name: "Make a new one (Close-up)" }).click();
    await expect(pictures.getByRole("figure", { name: "Earlier close-up of Hand-poured soy candles" })).toBeVisible({ timeout: 60_000 });
    await pictures.getByRole("figure", { name: "Earlier close-up of Hand-poured soy candles" }).getByRole("button", { name: "Remove this close-up" }).click();
    await expect(pictures.getByRole("figure", { name: "Earlier close-up of Hand-poured soy candles" })).toHaveCount(0, { timeout: 30_000 });

    // A new item from a photo: a suggested name and description, the photo kept with it
    const fromPhoto = page.getByRole("region", { name: "Start from a photo" });
    await fromPhoto.locator("input[type=file]").first().setInputFiles({ name: "pillar.png", mimeType: "image/png", buffer: pngBuffer(600, [240, 210, 160]) });
    await fromPhoto.getByRole("textbox", { name: "What is it? (optional)" }).fill("Beeswax pillar");
    await fromPhoto.getByRole("button", { name: "Draft a name and description" }).click();
    const pillar = list.getByRole("article", { name: "Beeswax pillar" });
    await expect(pillar).toContainText("Suggested", { timeout: 60_000 });
    await expect(pillar).toContainText("Practice draft, not written by AI");
    await expect(pillar.getByRole("img", { name: "Photo of Beeswax pillar" })).toBeVisible();

    // Prices nearby: practice samples, labeled, with low, typical and high from rules
    const compare = page.getByRole("region", { name: "Compare prices near you" });
    await compare.getByRole("combobox", { name: "What to compare" }).selectOption({ label: "Hand-poured soy candles" });
    await compare.getByRole("button", { name: "Compare prices" }).click();
    const results = compare.getByRole("region", { name: /Prices for Hand-poured soy candles/ });
    await expect(results).toContainText("Practice sample, not a real search. These sellers aren’t real.", { timeout: 60_000 });
    const summary = results.getByRole("definition");
    await expect(summary).toHaveText(["$15", "$25", "$35", "$22"]);
    await expect(results.getByRole("list", { name: "Prices found for Hand-poured soy candles" }).getByRole("listitem")).toHaveCount(4);
    await expect(results.getByRole("link", { name: /See this item/ }).first()).toHaveAttribute("target", "_blank");
    await expect(results).toContainText("Prices change, so check each link.");
    // Kept, so it doesn't run again on the next visit
    await open(page, "/products");
    await expect(page.getByRole("region", { name: /Prices for Hand-poured soy candles/ })).toContainText("Practice sample");
  });

  test("groomer: services with options, suggestions, pictures, prices nearby, and “My services are already listed somewhere”", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    await open(page, "/products");
    // A services business is asked about services, not products
    await expect(page.getByRole("heading", { level: 1, name: "Add your services" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Your products" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Start from your answers" })).toContainText("Mobile dog grooming from a van");
    await expect(sidebar(page).getByRole("link", { name: /^Add your services/ })).toBeVisible();

    const form = page.getByRole("region", { name: "Add a service" });
    const [first] = groomer.products;
    await form.getByRole("textbox", { name: "Name" }).fill(first.name);
    await form.getByRole("textbox", { name: "Short description (optional)" }).fill(first.description);
    await form.getByRole("textbox", { name: "How you price it (optional)" }).fill("From $85 a visit");
    await form.getByRole("textbox", { name: "How long it takes (optional)" }).fill("About 2 hours");
    await form.getByRole("textbox", { name: "Where it happens (optional)" }).fill("In our van at your home");
    await form.getByRole("textbox", { name: "What’s included (optional)" }).fill("Bath, haircut, nails and ears");
    // Services can have options too, with their own prices and no stock
    await form.getByRole("button", { name: "Add an option" }).click();
    await form.getByRole("textbox", { name: "Option 1 name" }).fill("Dog size");
    await form.getByRole("textbox", { name: "Option 1 choices, separated by commas" }).fill("Small, Large");
    await expect(form.getByRole("textbox", { name: "Stock for Small" })).toHaveCount(0);
    await form.getByRole("button", { name: "Add service" }).click();
    const list = page.getByRole("region", { name: "Your services" });
    const groom = list.getByRole("article", { name: first.name });
    await expect(groom).toContainText("From $85 a visit", { timeout: 30_000 });
    await expect(groom).toContainText("Takes About 2 hours");
    await expect(groom).toContainText("Where: In our van at your home");
    await expect(groom).toContainText("Dog size: Small, Large");
    await expect(groom).not.toContainText("in stock");
    await expect(page.getByRole("heading", { level: 1, name: "Manage your services" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /^Manage your services , done/ })).toBeVisible();

    // Prices per option replace the owner's words with a range worked out in code
    await groom.getByRole("button", { name: `Edit ${first.name}` }).click();
    const editor = page.getByRole("region", { name: `Edit ${first.name}` });
    await editor.getByRole("textbox", { name: "Price for Small" }).fill("75");
    await editor.getByRole("textbox", { name: "Price for Large" }).fill("95");
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(groom).toContainText("$75–$95", { timeout: 30_000 });

    // Suggestions from intake are services: drafted, labeled, no price and no stock
    await page.getByRole("region", { name: "Start from your answers" }).getByRole("button", { name: "Add these suggestions" }).click();
    const suggested = list.getByRole("article", { name: "Mobile dog grooming from a van" });
    await expect(suggested).toContainText("Suggested", { timeout: 30_000 });
    await expect(suggested).toContainText("Practice draft, not written by AI");
    await expect(suggested).toContainText("No price yet");
    await expect(suggested).not.toContainText("stock");

    // Pictures for a service: the finished result first, then the work in progress, a detail and the provider with a customer
    await groom.getByRole("button", { name: `Pictures of ${first.name}` }).click();
    const pictures = groom.getByRole("region", { name: `Pictures of ${first.name}` });
    await expect(pictures).toContainText("They show the kind of work you do, not your actual work.");
    await pictures.getByRole("button", { name: "Make a main photo from the description" }).click();
    const main = pictures.getByRole("figure", { name: `Newest main photo of ${first.name}` });
    await expect(main).toContainText("Practice preview, not made by AI", { timeout: 60_000 });
    await main.getByText("I understand this is only a practice preview").click();
    await main.getByRole("button", { name: "Use as main photo" }).click();
    await expect(main).toContainText("In use as its main photo", { timeout: 30_000 });
    // Nobody is asked who wears a service
    await expect(pictures.getByRole("group", { name: "Who wears it?" })).toHaveCount(0);
    await pictures.getByRole("button", { name: "Make 3 more views" }).click();
    for (const view of ["in progress", "detail of the result", "at work with a customer"]) {
      await expect(pictures.getByRole("figure", { name: `Newest ${view} of ${first.name}` })).toContainText("Practice preview, not made by AI", { timeout: 60_000 });
    }
    await expect(pictures.getByRole("figure", { name: /another angle/ })).toHaveCount(0);

    // Prices nearby for a service: as the source states them, compared per visit
    const compare = page.getByRole("region", { name: "Compare prices near you" });
    await expect(compare).toContainText("See what similar services cost in your area");
    await compare.getByRole("combobox", { name: "What to compare" }).selectOption({ label: first.name });
    await compare.getByRole("button", { name: "Compare prices" }).click();
    const results = compare.getByRole("region", { name: new RegExp(`Prices for ${first.name}`) });
    await expect(results).toContainText("Practice sample, not a real search.", { timeout: 60_000 });
    await expect(results).toContainText("Columbus, Ohio");
    await expect(results.getByRole("term")).toHaveText(["Low per visit", "Typical per visit", "High per visit", "Your price"]);
    await expect(results.getByRole("definition").last()).toHaveText("$75–$95");
    await expect(results.getByRole("listitem").first()).toContainText("$15 per visit");
    await expect(results.getByRole("link", { name: /See this service/ }).first()).toBeVisible();

    // A photo of the owner's work becomes a suggested service
    const fromPhoto = page.getByRole("region", { name: "Start from a photo" });
    await expect(fromPhoto).toContainText("Upload a photo of your work");
    await fromPhoto.locator("input[type=file]").first().setInputFiles({ name: "groomed.png", mimeType: "image/png", buffer: pngBuffer(600, [200, 180, 150]) });
    await fromPhoto.getByRole("textbox", { name: "What is it? (optional)" }).fill("Puppy trim");
    await fromPhoto.getByRole("button", { name: "Draft a name and description" }).click();
    await expect(list.getByRole("article", { name: "Puppy trim" })).toContainText("Suggested", { timeout: 60_000 });

    await page.getByRole("button", { name: "My services are already listed somewhere" }).click();
    const listed = page.getByRole("region", { name: "My services are already listed somewhere" });
    await listed.getByRole("textbox", { name: "Your shop’s address (optional)" }).fill("https://sudsypaws.example/services");
    await listed.getByRole("button", { name: "Mark as done" }).click();
    await expect(page.getByText("You already have this.")).toBeVisible();
    await expect(page.getByRole("link", { name: "https://sudsypaws.example/services" })).toBeVisible();
  });
});
