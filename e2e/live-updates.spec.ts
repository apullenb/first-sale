import { expect, test } from "@playwright/test";
import { candles, groomer } from "./scenarios";
import { answerNextAsBusy, approveBrand, newOwner, open, sidebar } from "./support";

const FOLLOWING = "Already running, maybe in another tab.";

test.describe("two tabs", () => {
  test("groomer: a second tab follows a running requirements check and shows the result without a reload", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    const second = await page.context().newPage();
    // Both tabs open the page at once, so both try to start the check; one runs it and the other follows it
    await Promise.all([open(page, "/requirements"), open(second, "/requirements")]);
    for (const tab of [page, second]) {
      await expect(tab.getByRole("button", { name: "Check again" })).toBeVisible({ timeout: 180_000 });
      await expect(tab.getByText(/reload the page|didn’t finish/i)).toHaveCount(0);
      await expect(tab.getByRole("button", { name: "Try again" })).toHaveCount(0);
    }
  });

  test("groomer: progress changed in one tab shows in another when it's back in focus", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    const other = await page.context().newPage();
    await open(other, "/");
    const otherNav = sidebar(other);
    await expect(otherNav.getByRole("link", { name: /^Create your marketing plan(?! , done)/ })).toBeVisible();

    await open(page, "/marketing");
    await page.getByRole("button", { name: "I already have a marketing plan" }).click();
    const panel = page.getByRole("region", { name: "I already have a marketing plan" });
    await panel.getByRole("button", { name: "Mark as done" }).click();
    await expect(sidebar(page).getByRole("link", { name: /^Create your marketing plan , done/ })).toBeVisible();

    // Refreshes are spaced out; then coming back to the tab is enough
    await other.waitForTimeout(5_500);
    await other.bringToFront();
    await other.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(otherNav.getByRole("link", { name: /^Create your marketing plan , done/ })).toBeVisible();
    await expect(otherNav.getByRole("button", { name: "Build your brand 1 of 6 steps done" })).toBeVisible();
  });
});

test.describe("a job already running", () => {
  test("candles: “Describe my brand” follows the running job and shows its description", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await open(page, "/brand");
    const feel = page.getByRole("region", { name: "Step 2: How should your brand feel?" });
    for (const word of candles.brand.words) await feel.getByRole("button", { name: word, exact: true }).click();
    await answerNextAsBusy(page, { workflow: "brand_story", subjectId: null });
    await feel.getByRole("button", { name: "Describe my brand" }).click();

    // Progress, not an error, then the description from the refreshed page
    await expect(feel.getByRole("status").filter({ hasText: FOLLOWING })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    const description = page.getByRole("region", { name: "Step 3: Your brand description" });
    await expect(description.getByRole("blockquote")).toContainText(candles.businessName, { timeout: 30_000 });
    await expect(page.getByText(FOLLOWING)).toHaveCount(0);
  });

  test("candles: “Generate logo ideas” follows the running job and shows the ideas", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await approveBrand(page, candles);
    await open(page, "/logo");
    const shows = page.getByRole("region", { name: "Step 2: What your logo shows" });
    await answerNextAsBusy(page, { workflow: "brand_ideas", subjectId: null });
    await shows.getByRole("button", { name: "Generate logo ideas" }).click();

    await expect(shows.getByRole("status").filter({ hasText: FOLLOWING })).toBeVisible();
    await expect(shows.getByRole("button", { name: "Writing ideas…" })).toBeDisabled();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Step 3: Pick your logo" }).getByRole("region", { name: "Practice idea 1" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(FOLLOWING)).toHaveCount(0);
  });
});
