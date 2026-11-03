import { expect, test } from "@playwright/test";
import { tacos } from "./scenarios";
import { newOwner, open } from "./support";

test("tacos: business insights are labeled practice samples", async ({ browser }) => {
  const { page } = await newOwner(browser, tacos);
  await open(page, "/insights");
  await expect(page.getByRole("heading", { level: 1, name: "Business insights" })).toBeVisible();
  const start = page.getByRole("region", { name: "Get friendly feedback on your idea" });
  await expect(start).toContainText("Practice mode: you’ll see sample insights made by SnapStart from your answers, not AI.");
  await start.getByRole("button", { name: "Get my insights" }).click();

  const main = page.getByRole("main");
  await expect(main.getByRole("status").filter({ hasText: "Your insights are ready." })).toBeVisible({ timeout: 120_000 });
  await expect(main.getByText("These are sample insights, made to show how this page works.", { exact: false })).toBeVisible();
  for (const section of ["What’s strong", "Worth keeping an eye on", "Tips for success"]) {
    await expect(main.getByRole("region", { name: section })).toBeVisible();
  }
  // A concern always comes with a small next step
  const concerns = main.getByRole("region", { name: "Worth keeping an eye on" }).getByRole("listitem");
  for (const concern of await concerns.all()) await expect(concern).toContainText("Try this:");

  // Mark one useful and dismiss another; both are kept across reloads
  const useful = main.getByRole("button", { name: "Useful : You know what you’ll sell" });
  await useful.click();
  await expect(useful).toHaveAttribute("aria-pressed", "true");
  await main.getByRole("button", { name: "Dismiss : Keep a simple record of every sale" }).click();
  await expect(main.getByRole("heading", { name: "Keep a simple record of every sale" })).toBeHidden();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await open(page, "/insights");
  await expect(main.getByRole("button", { name: "Useful : You know what you’ll sell" })).toHaveAttribute("aria-pressed", "true");
  await expect(main.getByRole("heading", { name: "Keep a simple record of every sale" })).toBeHidden();

  // An item can point to where the owner acts
  await main.getByRole("link", { name: "Take me there : What applies to you" }).first().click();
  await page.waitForURL("**/requirements");
});
