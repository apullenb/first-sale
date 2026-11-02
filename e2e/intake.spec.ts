import { expect, test } from "@playwright/test";
import { candles, groomer, SCENARIOS, tacos } from "./scenarios";
import { completeIntake, newOwner, open, pick, pickPlace, sidebar, signUp, uniqueEmail } from "./support";

test.describe("business intake", () => {
  for (const s of SCENARIOS) {
    test(`${s.key}: intake answers land on Your business and Today`, async ({ browser }) => {
      const { page } = await newOwner(browser, s);

      // Welcome screen after confirming
      await expect(page.getByRole("region", { name: "You’re all set." })).toBeVisible();
      const where = `${s.place.city}, ${s.place.county} County, ${s.place.state}`;
      await expect(page.getByRole("region", { name: "Where" }).getByText(where)).toBeVisible();
      await expect(page.getByRole("region", { name: "Owners and name" }).getByText(s.businessName)).toBeVisible();
      await expect(page.getByRole("region", { name: "Decisions" }).getByText("Not decided yet").first()).toBeVisible();

      await open(page, "/");
      await expect(page.getByRole("heading", { level: 1, name: new RegExp(`${s.ownerName.split(" ")[0]}\\.$`) })).toBeVisible();
      await expect(page.getByRole("region", { name: "Do this next" }).getByRole("link", { name: "Compare your options" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Working on" }).getByText(s.businessName)).toBeVisible();
      if (s.launchDate) {
        await expect(page.getByRole("region", { name: "Launch day" }).getByText(/days to go/)).toBeVisible();
      }

      // The intake unlocks the next stages in the sidebar
      const nav = sidebar(page);
      await expect(nav.getByRole("link", { name: /^Your business , done/ })).toBeVisible();
      await expect(nav.getByRole("link", { name: /^Business structure(?! , locked)/ })).toBeVisible();
    });
  }

  test("tacos: “Not sure” answers stay open questions, never “no”", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUp(page, tacos.ownerName, uniqueEmail("tacos-unsure"));

    await completeIntake(page, tacos, { confirm: false });
    const open = page.getByRole("region", { name: "Not decided yet" });
    await expect(open).toBeVisible();
    for (const term of ["Inside city limits", "Might add a co-owner", "Starting budget", "First-year sales", "Goal launch date"]) {
      await expect(open.getByRole("term").filter({ hasText: term })).toBeVisible();
    }
    await expect(open.getByRole("definition").filter({ hasText: "Not sure" }).first()).toBeVisible();
    // “I don’t have a date yet” is a decision, not a skipped question
    await expect(open.getByRole("definition").filter({ hasText: "No date yet" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Not answered" }).getByRole("term").filter({ hasText: "Goal launch date" })).toHaveCount(0);
    await page.getByRole("button", { name: "This is right. Continue" }).click();
    await page.waitForURL("**/business?welcome=1");
    const saved = page.getByRole("region", { name: "Not decided yet" });
    await expect(saved.getByRole("definition").filter({ hasText: "No date yet" })).toBeVisible();
    await context.close();
  });

  test("groomer: follow-ups that shape recommendations must be answered, and a double click can’t skip a part", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUp(page, groomer.ownerName, uniqueEmail("groomer-follow-ups"));
    const heading = page.getByRole("heading", { level: 1 });
    const next = page.getByRole("button", { name: "Continue" });

    await page.getByRole("button", { name: new RegExp(`^${groomer.kind}`) }).click();
    await page.getByRole("group", { name: "What will you sell? Pick any." }).getByRole("button", { name: groomer.sells[0], exact: true }).click();
    await next.click();
    await expect(heading).toHaveText("What you’ve done so far");
    await pick(page.getByRole("group", { name: "Where are you now?" }), "Just an idea so far");
    await next.click();

    await expect(heading).toHaveText("Where will your business be?");
    await pickPlace(page, "State", groomer.place.state);
    await pickPlace(page, "City or town", groomer.place.city);
    await pickPlace(page, "County", groomer.place.county);
    // Unanswered city-limits question: a double click stays here and says why
    await next.dblclick();
    await expect(heading).toHaveText("Where will your business be?");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(/city limits/);
    await pick(page.getByRole("group", { name: /^Is your address inside the city limits/ }), "Yes");
    await next.click();

    await expect(heading).toHaveText("Who owns it?");
    await pick(page.getByRole("group", { name: "Who owns it?" }), "Just me");
    await next.click();
    await expect(heading).toHaveText("Who owns it?");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(/co-owner/);
    await pick(page.getByRole("group", { name: "Might someone join as a co-owner later?" }), "No");
    // One part per click, however fast
    await next.dblclick();
    await expect(heading).toHaveText("What’s it called?");
    await page.waitForTimeout(800);
    await expect(heading).toHaveText("What’s it called?");
    await context.close();
  });

  test("groomer: business details and changing an answer later", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    await open(page, "/business");

    // Details are typed once and reused by forms
    const details = page.getByRole("region", { name: "Business details" });
    await details.getByRole("button", { name: "Add Business email" }).click();
    await details.getByRole("textbox", { name: "Business email" }).fill(groomer.details.email);
    await details.getByRole("button", { name: "Save" }).click();
    await expect(details.getByText(groomer.details.email)).toBeVisible();
    await expect(details.getByText(/Social Security or tax ID numbers/)).toBeVisible();

    // Change the business name through the edit flow
    await page.getByRole("link", { name: "Change answers" }).click();
    await page.waitForURL("**/business/edit");
    await expect(page.getByRole("heading", { level: 1, name: "Check your changes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm these changes" })).toBeDisabled();
    await page.getByRole("button", { name: "Change business name" }).click();
    const name = page.getByRole("textbox", { name: "Business name" });
    await name.fill("Sudsy Paws Grooming");
    await page.getByRole("button", { name: /^(Back to summary|Back to your changes|Continue)$/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Check your changes" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm these changes" }).click();
    // The save finishes before the page moves on
    await page.waitForURL(/\/business$/);
    await expect(page.getByText("Sudsy Paws Grooming").first()).toBeVisible();
    await open(page, "/business");
    await expect(page.getByRole("heading", { level: 1, name: "Sudsy Paws Grooming" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Answer history" }).getByRole("listitem").first()).toBeVisible();
  });

  test("candles: two owners and an existing sales tax permit are kept", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    const owners = page.getByRole("region", { name: "Owners and name" });
    await expect(owners.getByText(/2 owners|You and 1 other|Two owners|2 people/i).first()).toBeVisible();
    await expect(page.getByText("A sales tax permit").first()).toBeVisible();
  });
});
