import { expect, test } from "@playwright/test";
import { tacos } from "./scenarios";
import { completeIntake, logOut, open, signUp } from "./support";

// Matches DEMO_OWNER_EMAIL in playwright.config.ts
const DEMO_EMAIL = "demo-owner@example.test";
const NOTE = "This is the demo, so changes aren’t saved. Start your own to try it.";

test.describe("live demo", () => {
  // One fixed demo account per server, so a retry can't sign it up again
  test.describe.configure({ retries: 0 });

  test("anyone can look around the demo business, and nothing they do is saved", async ({ browser }) => {
    // The owner builds the demo business through the app, like any owner
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    await signUp(owner, tacos.ownerName, DEMO_EMAIL);
    await completeIntake(owner, tacos);
    await open(owner, "/");
    await expect(owner.getByRole("note").filter({ hasText: "demo business" })).toHaveCount(0);
    await logOut(owner);
    await ownerContext.close();

    // A visitor, signed out, follows the link on the log-in page
    const context = await browser.newContext();
    const page = await context.newPage();
    await open(page, "/login");
    await page.getByRole("link", { name: "Try the demo" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await page.waitForLoadState("networkidle");
    const banner = page.getByRole("note").filter({ hasText: "You’re exploring the SnapStart demo business." });
    await expect(banner).toBeVisible();
    await expect(page.getByText(tacos.businessName).first()).toBeVisible();

    // Buttons still work as buttons, but a save comes back with the demo note
    const phone = page.getByRole("region", { name: "Do you have a business email and phone?" }).getByRole("region", { name: "Business phone" });
    await phone.getByRole("button", { name: "I have one" }).click();
    await phone.getByLabel("Your business phone").fill("(520) 555-0142");
    await phone.getByRole("button", { name: "Save" }).click();
    await expect(phone.getByRole("alert")).toHaveText(NOTE);

    // Nothing changed
    await open(page, "/business");
    await expect(banner).toBeVisible();
    await expect(page.getByText("(520) 555-0142")).toHaveCount(0);

    // Starting your own leaves the demo first
    await banner.getByRole("button", { name: "Start your own business →" }).click();
    await page.waitForURL("**/signup");
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await context.close();
  });

  test("the sign-up page links to the demo too", async ({ page }) => {
    await open(page, "/signup");
    await expect(page.getByRole("link", { name: "Try the demo" })).toHaveAttribute("href", "/demo");
  });
});
