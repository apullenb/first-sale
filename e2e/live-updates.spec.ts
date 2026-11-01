import { expect, test } from "@playwright/test";
import { groomer } from "./scenarios";
import { newOwner, open, sidebar } from "./support";

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
