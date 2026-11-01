import { expect, type Page, test } from "@playwright/test";
import { candles, groomer } from "./scenarios";
import { approveBrand, newOwner, open, openFold, pngBuffer, sidebar } from "./support";

async function uploadLogo(page: Page) {
  await open(page, "/logo");
  await page.getByRole("button", { name: "I already have a logo" }).click();
  const have = page.getByRole("region", { name: "I already have a logo" });
  await have.locator("input[type=file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: pngBuffer(512, [90, 50, 30]) });
  await have.getByRole("button", { name: "Upload and use this logo" }).click();
  await expect(page.getByRole("region", { name: "Your logo" })).toBeVisible({ timeout: 60_000 });
}

test.describe("marketing plan and social media", () => {
  test("candles: marketing questions, a practice plan, approve it, brand images, then social accounts", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await approveBrand(page, candles);
    await uploadLogo(page);

    // Part 1: where to show up, what they already have, what never to suggest
    await open(page, "/marketing");
    const q = page.getByRole("region", { name: "Questions" });
    const use = q.getByRole("group", { name: "Which of these do you want to use?" });
    await use.getByRole("button", { name: /^Instagram/ }).click();
    await use.getByRole("button", { name: /^Pinterest/ }).click();
    await use.getByRole("button", { name: /^Google Business Profile/ }).click();
    await q.getByRole("group", { name: "Do you already have any of these for your business?" }).getByRole("button", { name: "Instagram" }).click();
    await q.getByRole("group", { name: "Any you don’t want at all?" }).getByRole("button", { name: "TikTok" }).click();
    await q.getByRole("group", { name: "Any you don’t want at all?" }).getByRole("button", { name: "Facebook" }).click();
    await q.getByRole("button", { name: "Next", exact: true }).click();

    // Part 2 needs every answer
    await q.getByRole("button", { name: "Next", exact: true }).click();
    await expect(q.getByRole("alert")).toContainText("Answer each question on this screen first.");
    await q.getByRole("group", { name: "How familiar are you with social media?" }).getByRole("button", { name: /^I use it for myself/ }).click();
    await q.getByRole("group", { name: "How much do you know about SEO?" }).getByRole("button", { name: /^What’s SEO\?/ }).click();
    await q.getByRole("group", { name: "How much marketing content have you made?" }).getByRole("button", { name: /^A little/ }).click();
    await q.getByRole("button", { name: "Next", exact: true }).click();

    // Part 3: what they've tried
    const tried = q.getByRole("group", { name: "What have you done for marketing so far?" });
    await tried.getByRole("button", { name: "Markets, fairs or events" }).click();
    await tried.getByRole("button", { name: "Made social media accounts for it" }).click();
    await q.getByRole("textbox", { name: "Anything else? (optional)" }).fill("We sold out at the spring market");
    await page.getByRole("button", { name: "Save and write my plan" }).click();

    // The practice plan never suggests what they said no to
    const plan = page.getByRole("region", { name: "Your marketing plan" });
    await expect(plan.getByText("This plan was drafted in practice mode.", { exact: false })).toBeVisible({ timeout: 120_000 });
    await expect(plan.getByText("Draft, not approved yet")).toBeVisible();
    const where = plan.getByRole("region", { name: "Where you’ll show up" });
    await expect(where).toContainText("Instagram");
    await expect(where).not.toContainText("TikTok");
    await expect(plan.getByRole("region", { name: "Goals for the first three months" }).getByRole("listitem").first()).toBeVisible();
    const answers = page.getByRole("region", { name: "Your answers" });
    await expect(answers).toContainText("TikTok");

    await page.getByRole("region", { name: "Check your plan and approve it" }).getByRole("button", { name: "Approve my plan" }).click();
    const steps = page.getByRole("region", { name: "Your steps" });
    await expect(steps.getByText("These steps come from a plan drafted in practice mode.", { exact: false })).toBeVisible({ timeout: 60_000 });
    await expect(plan.getByRole("link", { name: "Open the copy in Documents" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /^Create your marketing plan , done/ })).toBeVisible();

    // Ticking a step is the owner's record
    await steps.getByText(/^\d+\. Tell the people you already know$/).click();
    await expect(steps.getByRole("checkbox", { name: /^\d+\. Tell the people you already know$/ })).toBeChecked();

    // Brand images step: header, covers and link preview, made in the Brand Library
    const images = steps.getByRole("listitem").filter({ hasText: /\d+\. Create your brand images/ }).first();
    // Help is folded by how much content they've made; open every fold in the step
    await images.locator("details").evaluateAll((folds) => folds.forEach((fold) => ((fold as HTMLDetailsElement).open = true)));
    await images.getByRole("link", { name: "Take me there : Open your brand images" }).click();
    await page.waitForURL("**/brand-library#group-brand_images");
    // Facebook was ruled out, so its cover isn't recommended; the website's pictures always are
    await expect(page.getByRole("region", { name: "Website header picture" }).getByText("Recommended")).toBeVisible();
    await expect(page.getByRole("region", { name: "Link preview" }).getByText("Recommended")).toBeVisible();
    await expect(page.getByRole("region", { name: "Facebook cover" }).getByText("Recommended")).toHaveCount(0);
    // Photos unless the owner asks for drawings
    const headerStyle = page.getByRole("region", { name: "Website header picture" }).getByRole("group", { name: "Style of your brand images" });
    await expect(headerStyle.getByRole("button", { name: "Photo" })).toHaveAttribute("aria-pressed", "true");
    for (const [slot, button] of [
      ["Website header picture", "Make the website header picture"],
      ["Facebook cover", "Make the facebook cover"],
      ["YouTube banner", "Make the youtube banner"],
      ["Link preview", "Make the link preview"],
    ]) {
      const card = page.getByRole("region", { name: slot });
      await card.getByRole("button", { name: button }).click();
      await expect(card.getByRole("button", { name: "Use this" }).first()).toBeVisible({ timeout: 60_000 });
      await card.getByRole("button", { name: "Use this" }).first().click();
      await expect(card.getByText("In use")).toBeVisible({ timeout: 30_000 });
    }
    await open(page, "/marketing");
    // Practice previews don't count as made, so the owner ticks it themselves
    const imagesDone = page.getByRole("checkbox", { name: /^\d+\. Create your brand images$/ });
    await expect(imagesDone).not.toBeChecked();
    await page.getByText(/^\d+\. Create your brand images$/).click();
    await expect(imagesDone).toBeChecked();

    // Social media: accounts from the plan, one already set up
    await open(page, "/social");
    await expect(page.getByText("First Sale never signs in, creates accounts or posts for you.", { exact: false })).toBeVisible();
    const accounts = page.getByRole("region", { name: "Your accounts" });
    await expect(accounts.getByRole("link", { name: "Instagram (set up)" })).toBeVisible();
    await expect(accounts.getByRole("link", { name: "Pinterest (not set up yet)" })).toBeVisible();

    const pinterest = page.getByRole("region", { name: "Pinterest" });
    const ready = await openFold(pinterest, "Get Pinterest ready");
    await expect(ready.getByRole("textbox", { name: "Username" })).toHaveValue(/^[a-z0-9_]+$/);
    await ready.getByRole("button", { name: /^Use @/ }).first().click();
    await ready.getByRole("button", { name: "Draft it for me" }).click();
    const about = ready.getByRole("textbox", { name: "About" });
    await expect(about).not.toHaveValue("", { timeout: 60_000 });
    await expect(ready.getByText(/[Pp]ractice/).first()).toBeVisible();
    await about.fill("Hand-poured soy candles from Denver. Small batches, cozy scents.");
    await ready.getByRole("button", { name: "Approve" }).click();
    await expect(ready.getByText(/[Aa]pproved/).first()).toBeVisible({ timeout: 30_000 });
    await expect(pinterest.getByRole("link", { name: /^Open Pinterest/ }).first()).toHaveAttribute("href", /pinterest\.com/);
    await pinterest.getByRole("button", { name: "Mark as set up" }).click();
    const setUp = pinterest.getByRole("region", { name: "Mark as set up" });
    await setUp.getByRole("textbox", { name: "Your Pinterest link (optional)" }).fill("https://pinterest.com/emberandoak");
    await setUp.getByRole("button", { name: "Mark as set up" }).click();
    await expect(accounts.getByRole("link", { name: "Pinterest (set up)" })).toBeVisible({ timeout: 30_000 });
  });

  test("groomer: pick social accounts without a plan, and “I already have” marks", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    await open(page, "/social");
    const pick = page.getByRole("region", { name: "Pick your accounts" });
    await expect(pick.getByRole("link", { name: "Create your marketing plan" })).toBeVisible();
    await expect(pick.getByRole("button", { name: "Set up these accounts" })).toBeDisabled();
    for (const name of groomer.social) await pick.getByRole("group", { name: "Which accounts do you want?" }).getByRole("button", { name: new RegExp(`^${name}`) }).click();
    await pick.getByRole("group", { name: "How familiar are you with social media?" }).getByRole("button", { name: /^New to it/ }).click();
    await pick.getByRole("button", { name: "Set up these accounts" }).click();
    const accounts = page.getByRole("region", { name: "Your accounts" });
    await expect(accounts.getByRole("link", { name: "Facebook (not set up yet)" })).toBeVisible({ timeout: 30_000 });
    await expect(accounts.getByRole("link", { name: "Instagram (not set up yet)" })).toBeVisible();

    // An account they already have
    const facebook = page.getByRole("region", { name: "Facebook" });
    await facebook.getByRole("button", { name: "I already have this account" }).click();
    const have = facebook.getByRole("region", { name: "I already have this account" });
    await have.getByRole("textbox", { name: "Your Facebook link (optional)" }).fill("https://facebook.com/sudsypaws");
    await have.getByRole("button", { name: "Mark as set up" }).click();
    await expect(accounts.getByRole("link", { name: "Facebook (set up)" })).toBeVisible({ timeout: 30_000 });

    // The marketing plan they already have elsewhere
    await open(page, "/marketing");
    await page.getByRole("button", { name: "I already have a marketing plan" }).click();
    const plan = page.getByRole("region", { name: "I already have a marketing plan" });
    await plan.getByRole("textbox", { name: /Note for your records/ }).fill("Plan from my SCORE mentor");
    await plan.getByRole("button", { name: "Mark as done" }).click();
    await expect(page.getByText("You already have this.")).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /^Create your marketing plan , done/ })).toBeVisible();

    await open(page, "/social");
    await page.getByRole("button", { name: "I already have my social media set up" }).click();
    await page.getByRole("region", { name: "I already have my social media set up" }).getByRole("button", { name: "Mark as done" }).click();
    await expect(sidebar(page).getByRole("link", { name: /^Set up social media , done/ })).toBeVisible();
  });
});
