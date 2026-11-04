import { expect, test } from "@playwright/test";
import { candles, groomer } from "./scenarios";
import { approveBrand, choose, expectPracticeBanner, newOwner, open, openFold, PRACTICE_PREVIEW, pngBuffer, sidebar } from "./support";

test.describe("build your brand", () => {
  test("groomer: questions, describe, revise, approve, and add a picture they already have", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    await open(page, "/brand");
    await expectPracticeBanner(page);
    await expect(page.getByText("Your brand description here is a practice sample, not written by AI.", { exact: false })).toBeVisible();

    // Step 1 comes from the intake answers
    const what = page.getByRole("region", { name: "Step 1: What you sell" });
    await expect(what.getByRole("definition").first()).toHaveText(groomer.businessName);
    await expect(what.getByRole("button", { name: "Edit" })).toBeVisible();

    // Step 2: words, quick questions, colors and things to avoid
    const feel = page.getByRole("region", { name: "Step 2: How should your brand feel?" });
    await expect(feel.getByText("Pick at least 3, up to 8. 0 picked.")).toBeVisible();
    await feel.getByRole("button", { name: groomer.brand.words[0], exact: true }).click();
    await feel.getByRole("button", { name: "Describe my brand" }).click();
    await expect(feel.getByText(/at least 3/).first()).toBeVisible();
    for (const word of groomer.brand.words.slice(1)) await feel.getByRole("button", { name: word, exact: true }).click();
    await expect(feel.getByText(new RegExp(`${groomer.brand.words.length} picked\\.$`))).toBeVisible();
    await choose(feel.getByRole("group", { name: "Playful or serious?" }), "Playful");
    await choose(feel.getByRole("group", { name: "Old-fashioned or modern?" }), "Modern");
    await feel.getByRole("button", { name: groomer.brand.colors[0], exact: true }).click();
    await feel.getByRole("textbox", { name: "Colors you like or already use (optional)" }).fill("the teal on our van");
    await feel.getByRole("textbox", { name: "Colors to avoid (optional)" }).fill("no neon");
    await feel.getByRole("textbox", { name: "Things your brand shouldn’t look like (optional)" }).fill("nothing that looks like a vet clinic");
    await feel.getByRole("button", { name: "Describe my brand" }).click();

    // Step 3: the description is a labeled practice preview
    const description = page.getByRole("region", { name: "Step 3: Your brand description" });
    await expect(description.getByText(PRACTICE_PREVIEW)).toBeVisible({ timeout: 60_000 });
    await expect(description.getByRole("blockquote")).toContainText(groomer.businessName);
    await description.getByRole("button", { name: "Revise this description" }).click();
    const edit = description.getByRole("textbox", { name: "Change it until it sounds like your business" });
    await edit.fill(`${groomer.businessName} brings a cheerful, gentle grooming visit right to your driveway.`);
    await description.getByRole("button", { name: "Save: this feels like my business" }).click();

    const approved = page.getByRole("region", { name: "You approved your brand description" });
    await expect(approved.getByRole("blockquote")).toContainText("right to your driveway");
    await expect(approved.getByRole("link", { name: "Next: Create your logo" })).toHaveAttribute("href", "/logo");
    const revisit = await openFold(page, "Revisit this decision");
    await expect(revisit).toContainText(groomer.brand.words[0]);
    await expect(sidebar(page).getByRole("link", { name: /^Build your brand , done/ })).toBeVisible();

    // Step 4: a picture they already use goes to the Brand Library as is
    const pictures = page.getByRole("region", { name: /Brand pictures you already have$/ });
    await expect(pictures.getByRole("button", { name: "Add to my Brand Library" })).toBeDisabled();
    await pictures.locator("input[type=file]").setInputFiles({ name: "van-wrap.png", mimeType: "image/png", buffer: pngBuffer(400, [20, 130, 140]) });
    await pictures.getByRole("textbox", { name: "Name (optional)" }).fill("Our van wrap");
    await pictures.getByRole("button", { name: "Add to my Brand Library" }).click();
    await expect(pictures.getByRole("status").last()).toContainText(/\w/, { timeout: 30_000 });
    await open(page, "/brand-library");
    await expect(page.getByRole("region", { name: "Brand images" }).getByText("Our van wrap").first()).toBeVisible();
  });

  test("groomer: “Try different words” starts the description over", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer, "groomer-redo");
    await open(page, "/brand");
    const feel = page.getByRole("region", { name: "Step 2: How should your brand feel?" });
    for (const word of groomer.brand.words) await feel.getByRole("button", { name: word, exact: true }).click();
    await feel.getByRole("button", { name: "Describe my brand" }).click();
    const description = page.getByRole("region", { name: "Step 3: Your brand description" });
    await description.getByRole("button", { name: "Try different words" }).click({ timeout: 60_000 });
    await expect(feel.getByRole("button", { name: "Describe my brand" })).toBeVisible();
  });

  test("candles: “I already have a brand” marks the step done, and Undo brings it back", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await open(page, "/brand");
    await page.getByRole("button", { name: "I already have a brand" }).click();
    const form = page.getByRole("region", { name: "I already have a brand" });
    await form.getByRole("textbox", { name: /Note for your records/ }).fill("Brand guide from our designer");
    await form.getByRole("button", { name: "Mark as done" }).click();
    await expect(page.getByText("You already have this.")).toBeVisible();
    await expect(page.getByText("Brand guide from our designer")).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /^Build your brand , done/ })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "I already have a brand" })).toBeVisible();
  });

  test("candles: Brand Library groups files, makes recommended brand images, and adds pictures", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await approveBrand(page, candles);

    // Their existing logo, uploaded instead of generated
    await open(page, "/logo");
    await page.getByRole("button", { name: "I already have a logo" }).click();
    const have = page.getByRole("region", { name: "I already have a logo" });
    await have.locator("input[type=file]").setInputFiles({ name: "ember-oak-logo.png", mimeType: "image/png", buffer: pngBuffer(512, [90, 50, 30]) });
    await have.getByRole("button", { name: "Upload and use this logo" }).click();
    await expect(page.getByRole("region", { name: "Your logo" })).toBeVisible({ timeout: 60_000 });

    await open(page, "/brand-library");
    await expectPracticeBanner(page);
    const groups = page.getByRole("navigation", { name: "Groups in your library" });
    await expect(groups.getByRole("link", { name: /^Logos [1-9]/ })).toBeVisible();
    const logos = page.getByRole("region", { name: "Logos" }).first();
    await expect(logos.getByRole("link", { name: /^Download/ }).first()).toHaveAttribute("href", /\/brand\/files\//);

    // Recommended brand images are made from the logo, labeled as practice
    // The header comes first, as the example; the others wait until it's approved, then match it
    const header = page.getByRole("region", { name: "Website header picture" });
    const cover = page.getByRole("region", { name: "Facebook cover" });
    await expect(header.getByText("Recommended")).toBeVisible();
    await expect(cover.getByRole("button", { name: "Make the facebook cover" })).toBeDisabled();
    await expect(cover).toContainText("First make your website header picture and choose “Use this” on it.");

    // Photos by default; the owner's switch is saved and used for the example and the rest
    const style = header.getByRole("group", { name: "Style of your brand images" });
    await expect(header.getByText("We picked photos for your brand. Prefer drawings?")).toBeVisible();
    await expect(style.getByRole("button", { name: "Photo" })).toHaveAttribute("aria-pressed", "true");
    await style.getByRole("button", { name: "Illustration" }).click();
    await expect(header.getByText("You chose illustrations for your brand images.")).toBeVisible({ timeout: 30_000 });
    await expect(style.getByRole("button", { name: "Illustration" })).toHaveAttribute("aria-pressed", "true");
    const newest = header.getByRole("img", { name: "Practice preview of your website header picture", exact: true });
    const styleOf = async () => (await page.request.get((await newest.getAttribute("src"))!)).text();

    await header.getByRole("button", { name: "Make the website header picture" }).click();
    await expect(header.getByText(/Practice preview/).first()).toBeVisible({ timeout: 60_000 });
    expect(await styleOf()).toContain("ILLUSTRATION STYLE");
    await header.getByRole("button", { name: "Use this" }).first().click();
    await expect(header.getByText("In use")).toBeVisible({ timeout: 30_000 });
    await expect(cover).toContainText("Made in the style of your website header picture, with a scene of its own.");

    // Switching after the example exists makes a new one, keeps the old, and blocks the rest until it's approved
    await expect(header).toContainText("Switching makes a new header picture in that style");
    await style.getByRole("button", { name: "Photo" }).click();
    await expect(header.getByText("Earlier ones")).toBeVisible({ timeout: 60_000 });
    await expect(header.getByText("You chose photos for your brand images.")).toBeVisible();
    await expect(header.getByText("Not used yet")).toBeVisible();
    expect(await styleOf()).toContain("PHOTO STYLE");
    await expect(cover.getByRole("button", { name: "Make the facebook cover" })).toBeDisabled();
    await header.getByRole("button", { name: "Use this" }).first().click();
    await expect(header.getByText("In use").first()).toBeVisible({ timeout: 30_000 });
    await expect(cover).toContainText("Made in the style of your website header picture, with a scene of its own.");
    await cover.getByRole("button", { name: "Make the facebook cover" }).click();
    await expect(cover.getByText(/Practice preview/).first()).toBeVisible({ timeout: 60_000 });
    // Still the guided setup with three made
    await expect(page.getByRole("region", { name: "What to do next" })).toBeVisible();

    // The fourth one turns the page into the library, with making moved to the bottom
    await page.getByRole("region", { name: "YouTube banner" }).getByRole("button", { name: "Make the youtube banner" }).click();
    const library = page.getByRole("region", { name: "Your pictures" });
    await expect(library).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("region", { name: "What to do next" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Make or add pictures" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Facebook cover" })).toBeVisible();
    const filters = library.getByRole("group", { name: "Show pictures for" });
    const pictures = library.getByRole("list", { name: "Pictures" });
    await filters.getByRole("button", { name: /^Website header picture/ }).click();
    await expect(pictures.getByRole("listitem")).toHaveCount(2);
    await expect(pictures.getByRole("button", { name: /, in use$/ })).toHaveCount(1);
    await expect(page).toHaveURL(/tag=Website\+header\+picture/);

    // A thumbnail opens its full card, linkable from the address
    await filters.getByRole("button", { name: /^Facebook cover/ }).click();
    await pictures.getByRole("button", { name: /^Open Facebook cover/ }).click();
    const large = page.getByRole("dialog");
    await expect(page).toHaveURL(/open=/);
    await expect(large.getByRole("region", { name: "Facebook cover" })).toContainText("Exact size");
    await large.getByRole("button", { name: "Use this" }).first().click();
    await expect(large.getByText("You’re using this one")).toBeVisible({ timeout: 30_000 });
    await expect(large.getByRole("link", { name: /^Download/ }).first()).toHaveAttribute("href", /\/brand\/files\//);
    await page.keyboard.press("Escape");
    await expect(large).toBeHidden();
    await expect(page).not.toHaveURL(/open=/);

    // The list view and filters survive a reload
    await library.getByRole("group", { name: "View" }).getByRole("button", { name: "List" }).click();
    await page.reload();
    await expect(page.getByRole("region", { name: "Your pictures" }).getByRole("group", { name: "View" }).getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    await expect(pictures.getByText("In use", { exact: true })).toHaveCount(1);

    // A picture of their own, tagged Other pictures
    const add = page.getByRole("region", { name: "Add a picture" });
    await add.locator("input[type=file]").setInputFiles({ name: "market-stall.png", mimeType: "image/png", buffer: pngBuffer(300, [200, 180, 140]) });
    await choose(add.getByRole("group", { name: "Where it goes" }), /^Other pictures/);
    await add.getByRole("textbox", { name: "Name (optional)" }).fill("Our market stall");
    await add.getByRole("button", { name: "Add to my Brand Library" }).click();
    await filters.getByRole("button", { name: /^Other pictures/ }).click({ timeout: 30_000 });
    await expect(pictures.getByText("Our market stall").first()).toBeVisible();
    await expect(add).toContainText("You’ve added 1");
  });
});
