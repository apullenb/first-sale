import { expect, type Page, test } from "@playwright/test";
import { groomer, tacos } from "./scenarios";
import { checkRequirements, decideStructure, newOwner, open, pdfBuffer } from "./support";

const PHONE = { width: 390, height: 844 };

const tabs = (page: Page) => page.getByRole("navigation", { name: "Section tabs" });

// Marks every step left in Start your business done, one at a time, the way an owner who did them already would
async function finishPaperwork(page: Page) {
  for (let round = 0; round < 40; round++) {
    await open(page, "/start");
    const next = page.getByRole("main").getByRole("link", { name: /^(Ready|Needs confirmation): / }).first();
    if (!(await next.isVisible())) return;
    await next.click();
    await page.waitForURL("**/checklist/**");
    const title = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
    const acknowledge = page.getByRole("button", { name: "Got it, mark this done" });
    if (await acknowledge.isVisible()) {
      await acknowledge.click();
    } else {
      await page.getByRole("button", { name: "I’ve already done this" }).click();
      const already = page.getByRole("region", { name: "Already done" });
      await already.locator("input[type=file]").setInputFiles({ name: "filed.pdf", mimeType: "application/pdf", buffer: pdfBuffer("Filed") });
      await already.getByText("I finished this step myself, before or outside SnapStart.").click();
      await already.getByRole("button", { name: "Mark it done" }).click();
    }
    await expect(page.getByRole("status").filter({ hasText: `Done: ${title}` })).toBeAttached();
  }
  throw new Error("Start your business never ran out of steps");
}

test.describe("phone tabs", () => {
  test("tacos: tabs show every section, Brand opens its overview, More opens the menu, and nothing is covered", async ({ browser }) => {
    const { page } = await newOwner(browser, tacos);
    await page.setViewportSize(PHONE);
    await open(page, "/");

    const bar = tabs(page);
    await expect(bar).toBeVisible();
    for (const name of ["Today", "Start your business", "Build your brand", "Run your business"]) {
      await expect(bar.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
    }
    await expect(bar.getByRole("link", { name: /^Today/ })).toHaveAttribute("aria-current", "page");
    // The full menu stays hidden until More
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeHidden();

    // The one-time tip, gone for good once dismissed
    const tip = page.getByRole("note", { name: "Tip" });
    await expect(tip).toContainText("Your other sections are down here");
    await tip.getByRole("button", { name: "Got it, hide this tip" }).click();
    await expect(tip).toBeHidden();
    await page.reload();
    await expect(bar).toBeVisible();
    await expect(tip).toBeHidden();

    // Brand lands on its overview, listing every step
    await bar.getByRole("link", { name: /^Build your brand/ }).click();
    await page.waitForURL("**/build-your-brand");
    await expect(page.getByRole("heading", { level: 1, name: "Build your brand" })).toBeVisible();
    const steps = page.getByRole("list", { name: "Steps in Build your brand" });
    for (const step of ["Build your brand", "Create your logo", "Create your website", "Create your marketing plan", "Set up social media"]) {
      await expect(steps.getByRole("link", { name: new RegExp(step) })).toBeVisible();
    }
    await expect(bar.getByRole("link", { name: /^Build your brand/ })).toHaveAttribute("aria-current", "page");

    // Nothing at the bottom of the page hides behind the tabs
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const gap = await page.evaluate(() => {
      const main = document.querySelector("main")!.getBoundingClientRect();
      const nav = document.querySelector('nav[aria-label="Section tabs"]')!.getBoundingClientRect();
      return nav.top - main.bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(0);

    // Every tab is big enough to tap
    for (const box of await bar.locator("a, button").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) {
      expect(box).toBeGreaterThanOrEqual(44);
    }

    await bar.getByRole("link", { name: /^Run your business/ }).click();
    await page.waitForURL("**/run");
    await expect(page.getByRole("heading", { level: 1, name: "Run your business" })).toBeVisible();

    // More opens the full menu, with Insights, Documents and every step
    await bar.getByRole("button", { name: /^More/ }).click();
    const menu = page.getByRole("navigation", { name: "Sections" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: /^Business insights/ })).toBeVisible();
    await expect(menu.getByRole("link", { name: /^Documents/ })).toBeVisible();
    await menu.getByRole("link", { name: /^Documents/ }).click();
    await page.waitForURL("**/documents");
    await expect(menu).toBeHidden();
    await expect(bar.getByRole("button", { name: /^More/ })).toHaveAttribute("aria-expanded", "false");
  });

  test("groomer: finishing Start your business offers “Move on to branding”", async ({ browser }) => {
    test.slow();
    const { page } = await newOwner(browser, groomer);
    await page.setViewportSize(PHONE);
    await open(page, "/");
    await expect(page.getByRole("link", { name: "Move on to branding" })).toHaveCount(0);

    await decideStructure(page, /^Sole proprietorship/);
    await checkRequirements(page);
    await finishPaperwork(page);

    // On the last step's page, the overview and Today
    await expect(page.getByRole("region", { name: "You’ve finished Start your business" }).getByRole("link", { name: "Move on to branding" })).toBeVisible();
    await open(page, "/start");
    await expect(page.getByRole("link", { name: "Move on to branding" })).toBeVisible();
    await open(page, "/");
    await page.getByRole("link", { name: "Move on to branding" }).click();
    await page.waitForURL("**/brand");
    await expect(tabs(page).getByRole("link", { name: /^Build your brand/ })).toHaveAttribute("aria-current", "page");
  });
});
