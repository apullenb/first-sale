import { expect, test } from "@playwright/test";
import { candles, groomer, tacos } from "./scenarios";
import { checkRequirements, decideStructure, expectPracticeBanner, markStepDone, newOwner, open, openFold, pdfBuffer, saveDetail, sidebar } from "./support";

test.describe("what applies to you and the paperwork", () => {
  test("groomer: requirements check, the plan, and recording a step", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    await decideStructure(page, /^Sole proprietorship/);
    await checkRequirements(page);
    await expectPracticeBanner(page);
    await expect(page.getByText("These requirements are practice results.", { exact: false })).toBeVisible();
    const where = page.getByRole("region", { name: "Where your rules come from" });
    await expect(where).toContainText("Columbus, Franklin County, Ohio");
    await expect(where).toContainText("You’re inside Columbus city limits, so its rules apply.");
    await expect(page.getByRole("region", { name: "About your plans" })).toContainText("Nothing left to answer");

    const checked = await openFold(page, "What we checked");
    await expect(checked).toContainText(/\w/);
    const how = await openFold(page, "How this was checked");
    await expect(how.getByRole("link").first()).toBeVisible();

    const paperwork = page.getByRole("region", { name: "Your paperwork" });
    await expect(paperwork.getByRole("link", { name: "Register your business", exact: true }).first()).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /^What applies to you , done/ })).toBeVisible();

    // Every step, with costs and a printable copy
    await open(page, "/start");
    await expectPracticeBanner(page);
    await expect(page.getByRole("region", { name: "What it costs" })).toContainText("To get started");
    await page.getByRole("button", { name: "Save as PDF" }).click();
    await expect(page.getByRole("region", { name: "Keep a copy" }).getByRole("status")).toContainText(/\w/, { timeout: 60_000 });

    // A group page, then one step in it
    await open(page, "/start/register");
    await expect(page.getByRole("heading", { level: 1, name: "Register your business" })).toBeVisible();
    await page.getByRole("region", { name: "Your next step" }).getByRole("link", { name: "Open this step" }).click();
    await page.waitForURL("**/checklist/**");
    await expect(page.getByRole("heading", { level: 1, name: "Register your business name" })).toBeVisible();
    await expectPracticeBanner(page);
    await expect(page.getByText("Opening a link or a form never changes this.", { exact: false })).toBeVisible();

    // Submitted: waiting to hear back, shown with a clock in the sidebar
    await expect(page.getByRole("button", { name: "I submitted it" })).toBeDisabled();
    await page.getByText("I submitted this myself.").click();
    await page.getByRole("textbox", { name: "Note for your records (optional)" }).fill("Filed online, confirmation emailed");
    await page.getByRole("button", { name: "I submitted it" }).click();
    await expect(sidebar(page).getByRole("link", { name: /^Register your business , waiting to hear back/ })).toBeVisible();
    await expect(page.getByText("Filed online, confirmation emailed")).toBeVisible();

    // Approved: done, with the DONE stamp
    const approve = page.getByRole("region", { name: "Mark it when it’s approved" });
    await expect(approve.getByRole("button", { name: "Mark as approved" })).toBeDisabled();
    await approve.getByText("The office approved it, or sent what I applied for.").click();
    await approve.getByRole("button", { name: "Mark as approved" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Done: / })).toBeAttached();
    await expect(sidebar(page).getByRole("link", { name: /^Register your business , done/ })).toBeVisible();

    // “I already have this” on another step
    await open(page, "/start");
    const nextStep = page.getByRole("link", { name: /^Ready: / }).first();
    await nextStep.click();
    await page.waitForURL("**/checklist/**");
    const stepTitle = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
    await page.getByRole("button", { name: "I’ve already done this" }).click();
    const already = page.getByRole("region", { name: "Already done" });
    await already.locator("input[type=file]").setInputFiles({ name: "approval.pdf", mimeType: "application/pdf", buffer: pdfBuffer("Approval letter") });
    await expect(already.getByRole("button", { name: "Mark it done" })).toBeDisabled();
    await already.getByText("I finished this step myself, before or outside First Sale.").click();
    await already.getByRole("button", { name: "Mark it done" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Done: ${stepTitle}` })).toBeAttached();
    await expect(page.getByRole("group").filter({ hasText: "Documents for this step" }).first()).not.toContainText("None saved yet");
  });

  test("tacos: unsure answers keep steps conditional, and locked steps wait", async ({ browser }) => {
    const { page } = await newOwner(browser, tacos);
    await checkRequirements(page);
    const where = page.getByRole("region", { name: "Where your rules come from" });
    await expect(where).toContainText("Not confirmed whether you’re inside Phoenix city limits.");
    await expect(where.getByRole("link", { name: "Confirm your place" })).toBeVisible();
    const depends = page.getByRole("region", { name: "Depends on where you are" });
    await expect(depends.getByRole("link", { name: "General business license" })).toBeVisible();

    const more = await openFold(page, "More First Sale looked into");
    await expect(more.getByText(/Practice answer:/).first()).toBeVisible();

    // Steps for a structure stay locked until it's decided
    await open(page, "/start");
    const locked = page.getByRole("link", { name: /^Locked: Register your business name/ });
    await expect(locked).toContainText("Do this first: Choose your business structure");
    await expect(sidebar(page).getByRole("link", { name: /^Register your business , locked, waits on Business structure/ })).toBeVisible();
    await locked.click();
    await page.waitForURL("**/checklist/**");
    await expect(page.getByText(/Choose your business structure/).first()).toBeVisible();

    // Settling an open answer settles the step that depended on it
    await open(page, "/requirements");
    await page.getByRole("region", { name: "Where your rules come from" }).getByRole("link", { name: "Confirm your place" }).click();
    await page.waitForURL("**/business/edit");
    await page.getByRole("button", { name: "Change inside city limits" }).click();
    await page.getByRole("group", { name: /^Is your address inside the city limits of Phoenix/ }).getByRole("button", { name: "Yes", exact: true }).click();
    await page.getByRole("button", { name: /^(Back to summary|Back to your changes|Continue)$/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Check your changes" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm these changes" }).click();
    await page.waitForURL(/\/business(\?|$)/);
    await open(page, "/requirements");
    await expect(page.getByRole("region", { name: "Where your rules come from" })).toContainText("You’re inside Phoenix city limits, so its rules apply.", { timeout: 60_000 });
    await expect(page.getByRole("region", { name: "Depends on where you are" })).toHaveCount(0);

    // Checking again keeps the answers about their plans
    await page.getByRole("button", { name: "Check again" }).click();
    await expect(page.getByRole("button", { name: "Check again" })).toBeVisible({ timeout: 120_000 });
    await expectPracticeBanner(page);
  });

  test("candles: the EIN step offers fill-in-here or apply online, with prepared answers", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await open(page, "/business");
    await saveDetail(page, "Business street address", "1420 Larimer St, Denver, CO 80202");
    await saveDetail(page, "Business phone", candles.details.phone);
    await decideStructure(page, /^Limited liability company/);
    await checkRequirements(page);
    // Practice mode adds a labeled formation step for Colorado; the EIN waits for it
    await markStepDone(page, /Form your LLC with the state of Colorado/);

    // The sales tax permit they said they already have is flagged
    await open(page, "/start/tax-ids");
    await page.getByRole("link", { name: /Employer Identification Number/ }).first().click();
    await page.waitForURL("**/checklist/**");
    await expect(page.getByRole("heading", { level: 1, name: "Employer Identification Number (EIN)" })).toBeVisible();

    const paths = page.getByRole("group", { name: "Choose how to do it" });
    await expect(paths.getByText(/Option A: Fill in Form SS-4 here/)).toBeVisible();
    await expect(paths.getByText(/Option B: Apply online/)).toBeVisible();
    await expect(paths.getByText("Both end with you sending it yourself", { exact: false })).toBeVisible();

    await paths.getByText(/Option B: Apply online/).click();
    await page.getByRole("button", { name: "Prepare my answers" }).click();

    // The answer guide opens as a document, filled from saved details only
    await expect(page.getByRole("heading", { level: 1, name: /^Answers for: Form SS-4/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("link", { name: /Open the official application/ })).toBeVisible();
    const answers = page.getByRole("region", { name: "Your answers" });
    await expect(answers.getByRole("textbox", { name: "Applicant: Applicant’s phone number" })).toHaveValue(candles.details.phone);
    await expect(answers.getByRole("textbox", { name: "Line 8b: Number of LLC members" })).toHaveValue("2");
    // ID numbers and signatures are always left for the owner
    await expect(answers.getByText("First Sale never fills in ID numbers, signatures or sworn statements.", { exact: false }).first()).toBeVisible();
    await answers.getByRole("textbox", { name: "Line 7a: Name of the responsible party (the owner in control)" }).fill(candles.ownerName);
    await answers.getByRole("button", { name: "Confirm all filled answers" }).click();
    await expect(answers.getByRole("checkbox", { name: "Confirm Line 7a: Name of the responsible party (the owner in control)" })).toBeChecked();
    await answers.getByRole("button", { name: "Save answers" }).click();
    await expect(answers.getByRole("status").last()).toContainText(/\w/);
    // Form help: explain it, then ask about one blank
    await page.getByRole("button", { name: "Explain this form" }).click();
    await expect(page.getByRole("region", { name: "What this form is for" }).getByText(/[Pp]ractice/).first()).toBeVisible({ timeout: 60_000 });
    const ask = page.getByRole("region", { name: "Ask about this form" });
    await ask.getByRole("textbox", { name: "Your question" }).fill("What does responsible party mean?");
    await ask.getByRole("combobox", { name: "Is it about one blank? (optional)" }).selectOption({ label: "Line 7a: Name of the responsible party (the owner in control) (page 1)" });
    await ask.getByRole("button", { name: "Ask" }).click();
    await expect(ask.getByText(/[Pp]ractice/).first()).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Save my answers as a guide" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /answer guide, not filed/ })).toBeVisible({ timeout: 60_000 });
  });

  test("candles: fill in Form SS-4 here gets the official form with drafted answers", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await decideStructure(page, /^Limited liability company/);
    await checkRequirements(page);
    await markStepDone(page, /Form your LLC with the state of Colorado/);
    await open(page, "/start/tax-ids");
    await page.getByRole("link", { name: /Employer Identification Number/ }).first().click();
    await page.waitForURL("**/checklist/**");
    const paths = page.getByRole("group", { name: "Choose how to do it" });
    await paths.getByText(/Option A: Fill in Form SS-4 here/).click();
    // Downloads the form from irs.gov on the server, so it needs the internet
    await page.getByRole("button", { name: "Get the form with my answers" }).click();
    const checked = page.getByRole("region", { name: "Checked: this is the official form" });
    await expect(checked).toBeVisible({ timeout: 90_000 });
    await expect(checked).toContainText("Passed: Downloaded from irs.gov");
    await expect(checked).toContainText("The original is kept exactly as downloaded");
    const answers = page.getByRole("region", { name: "Your answers" });
    const save = page.getByRole("region", { name: "Save your reviewed version" });
    // Only confirmed answers go into the copy
    await save.getByRole("button", { name: "Save a filled copy" }).click();
    await expect(save.getByRole("alert")).toContainText("Confirm at least one answer first.");
    await answers.getByRole("textbox", { name: "Applicant: Applicant’s phone number" }).fill(candles.details.phone);
    await answers.getByRole("button", { name: "Confirm all filled answers" }).click();
    await expect(answers.getByRole("checkbox", { name: "Confirm Applicant: Applicant’s phone number" })).toBeChecked();
    await answers.getByRole("button", { name: "Save answers" }).click();
    await save.getByRole("button", { name: "Save a filled copy" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /not filed|filled copy|reviewed/i })).toBeVisible({ timeout: 60_000 });
  });
});
