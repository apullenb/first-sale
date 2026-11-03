import { expect, type Page, test } from "@playwright/test";
import { candles, groomer, tacos } from "./scenarios";
import { choose, decideStructure, expectPracticeBanner, newOwner, open, pdfBuffer, pngBuffer, saveDetail } from "./support";

// Picks the first option in every unanswered business plan question
async function answerPlanQuestions(page: Page) {
  const questions = page.getByRole("region", { name: "A few questions" });
  for (const group of await questions.getByRole("group").filter({ has: page.locator("button[aria-pressed]") }).all()) {
    if (!(await group.locator("button[aria-pressed=true]").count())) await group.getByRole("button").first().click();
  }
}

test.describe("documents", () => {
  test("groomer: upload a letter, add a form by pasting it, rename and delete", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    await open(page, "/");
    await page.getByRole("region", { name: "Already have some paperwork?" }).getByRole("link", { name: "Upload a document" }).click();
    await page.waitForURL(/\/documents\?add=have/);
    const add = page.getByRole("region", { name: "Add to your library" });
    await expect(add.getByRole("radio", { name: "A document I have or got in the mail" })).toBeChecked();
    await add.getByRole("combobox", { name: "What is it?" }).selectOption({ label: "A letter or notice I got" });
    await add.locator("input[type=file]").setInputFiles({
      name: "city-letter.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer("City of Columbus notice: home occupation registration is due within 30 days."),
    });
    await add.getByRole("button", { name: "Save and explain it" }).click();
    await page.waitForURL(/\/documents\/[0-9a-f-]{36}/, { timeout: 90_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/[Pp]ractice/).first()).toBeVisible({ timeout: 60_000 });

    // A photo is kept but not read in practice mode
    await open(page, "/documents?add=have#add-form");
    await add.getByRole("combobox", { name: "What is it?" }).selectOption({ label: "A registration, license or permit I already have" });
    await add.locator("input[type=file]").setInputFiles({ name: "license.png", mimeType: "image/png", buffer: pngBuffer() });
    await add.getByRole("button", { name: "Just save it" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "license" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("region", { name: "Versions" })).toContainText("This is version 1");
    await open(page, "/documents");
    await expect(page.getByRole("region", { name: "Your documents" }).getByText("license").first()).toBeVisible();

    // A form to fill in, pasted as text
    await open(page, "/documents?add=upload#add-form");
    await add.getByRole("radio", { name: "A form I need to fill in" }).check({ force: true });
    await add.getByText("Paste the form’s text").click();
    await add.getByRole("textbox").last().fill("Mobile Vendor Application\nBusiness name: ____\nOwner name: ____\nVehicle plate: ____\nSignature: ____");
    await add.getByRole("button", { name: /Add this form|Add to your library/ }).click();
    await page.waitForURL(/\/documents\/[0-9a-f-]{36}/, { timeout: 90_000 });
    await expect(page.getByRole("region", { name: "Your answers" })).toBeVisible({ timeout: 60_000 });

    // Rename, then delete it
    await page.getByRole("button", { name: "Rename this document" }).click();
    await page.getByRole("textbox").first().fill("Vendor application (practice)");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Vendor application (practice)" })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("region", { name: "This document" }).getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByRole("button", { name: /^(Delete|Yes, delete)/ }).last();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await page.waitForURL(/\/documents($|\?)/, { timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Your documents" }).getByText("Vendor application (practice)")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Your documents" }).getByRole("heading", { name: "city-letter" })).toBeVisible();
  });

  test("candles: business plan, generate, edit, then save as a PDF", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await decideStructure(page, /^Limited liability company/);
    await open(page, "/documents");
    await page.getByRole("link", { name: "Generate your business plan" }).click();
    await page.waitForURL("**/documents/business-plan");
    const known = page.getByRole("region", { name: "What SnapStart already knows" });
    await expect(known.getByText(candles.businessName)).toBeVisible();
    await expect(known.getByText("Limited liability company (LLC)")).toBeVisible();

    await answerPlanQuestions(page);
    // Money estimates: the owner's figures, summed in code
    const money = page.getByRole("region", { name: "Money estimates (optional)" });
    await money.getByRole("button", { name: "Add an item" }).click();
    await money.getByRole("textbox", { name: "Item", exact: true }).last().fill("Soy candle");
    await money.getByRole("textbox", { name: "Price ($)" }).last().fill("24");
    await money.getByRole("textbox", { name: "Cost each ($)" }).last().fill("8");
    await money.getByRole("textbox", { name: "Sold a month" }).last().fill("30");
    await money.getByRole("button", { name: "Add an expense" }).click();
    await money.getByRole("textbox", { name: "Expense", exact: true }).fill("Market booth");
    await money.getByRole("textbox", { name: "A month ($)" }).fill("120");
    await expect(money).toContainText("Break-even: about 8 sold a month");
    await expect(page.getByText("Nothing is published or submitted to government offices.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Draft my plan" }).click();
    await expect(page.getByText("This business plan was drafted in practice mode.", { exact: false })).toBeVisible({ timeout: 120_000 });
    const review = page.getByRole("region", { name: "Review your plan" });
    await expect(review).toContainText("Introductory draft");
    await expect(review).toContainText("Break-even: about 8 units a month ($192 in sales) covers the operating expenses, at the expected mix of sales.");
    // New estimates rewrite only that section, without drafting again
    await money.getByRole("textbox", { name: "A month ($)" }).fill("160");
    await money.getByRole("button", { name: "Update the estimates in my plan" }).click();
    await expect(review).toContainText("Break-even: about 10 units a month ($240 in sales)");

    // Edit one section, then save the plan as a PDF
    await review.getByRole("button", { name: /Edit section/ }).first().click();
    const editor = review.getByRole("textbox").first();
    await editor.fill(`${await editor.inputValue()}\nWe pour every candle by hand in small batches.`);
    await page.getByRole("button", { name: /^(Save|Done|Save section|Save changes)$/ }).first().click();
    await expect(page.getByText("We pour every candle by hand in small batches.").first()).toBeVisible();
    await page.getByRole("button", { name: "Save my business plan" }).click();
    await expect(page.getByText(/Your business plan is saved|saved/i).first()).toBeVisible({ timeout: 60_000 });
    await open(page, "/documents");
    await expect(page.getByRole("region", { name: "Your documents" }).getByText(/business plan/i).first()).toBeVisible();
  });

  test("candles: the operating agreement is filled in by SnapStart and approved by the owners", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await decideStructure(page, /^Limited liability company/);
    await open(page, "/documents/agreement");
    await expect(page.getByRole("region", { name: "First, add these" })).toBeVisible();
    await open(page, "/business");
    await saveDetail(page, "Owners’ full legal names", candles.details.ownerNames);
    const details = page.getByRole("region", { name: "Business details" });
    await details.getByRole("button", { name: "Add Who runs the LLC" }).click();
    await details.getByRole("radio", { name: /Member-managed|members/i }).first().check({ force: true });
    await details.getByRole("button", { name: "Save" }).click();

    await open(page, "/documents/agreement");
    await expect(page.getByRole("region", { name: "First, add these" })).toHaveCount(0);
    const from = page.getByRole("region", { name: "From your details" });
    await expect(from).toContainText("Maya Okafor, Theo Lindqvist");
    await expect(from).toContainText("Colorado");
    const shares = page.getByRole("region", { name: "Shares and decisions" });
    await shares.getByRole("textbox", { name: "What Maya Okafor owns, as a percent" }).fill("60");
    await expect(shares.getByRole("status").first()).not.toContainText("The shares add up to 100%.");
    await shares.getByRole("textbox", { name: "What Theo Lindqvist owns, as a percent" }).fill("40");
    await expect(shares.getByRole("status").first()).toContainText("The shares add up to 100%.");
    await shares.getByRole("textbox", { name: "What Maya Okafor is putting in (optional)" }).fill("$1,500 cash");
    await choose(shares, "Owners who together own more than half decide");
    await shares.getByRole("button", { name: "Prepare my agreement" }).click();
    await expect(page.getByRole("button", { name: /Approve/ }).first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: /Approve/ }).first().click();
    await expect(page.getByText(/^Approved/).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("link", { name: "Download the PDF" })).toBeVisible();
    const agreement = page.getByRole("region", { name: "Read your agreement" });
    await expect(agreement).toContainText("Maya Okafor: owns 60%. Puts in: $1,500 cash.");
    await expect(agreement).toContainText("Theo Lindqvist: owns 40%.");
    await expect(agreement).toContainText("Signature lines for every member are at the end of the PDF.");
  });

  test("tacos: a business plan with open answers keeps [bracketed] notes", async ({ browser }) => {
    const { page } = await newOwner(browser, tacos);
    await open(page, "/documents/business-plan");
    await page.getByRole("button", { name: "Draft my plan" }).click();
    await expect(page.getByText("This business plan was drafted in practice mode.", { exact: false })).toBeVisible({ timeout: 120_000 });
    await expectPracticeBanner(page).catch(() => {});
    await expect(page.getByText(/\[[^\]]+\]/).first()).toBeVisible();
    // Skipped money estimates are said to be missing, never made up
    await expect(page.getByRole("region", { name: "Review your plan" })).toContainText("Not yet estimated: unit costs and margins");
  });
});
