import { expect, test } from "@playwright/test";
import { candles, groomer, tacos } from "./scenarios";
import { newOwner, open, openFold, sidebar } from "./support";

const PACKAGES = ["First Sale site", "Square", "Wix", "Shopify"];
const FIVE_THINGS = ["Web address", "Hosting", "Website builder", "Online store and checkout", "Business email"];

test.describe("create your website", () => {
  test("tacos: compare packages, demo payment screen, draft the words, design, preview and finish", async ({ browser }) => {
    const { page } = await newOwner(browser, tacos);
    await open(page, "/website");

    // The five things to be online, explained first
    const start = await openFold(page, "New to websites? Start here");
    for (const thing of FIVE_THINGS) await expect(start.getByText(thing, { exact: false }).first()).toBeVisible();

    // Every package marks the same five things and shows a cost summary worked out in code
    const choose = page.getByRole("region", { name: "Step 1: Choose a package" });
    await expect(choose).toContainText("We recommend");
    for (const name of PACKAGES) {
      const card = choose.getByRole("article", { name });
      await expect(card).toBeVisible();
      for (const thing of FIVE_THINGS) {
        await expect(card.getByRole("listitem").filter({ hasText: new RegExp(`^${thing}\\s*(Included|Extra cost|Not included)`) })).toHaveCount(1);
      }
      const costs = card.getByRole("region", { name: `${name} cost summary` });
      await expect(costs).toContainText("Total");
      await expect(costs).toContainText("Not in the total:");
      await expect(card.getByRole("button", { name: `Choose ${name}` })).toBeVisible();
    }
    const firstSale = choose.getByRole("article", { name: "First Sale site" });
    // One package is recommended from the answers, with reasons
    const recommended = choose.getByRole("article").filter({ hasText: "Recommended for you" });
    await expect(recommended).toHaveCount(1);
    await expect(firstSale.getByRole("region", { name: "First Sale site cost summary" }).getByText("Demo price")).toBeVisible();
    const why = await openFold(recommended, "Explain why");
    await expect(why.getByRole("listitem").first()).toBeVisible();
    const gets = await openFold(firstSale, /^What you get/);
    await expect(gets.getByRole("listitem").first()).toBeVisible();

    // The demo payment screen never asks for card details
    await firstSale.getByRole("button", { name: "Choose First Sale site" }).click();
    const dialog = page.getByRole("dialog", { name: "Start your First Sale site" });
    await expect(dialog.getByText("For demo purposes only. No payment is taken.")).toBeVisible();
    await expect(dialog.getByText("(demo price)")).toBeVisible();
    await expect(dialog.locator("input, select, textarea, iframe")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close" }).first().click();
    await expect(dialog).toBeHidden();
    await firstSale.getByRole("button", { name: "Choose First Sale site" }).click();
    await dialog.getByRole("button", { name: "Continue (demo)" }).click();
    await expect(choose.getByText("Your choice", { exact: true }).first()).toBeVisible();
    await expect(choose).toContainText("(demo price)");

    // Step 2: web address ideas from the name
    const address = page.getByRole("region", { name: "Step 2: Pick a web address" });
    await expect(address.getByRole("list", { name: "Web address ideas" }).getByText("sonoransoltacos.com", { exact: true })).toBeVisible();
    await expect(address.getByRole("button", { name: "Check" }).first()).toBeDisabled();

    // Step 3: practice words, with [bracketed] notes to fill in
    const words = page.getByRole("region", { name: "Step 3: Write your pages" });
    await words.getByRole("button", { name: "Draft my website" }).click();
    await expect(words.getByText("These words were drafted in practice mode.", { exact: false })).toBeVisible({ timeout: 60_000 });
    await expect(words.getByText(/\d+ \[bracketed\] notes left to fill in/)).toBeVisible();
    await expect(words.getByRole("textbox", { name: "Headline", exact: true })).toHaveValue(tacos.businessName);

    const finish = page.getByRole("region", { name: "Step 5: Finish your site" });
    await expect(finish.getByRole("button", { name: "Finish my site (demo)" })).toBeDisabled();
    await expect(finish).toContainText("Approve your words in step 3.");

    for (const box of await words.getByRole("textbox").all()) {
      const value = await box.inputValue();
      if (value.includes("[")) await box.fill(value.replace(/\[[^\]]*\]/g, "Fresh street tacos and aguas frescas, made to order").trim());
    }
    await words.getByRole("textbox", { name: "Item 1 name" }).fill("Carne asada taco");
    await words.getByRole("button", { name: "Remove item 2" }).click();
    await words.getByRole("button", { name: "Add a question" }).click();
    await words.getByRole("textbox", { name: "Question 3" }).fill("Do you cater events?");
    await words.getByRole("textbox", { name: "Answer 3" }).fill("Yes, message us with your date and headcount.");
    await expect(words.getByText("No [bracketed] notes left.")).toBeVisible();
    await words.getByRole("button", { name: "Save changes" }).click();
    await words.getByRole("button", { name: "Approve these words" }).click();
    await expect(finish).not.toContainText("Approve your words in step 3.", { timeout: 30_000 });
    await expect(page.getByText("This site uses words drafted in practice mode.", { exact: false })).toBeVisible();

    // Step 4: design choices update the live preview
    const design = page.getByRole("region", { name: "Step 4: Design it and see it live" });
    const yours = design.getByRole("region", { name: "Your design" });
    await yours.getByRole("group", { name: "Look" }).getByRole("button", { name: /^Bold/ }).click();
    await expect(yours.getByRole("group", { name: "Look" }).getByRole("button", { name: /^Bold/ })).toHaveAttribute("aria-pressed", "true");
    await yours.getByRole("textbox", { name: /Or pick any color/ }).fill("#c2410c");
    await yours.getByText("Questions", { exact: true }).click();
    const items = yours.getByRole("group", { name: "Your items" });
    await items.getByRole("textbox", { name: "Price", exact: true }).first().fill("4.50");
    await items.getByRole("textbox", { name: "Buy link (optional)" }).first().fill("https://buy.stripe.com/test_tacos");
    await yours.getByRole("button", { name: "Save design" }).click();
    await expect(yours.getByRole("button", { name: "Save design" })).toBeDisabled({ timeout: 30_000 });

    const preview = design.getByRole("region", { name: "Live preview" });
    const site = preview.frameLocator("iframe");
    await expect(site.getByText(tacos.businessName).first()).toBeVisible();
    await expect(site.getByText("Carne asada taco").first()).toBeVisible();
    await expect(site.getByText("$4.50").first()).toBeVisible();
    await expect(site.getByText("Do you cater events?")).toHaveCount(0);
    await expect(site.locator("script")).toHaveCount(0);
    await preview.getByRole("button", { name: "Phone" }).click();
    await expect(preview.getByRole("button", { name: "Phone" })).toHaveAttribute("aria-pressed", "true");

    // Step 5: finishing is a labeled demo that publishes nothing
    await expect(finish).toContainText("This is a demo: nothing is published online.");
    await finish.getByRole("button", { name: "Finish my site (demo)" }).click();
    const ready = page.getByRole("region", { name: "Your website is ready" });
    await expect(ready).toBeVisible({ timeout: 30_000 });
    await expect(ready).toContainText("First Sale site");
    await expect(page.getByText("This is a demo: nothing is published online.").first()).toBeVisible();
    await openFold(page, "Revisit your website");
    await expect(sidebar(page).getByRole("link", { name: /^Create your website , done/ })).toBeVisible({ timeout: 30_000 });
  });

  test("groomer: connect the website they already have, disconnect, then say they don’t want to connect it", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    await open(page, "/website");
    await page.getByRole("button", { name: "I already have a website" }).click();
    const form = page.getByRole("region", { name: "Connect the website you already have" });
    await expect(form.getByText("You’ll never be asked for a password here.", { exact: false })).toBeVisible();
    await expect(form.locator("input[type=password]")).toHaveCount(0);

    // Both a platform and an address are needed to connect
    await form.getByRole("button", { name: "Connect my site (demo)" }).click();
    await expect(form.getByRole("alert")).toContainText("Pick where your site is built.");
    await form.getByRole("button", { name: "Square" }).click();
    await form.getByRole("button", { name: "Connect Square (demo)" }).click();
    await expect(form.getByRole("alert")).toContainText("Type your site’s address");
    await form.getByRole("textbox", { name: "Your site’s address" }).fill("sudsypaws.example");
    await form.getByRole("button", { name: "Connect Square (demo)" }).click();

    await expect(page.getByText("Connected (demo)")).toBeVisible();
    await expect(page.getByRole("link", { name: /sudsypaws\.example/ })).toBeVisible();
    await expect(page.getByText("In the demo, nothing is sent to it.", { exact: false })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /^Create your website , done/ })).toBeVisible();

    await page.getByRole("button", { name: "Disconnect" }).click();
    await page.getByRole("button", { name: "I already have a website" }).click();
    await form.getByRole("button", { name: "I don’t want to connect it" }).click();
    await expect(page.getByText("You already have a website.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect it" })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "I already have a website" })).toBeVisible();
  });

  test("candles: choosing Shopify gives do-it-yourself steps with words to paste", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await open(page, "/website");
    const choose = page.getByRole("region", { name: "Step 1: Choose a package" });
    const shopify = choose.getByRole("article", { name: "Shopify" });
    await expect(shopify.getByRole("region", { name: "Shopify cost summary" })).toContainText("$29");

    // “Explain more” is labeled practice, and its first-year cost comes from code
    const know = await openFold(shopify, /^Things to know/);
    await know.getByRole("button", { name: "Explain Shopify more" }).click();
    await expect(know.getByText("Practice mode: no AI explanation")).toBeVisible({ timeout: 60_000 });
    await know.getByRole("button", { name: "Hide the explanation" }).click();

    // Searching for other builders needs real AI, and says so
    const more = await openFold(choose, "Want to see other options?");
    await more.getByRole("button", { name: "Find more options" }).click();
    await expect(more.getByRole("alert")).toContainText("needs the AI service, which isn’t connected yet.", { timeout: 60_000 });
    await shopify.getByRole("button", { name: "Choose Shopify" }).click();
    await expect(page.getByRole("button", { name: "Saving…" })).toHaveCount(0, { timeout: 30_000 });
    await expect(choose.getByText("Your choice", { exact: true }).first()).toBeVisible();
    await expect(choose).toContainText("Shopify");
    // No demo payment screen for an outside builder
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const build = page.getByRole("region", { name: "Step 4: Build it on Shopify" });
    await expect(build.getByRole("link", { name: /^Open Shopify/ }).first()).toHaveAttribute("href", /shopify\.com/);
    await expect(build.getByRole("checkbox", { name: "1. Start your Shopify store" })).toBeVisible();
    await expect(build.getByRole("checkbox", { name: "10. Turn on sales tax for your state" })).toBeVisible();
    // Words are ready to copy; ticking a step is the owner's own record
    await expect(build.getByRole("button", { name: "Copy Business name" })).toBeVisible();
    await build.getByText("1. Start your Shopify store").click();
    await expect(build.getByRole("checkbox", { name: "1. Start your Shopify store" })).toBeChecked();
    await openFold(choose, "Compare the packages again");
    await expect(choose.getByRole("article", { name: "Wix" })).toBeVisible();
  });
});
