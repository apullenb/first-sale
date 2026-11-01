import { expect, type Page, test } from "@playwright/test";
import { groomer, tacos } from "./scenarios";
import { newOwner, open, sidebar } from "./support";

// Fills in an “I already have …” panel with a note and marks the step done
async function markHave(page: Page, path: string, label: string) {
  await open(page, path);
  await page.getByRole("button", { name: label }).click();
  const panel = page.getByRole("region", { name: label });
  await panel.getByRole("textbox", { name: /Note for your records/ }).fill("Done before SnapStart");
  await panel.getByRole("button", { name: "Mark as done" }).click();
  await expect(page.getByText("You already have this.")).toBeVisible();
}

test.describe("sidebar and Today", () => {
  test("groomer: “I already have this” on every brand step finishes the section", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    const nav = sidebar(page);
    await expect(nav.getByRole("button", { name: "Build your brand 0 of 6 steps done" })).toBeVisible();

    await markHave(page, "/brand", "I already have a brand");
    await markHave(page, "/logo", "I already have a logo");
    await expect(nav.getByRole("button", { name: "Build your brand 2 of 6 steps done" })).toBeVisible();
    await markHave(page, "/products", "My products are already listed somewhere");
    await markHave(page, "/marketing", "I already have a marketing plan");
    await markHave(page, "/social", "I already have my social media set up");

    await open(page, "/website");
    await page.getByRole("button", { name: "I already have a website" }).click();
    await page.getByRole("region", { name: "Connect the website you already have" }).getByRole("button", { name: "I don’t want to connect it" }).click();
    await expect(page.getByText("You already have a website.")).toBeVisible();

    // The last one finishes the section: a check, and the DONE stamp
    await expect(page.getByRole("status").filter({ hasText: /^Done: / })).toBeAttached();
    await expect(nav.getByRole("button", { name: /^Build your brand , all done/ })).toBeVisible();
    for (const step of ["Build your brand", "Create your logo", "Create your website", "Add your products", "Create your marketing plan", "Set up social media"]) {
      await expect(nav.getByRole("link", { name: new RegExp(`^${step} , done`) })).toBeVisible();
    }
  });

  test("tacos: Today without a launch date, section toggles, and pages not built yet", async ({ browser }) => {
    const { page } = await newOwner(browser, tacos);
    await open(page, "/");
    await expect(page.getByRole("region", { name: "Launch day" }).getByText(/days to go/)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Starting your business" }).getByText("1 of 4 stages done")).toBeVisible();

    const nav = sidebar(page);
    const startToggle = nav.getByRole("button", { name: /the steps in Start your business/ });
    const expanded = await startToggle.getAttribute("aria-expanded");
    await startToggle.click();
    await expect(startToggle).toHaveAttribute("aria-expanded", expanded === "true" ? "false" : "true");

    await nav.getByRole("button", { name: "Run your business" }).click();
    await nav.getByRole("link", { name: "Orders" }).click();
    await page.waitForURL("**/orders");
    await expect(page.getByRole("heading", { name: "Track orders & customer requests" })).toBeVisible();
    await open(page, "/planning-for-help");
    await expect(page.getByRole("region", { name: "Not built yet" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Today" }).click();
    await page.waitForURL((url) => url.pathname === "/");
  });
});
