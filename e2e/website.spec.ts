import { expect, test } from "@playwright/test";
import { groomer, tacos } from "./scenarios";
import { newOwner, open, sidebar } from "./support";

const PACKAGES = ["SnapStart site", "Square", "Wix", "Shopify"];

test.describe("create your website", () => {
  test("choose a site, write your words, explore three templates and preview full-screen", async ({ browser }, testInfo) => {
    const owner = await newOwner(browser, tacos);
    const context = process.env.WEBSITE_RECORDING === "1" ? await browser.newContext({ storageState: await owner.page.context().storageState(), viewport: { width: 1440, height: 1000 }, recordVideo: { dir: testInfo.outputPath("video"), size: { width: 1440, height: 1000 } } }) : owner.page.context();
    const page = context === owner.page.context() ? owner.page : await context.newPage();
    if (page !== owner.page) await owner.page.context().close();
    await open(page, "/website");
    const choose = page.getByRole("region", { name: "Step 1: Choose a package" });
    for (const name of PACKAGES) await expect(choose.getByRole("article", { name, exact: true })).toBeVisible();
    for (const name of ["Wix", "Shopify"]) {
      const card = choose.getByRole("article", { name, exact: true });
      await expect(card).toContainText("Coming Soon");
      await expect(card.getByRole("button")).toHaveCount(0);
      await expect(card.getByRole("list")).toHaveCount(0);
    }
    await expect(choose.getByRole("article", { name: "Square", exact: true })).toContainText("Set up your site on Square first");
    const first = choose.getByRole("article", { name: "SnapStart site", exact: true });
    await expect(first).not.toContainText(/demo/i);
    await first.getByRole("button", { name: "Choose SnapStart site", exact: true }).click();
    const words = page.getByRole("region", { name: "Step 3: Write your pages" });
    await words.getByRole("button", { name: "Write my own words", exact: true }).click();
    await words.getByRole("textbox", { name: "Headline", exact: true }).fill("Fresh tacos. Good company.");
    await words.getByRole("textbox", { name: "Line under the headline", exact: true }).fill("Street tacos and aguas frescas.");
    await words.getByRole("textbox", { name: "Your story", exact: true }).fill("We share our favorite recipes with our neighbors.");
    await words.getByRole("textbox", { name: "How to reach you", exact: true }).fill("Message us to plan your order.");
    await words.getByRole("button", { name: "Add an item", exact: true }).click();
    await words.getByRole("textbox", { name: "Item 1 name", exact: true }).fill("Carne asada taco");
    await words.getByRole("textbox", { name: "Item 1 description", exact: true }).fill("A taco made to order.");
    await words.getByRole("button", { name: "Save changes", exact: true }).click();
    await words.getByRole("button", { name: "Approve these words", exact: true }).click();
    const design = page.getByRole("region", { name: "Step 4: Design it and see it live" });
    for (const template of ["Studio", "Statement", "Atelier"]) {
      await design.getByRole("group", { name: "Look", exact: true }).getByRole("button", { name: new RegExp(`^${template}`) }).click();
      await design.getByRole("button", { name: "View full-screen preview" }).click();
      const dialog = page.getByRole("dialog", { name: `Full-screen preview of ${tacos.businessName}`, exact: true });
      await expect(dialog).toBeVisible();
      const frame = dialog.frameLocator("iframe");
      await expect(frame.getByRole("heading", { name: "Fresh tacos. Good company.", exact: true })).toBeVisible();
      await expect(frame.getByRole("heading", { name: "Carne asada taco", exact: true })).toBeVisible();
      await expect(frame.locator("script")).toHaveCount(0);
      if (process.env.WEBSITE_RECORDING === "1") await page.waitForTimeout(1800);
      await dialog.getByRole("button", { name: "Close preview" }).click();
      await expect(dialog).toHaveCount(0);
    }
    await design.getByRole("button", { name: "Save design", exact: true }).click();
    await expect(design.getByRole("button", { name: "Save design", exact: true })).toBeDisabled();
    await page.context().close();
  });

  test("groomer: connect the website they already have, disconnect, then say they don’t want to connect it", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    await open(page, "/website");
    await page.getByRole("button", { name: "I already have a website" }).click();
    const form = page.getByRole("region", { name: "Connect the website you already have" });
    await expect(form).toContainText("Saving your website records its platform and address.");
    await expect(form.locator("input[type=password]")).toHaveCount(0);

    // Both a platform and an address are needed to connect
    await form.getByRole("button", { name: "Save my site website" }).click();
    await expect(form.getByRole("alert")).toContainText("Pick where your site is built.");
    await form.getByRole("button", { name: "Square" }).click();
    await form.getByRole("button", { name: "Save Square website" }).click();
    await expect(form.getByRole("alert")).toContainText("Type your site’s address");
    await form.getByRole("textbox", { name: "Your site’s address" }).fill("sudsypaws.example");
    await form.getByRole("button", { name: "Save Square website" }).click();

    await expect(page.getByText("Website saved")).toBeVisible();
    await expect(page.getByRole("link", { name: /sudsypaws\.example/ })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /^Create your website , done/ })).toBeVisible();

    await page.getByRole("button", { name: "Disconnect" }).click();
    await page.getByRole("button", { name: "I already have a website" }).click();
    await form.getByRole("button", { name: "I don’t want to connect it" }).click();
    await expect(page.getByText("You already have a website.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect it" })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "I already have a website" })).toBeVisible();
  });

});
