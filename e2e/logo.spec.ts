import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Locator, test } from "@playwright/test";
import { candles, groomer, tacos } from "./scenarios";
import { approveBrand, choose, expectPracticeBanner, newOwner, open, openFold, PRACTICE_PREVIEW, sidebar } from "./support";

const NOTHING_CHECKED = "Practice preview: no picture was drawn, so there’s nothing to check.";

// Makes one logo version and checks its practice labels
async function makeVersion(region: Locator, button: string) {
  await region.getByRole("button", { name: button }).click();
  await expect(region.getByRole("button", { name: "Use this" }).first()).toBeVisible({ timeout: 60_000 });
  await expect(region.getByText(PRACTICE_PREVIEW).first()).toBeVisible();
  await expect(region.getByText(NOTHING_CHECKED)).toBeVisible();
}

test.describe("create your logo", () => {
  test("groomer: tagline ideas, logo ideas, edit with a prompt, choose, then versions and the brand kit", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);

    // Ideas wait for an approved brand description
    await open(page, "/logo");
    await expectPracticeBanner(page);
    await expect(page.getByRole("button", { name: "Generate logo ideas" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "Go to step 1: Build your brand" })).toBeVisible();

    await approveBrand(page, groomer);
    await open(page, "/logo");
    await expect(page.getByRole("region", { name: "Step 1: Your brand" }).getByRole("blockquote")).toContainText(groomer.businessName);

    // Step 2: name, tagline suggestions, kinds of logo
    const shows = page.getByRole("region", { name: "Step 2: What your logo shows" });
    await expect(shows.getByRole("textbox", { name: "Name in your logo" })).toHaveValue(groomer.businessName);
    await shows.getByRole("button", { name: "Suggest taglines from your brand" }).click();
    const taglines = shows.getByRole("group", { name: "Suggested taglines" });
    await expect(taglines.getByRole("button").first()).toBeVisible({ timeout: 60_000 });
    await expect(shows.getByText(PRACTICE_PREVIEW)).toBeVisible();
    const suggestion = (await taglines.getByRole("button").first().textContent()) ?? "";
    await taglines.getByRole("button").first().click();
    const tagline = shows.getByRole("textbox", { name: "Tagline (optional)" });
    await expect(tagline).toHaveValue(suggestion);
    await tagline.fill("Spa day, in your driveway");

    const kinds = shows.getByRole("group", { name: "Kinds of logo" });
    await expect(kinds.getByRole("button", { name: /^Show me a mix/ })).toHaveAttribute("aria-pressed", "true");
    await kinds.getByRole("button", { name: /^Wordmark/ }).click();
    await kinds.getByRole("button", { name: /^Drawn symbol/ }).click();
    await expect(kinds.getByRole("button", { name: /^Show me a mix/ })).toHaveAttribute("aria-pressed", "false");
    await shows.getByRole("textbox", { name: "A symbol idea (optional)" }).fill("a happy dog in a bubble bath");
    await shows.getByRole("textbox", { name: "Logos you like (optional)" }).fill("round, friendly letters");
    await expect(shows.getByText("Practice mode: no logos are drawn and nothing is charged.", { exact: false })).toBeVisible();
    await shows.getByRole("button", { name: "Generate logo ideas" }).click();

    // Step 3: practice ideas, each a labeled placeholder
    const pick = page.getByRole("region", { name: "Step 3: Pick your logo" });
    const idea = pick.getByRole("region", { name: "Practice idea 1" });
    await expect(idea).toBeVisible({ timeout: 60_000 });
    await expect(pick.getByText("In practice mode these ideas are placeholders", { exact: false })).toBeVisible();
    await expect(idea.getByRole("img", { name: /Practice preview: a plain placeholder/ }).first()).toBeVisible();
    await expect(idea.getByRole("list", { name: "Colors" }).getByRole("listitem").first()).toContainText("#");
    await expect(idea.getByText(/^Why it fits:/)).toBeVisible();

    // Edit with a prompt: a new draft under the first, which is kept
    await idea.getByRole("button", { name: "Edit" }).first().click();
    await idea.getByRole("textbox", { name: "What would you like to change?" }).fill("Make the bubbles bigger");
    await idea.getByRole("button", { name: "Make this change" }).click();
    await expect(idea.getByRole("figure", { name: /You asked: “Make the bubbles bigger”/ })).toBeVisible({ timeout: 60_000 });
    await expect(idea.getByRole("figure")).toHaveCount(2);

    // Quick changes are offered for each draft
    const quick = await openFold(idea.getByRole("listitem").first(), /Quick changes/);
    await expect(quick.getByRole("button", { name: "Make it simpler" })).toBeVisible();
    await expect(quick.getByRole("button", { name: "Use these colors" })).toBeDisabled();
    await expect(quick.getByRole("button", { name: "Change the lettering" })).toBeDisabled();

    await idea.getByRole("button", { name: "Choose this logo" }).first().click();
    const yours = page.getByRole("region", { name: "Your logo" });
    await expect(yours.getByRole("figure", { name: "You chose this logo." })).toBeVisible({ timeout: 60_000 });
    await expect(yours.getByRole("heading", { name: "Your edits" })).toBeVisible();
    await expect(yours.getByRole("button", { name: "Use this" })).toBeVisible();
    await expect(yours.getByRole("link", { name: "Make new logo ideas" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /^Create your logo , done/ })).toBeVisible();

    // Versions: stacked (use, regenerate, edit), icon and one-color
    const versions = page.getByRole("region", { name: "Step 1: Your logo versions" });
    const stacked = versions.getByRole("region", { name: "Stacked" });
    await makeVersion(stacked, "Make the stacked");
    await expect(stacked.getByText("Not used yet")).toBeVisible();
    await stacked.getByRole("button", { name: "Regenerate" }).click();
    await expect(stacked.getByText("Earlier ones")).toBeVisible({ timeout: 60_000 });
    await stacked.getByRole("button", { name: "Edit" }).click();
    await stacked.getByRole("textbox", { name: "What would you like to change?" }).fill("Put the name on two lines");
    await stacked.getByRole("button", { name: "Make this change" }).click();
    await expect(stacked.getByText("Earlier ones")).toBeVisible();
    await expect(stacked.getByRole("listitem")).toHaveCount(2, { timeout: 60_000 });
    await stacked.getByRole("button", { name: "Use this" }).first().click();
    await expect(stacked.getByText("Not used yet")).toBeHidden({ timeout: 30_000 });
    await expect(stacked.getByRole("link", { name: "Download the practice preview" })).toHaveAttribute("href", /\/brand\/files\//);

    const icon = versions.getByRole("region", { name: "Icon (profile picture)" });
    await makeVersion(icon, "Make the icon (profile picture)");
    await icon.getByRole("button", { name: "Use this" }).first().click();
    const oneColor = versions.getByRole("region", { name: "One-color" });
    await makeVersion(oneColor, "Make the one-color");
    await oneColor.getByRole("button", { name: "Use this" }).first().click();

    // Brand kit: colors checked in code, files made in the browser, a printable guide
    const kit = page.getByRole("region", { name: "Step 2: Your brand kit" });
    await expect(kit.getByText("Some files are practice previews. Don’t use them as your logo.", { exact: false })).toBeVisible();
    await expect(kit.getByRole("region", { name: "Colors" })).toContainText("worked out from each color’s contrast (the WCAG standard), not by AI");
    const files = kit.getByRole("region", { name: "Logo files" });
    const download = page.waitForEvent("download");
    await files.getByRole("button", { name: /^Download all \d+ logo files \(\.zip\)$/ }).click();
    expect((await download).suggestedFilename()).toMatch(/\.zip$/);
    await kit.getByRole("region", { name: "Logo guide" }).getByRole("button", { name: "Save my logo guide" }).click();
    await expect(kit.getByRole("region", { name: "Logo guide" }).getByRole("status")).toContainText(/\w/, { timeout: 60_000 });
    await open(page, "/documents");
    await expect(page.getByRole("region", { name: "Your documents" }).getByText(/logo guide/i).first()).toBeVisible();

    // The Brand Library shows the chosen logo and its versions
    await open(page, "/brand-library");
    const logos = page.getByRole("region", { name: "Logos" }).first();
    await expect(logos.getByRole("figure", { name: /^Main logo/ })).toBeVisible();
    await expect(logos.getByRole("figure", { name: /^Stacked/ })).toBeVisible();
    await expect(logos.getByRole("figure", { name: /^Icon/ })).toBeVisible();
  });

  test("tacos: one kind of logo, quick changes, more ideas like one, and fresh ideas", async ({ browser }) => {
    const { page } = await newOwner(browser, tacos);
    await approveBrand(page, tacos);
    await open(page, "/logo");
    const shows = page.getByRole("region", { name: "Step 2: What your logo shows" });
    await shows.getByRole("group", { name: "Kinds of logo" }).getByRole("button", { name: /^Badge/ }).click();
    await shows.getByRole("button", { name: "Generate logo ideas" }).click();
    const pick = page.getByRole("region", { name: "Step 3: Pick your logo" });
    const idea = pick.getByRole("region", { name: "Practice idea 1" });
    await expect(idea).toBeVisible({ timeout: 60_000 });

    const quick = await openFold(idea.getByRole("listitem").first(), /Quick changes/);
    await quick.getByRole("button", { name: "Make it simpler" }).click();
    await expect(idea.getByRole("figure")).toHaveCount(2, { timeout: 60_000 });

    const lettering = await openFold(idea.getByRole("listitem").first(), /Quick changes/);
    await choose(lettering.getByRole("group", { name: "Different lettering" }), "Retro sign");
    await lettering.getByRole("button", { name: "Change the lettering" }).click();
    await expect(idea.getByRole("figure")).toHaveCount(3, { timeout: 60_000 });

    // The new round replaces the shown one: its first idea has one drawing, not three
    await idea.getByRole("button", { name: "More ideas like this" }).click();
    await expect(pick.getByRole("region", { name: "Practice idea 1" }).getByRole("figure")).toHaveCount(1, { timeout: 60_000 });
    await expect(pick.getByRole("region", { name: /^Practice idea/ })).toHaveCount(3);

    await shows.getByRole("button", { name: "Generate new logo ideas" }).click();
    await expect(pick.getByRole("region", { name: "Practice idea 1" })).toBeVisible({ timeout: 60_000 });
  });

  test("candles: upload the logo they already have instead, and make versions from it", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await open(page, "/logo");
    await page.getByRole("button", { name: "I already have a logo" }).click();
    const have = page.getByRole("region", { name: "I already have a logo" });
    await expect(have.getByRole("button", { name: "Upload and use this logo" })).toBeDisabled();
    // SVG isn't accepted
    await have.locator("input[type=file]").setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>") });
    await expect(have.getByText("SVG files can’t be uploaded.", { exact: false })).toBeVisible();
    // A real drawn logo, so its versions are built from its own pixels even in practice mode
    const logo = readFileSync(path.join(__dirname, "..", "src", "lib", "brand", "test-logos", "soy-candles.png"));
    await have.locator("input[type=file]").setInputFiles({ name: "two-pines-logo.png", mimeType: "image/png", buffer: logo });
    await expect(have.getByRole("img", { name: "Preview of your logo" })).toBeVisible();
    await have.getByRole("button", { name: "Upload and use this logo" }).click();

    const yours = page.getByRole("region", { name: "Your logo" });
    await expect(yours).toBeVisible({ timeout: 60_000 });
    await expect(sidebar(page).getByRole("link", { name: /^Create your logo , done/ })).toBeVisible();
    const icon = page.getByRole("region", { name: "Icon (profile picture)" });
    await icon.getByRole("button", { name: "Make the icon (profile picture)" }).click();
    await expect(icon.getByText("Made by First Sale from your logo’s own pixels", { exact: false })).toBeVisible({ timeout: 60_000 });
    await expect(icon.getByText(PRACTICE_PREVIEW)).toHaveCount(0);
    await expect(icon.getByRole("button", { name: "Have AI draw one instead" })).toBeVisible();

    // Replacing the logo asks first, since versions were made from it
    await expect(yours.getByRole("button", { name: "Upload a new logo" })).toBeVisible();
  });
});
