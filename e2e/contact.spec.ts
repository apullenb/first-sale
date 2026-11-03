import { expect, test } from "@playwright/test";
import { tacos } from "./scenarios";
import { newOwner, open, sidebar } from "./support";

test.describe("business email and phone", () => {
  test("tacos: asked after intake; one saved, one put off as a step, then marked done", async ({ browser }) => {
    const { page } = await newOwner(browser, tacos);
    const question = page.getByRole("region", { name: "Do you have a business email and phone?" });
    await expect(question).toBeVisible();

    // "I have one" saves to Business details, checked first
    const email = question.getByRole("region", { name: "Business email" });
    await email.getByRole("button", { name: "I have one" }).click();
    await email.getByLabel("Your business email").fill("hola at sonoransol");
    await email.getByRole("button", { name: "Save" }).click();
    await expect(email.getByRole("alert")).toContainText("email address like");
    await email.getByLabel("Your business email").fill(tacos.details.email);
    await email.getByRole("button", { name: "Save" }).click();
    await expect(email.getByText(tacos.details.email)).toBeVisible();
    await expect(page.getByRole("region", { name: "Business details" }).getByText(tacos.details.email)).toBeVisible();

    // "Help me set one up": Google's steps, with Google's sign-up link, and the step goes in the plan
    const phone = page.getByRole("region", { name: "Business phone" }).first();
    await phone.getByRole("button", { name: "Help me set one up" }).click();
    await expect(phone.getByText("Get a Google Voice phone number")).toBeVisible();
    await expect(phone.getByRole("link", { name: /Sign up on voice\.google\.com/ })).toHaveAttribute("href", "https://voice.google.com/");
    await expect(phone.getByText("“Existing mobile number required”")).toBeVisible();
    await expect(page.getByRole("region", { name: "Set up a business email and phone" })).toBeVisible();

    const nav = sidebar(page);
    await expect(nav.getByRole("link", { name: /^Set up a business email and phone(?! , done)/ })).toBeVisible();

    // Today shows the step; the helper page finishes it
    await open(page, "/");
    await expect(page.getByRole("region", { name: "Set up a business email and phone" })).toBeVisible();
    await open(page, "/contact");
    await page.getByRole("region", { name: "Business phone" }).getByRole("button", { name: "I already have this" }).click();
    await expect(nav.getByRole("link", { name: /^Set up a business email and phone , done/ })).toBeVisible();
    await open(page, "/");
    await expect(page.getByRole("region", { name: "Set up a business email and phone" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Do you have a business email and phone?" })).toHaveCount(0);
  });
});
