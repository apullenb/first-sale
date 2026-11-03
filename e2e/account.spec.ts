import { expect, test } from "@playwright/test";
import { candles, groomer } from "./scenarios";
import { completeIntake, logIn, logOut, open, PASSWORD, sidebar, signUp, uniqueEmail } from "./support";

test.describe("accounts", () => {
  test("signed-out visitors are sent to log in", async ({ page }) => {
    for (const path of ["/", "/structure", "/website", "/documents"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("sign-up checks each field before creating the account", async ({ page }) => {
    await open(page, "/signup");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await page.getByLabel("Your name").fill("Dana Whitfield");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter an email like name@example.com.")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);

    // Show / hide password
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  });

  test("sign up, log out, a wrong password, then log back in", async ({ page }) => {
    const email = uniqueEmail("account");
    await signUp(page, groomer.ownerName, email);
    await expect(page.getByRole("heading", { level: 1, name: "What kind of business is it?" })).toBeVisible();

    // Before the intake, later steps are locked behind it
    const nav = sidebar(page);
    await expect(nav.getByRole("link", { name: /Business structure , locked, waits on Your business/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /What applies to you , locked, waits on Your business/ })).toBeVisible();

    await logOut(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await open(page, "/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("not the right password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    await logIn(page, email, PASSWORD);
    await expect(page.getByRole("complementary").getByText(groomer.ownerName)).toBeVisible();
  });

  test("the same email can't sign up twice", async ({ page }) => {
    const email = uniqueEmail("dupe");
    await signUp(page, groomer.ownerName, email);
    await logOut(page);
    await open(page, "/signup");
    await page.getByLabel("Your name").fill("Someone Else");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("each owner sees only their own business", async ({ browser }) => {
    const first = await (await browser.newContext()).newPage();
    await signUp(first, candles.ownerName, uniqueEmail("own-a"));
    await completeIntake(first, candles);

    const second = await (await browser.newContext()).newPage();
    await signUp(second, groomer.ownerName, uniqueEmail("own-b"));
    await open(second, "/business");
    await expect(second.getByText(candles.businessName)).toHaveCount(0);
    await open(second, "/");
    await expect(second.getByText(candles.businessName)).toHaveCount(0);
    await first.context().close();
    await second.context().close();
  });
});
