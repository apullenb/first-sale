import { expect, type Page, test } from "@playwright/test";
import { candles, groomer, tacos } from "./scenarios";
import { choose, newOwner, open, openFold, sidebar } from "./support";

async function recordDecision(page: Page) {
  await page.getByRole("button", { name: "Review my choice" }).click();
  const review = page.getByRole("region", { name: "Ready to record your decision?" });
  await expect(review.getByRole("region", { name: "What recording does" })).toContainText("Files nothing.");
  await review.getByRole("button", { name: "Record my decision" }).click();
  await expect(page.getByRole("region", { name: "Decision history" }).getByRole("listitem").first()).toBeVisible();
}

test.describe("business structure", () => {
  test("groomer: compare, recommended, explain why, examples, what-if, then choose a sole proprietorship", async ({ browser }) => {
    const { page } = await newOwner(browser, groomer);
    await open(page, "/structure");
    await expect(page.getByRole("heading", { level: 1, name: "Business structure" })).toBeVisible();

    // The four things that get mixed up, each with an official source
    const first = page.getByRole("region", { name: "Four things that often get mixed up" });
    for (const topic of ["Ownership structure", "Business name registration", "Tax treatment", "Licenses and permits"]) {
      await expect(first.getByRole("heading", { name: topic })).toBeVisible();
    }

    // Compare side by side, with the recommended option marked
    const owned = page.getByRole("region", { name: "How it’s owned" });
    const table = owned.getByRole("table", { name: "Your options side by side" });
    await expect(table.getByRole("columnheader", { name: /Limited liability company \(LLC\) Recommended for you/ })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Sole proprietorship" })).toBeVisible();
    await expect(table.getByRole("cell", { name: /Needs confirming for Ohio/ }).first()).toBeVisible();
    await expect(owned.getByText("Worked out from your answers by fixed rules, not a legal decision.", { exact: false })).toBeVisible();

    const q1 = page.getByRole("group", { name: /Question 1 of 3/ });
    const why = await openFold(q1, "Explain why");
    await expect(why.getByRole("listitem").first()).toBeVisible();
    await expect(why.getByRole("link", { name: /Official source: SBA/ }).first()).toBeVisible();

    const detail = await openFold(owned, "Each option in detail");
    await expect(detail.getByText(/Sole proprietorship/).first()).toBeVisible();

    // What-if compares without touching saved answers
    const whatIf = await openFold(owned, "Try a what-if");
    await whatIf.getByRole("button", { name: "Add a co-owner" }).click();
    await expect(whatIf.getByRole("heading", { name: "With this what-if" })).toBeVisible();
    await expect(whatIf.getByRole("heading", { name: "With your saved answers" })).toBeVisible();
    await whatIf.getByRole("button", { name: "Back to my answers" }).click();
    await expect(whatIf.getByRole("heading", { name: "With this what-if" })).toBeHidden();

    const name = page.getByRole("region", { name: "The name you sell under" });
    const examples = await openFold(name, "Show me examples");
    await expect(examples).toContainText(/\w+/);

    // Choose a sole proprietorship, a DBA, default taxes
    await expect(page.getByRole("button", { name: "Review my choice" })).toBeDisabled();
    await choose(q1, /^Sole proprietorship/);
    await choose(page.getByRole("group", { name: /Question 2 of 3/ }), /^Register a name to sell under/);
    await choose(page.getByRole("group", { name: /Question 3 of 3/ }), /^Keep the default/);
    await page.getByRole("button", { name: "Review my choice" }).click();
    const review = page.getByRole("region", { name: "Ready to record your decision?" });
    await expect(review.getByRole("region", { name: "You’re choosing" })).toContainText("Sole proprietorship");
    // Going back keeps the answers
    await review.getByRole("button", { name: "Go back" }).click();
    await expect(page.getByRole("button", { name: "Review my choice" })).toBeEnabled();
    await recordDecision(page);
    await expect(page.getByRole("region", { name: "Decision history" })).toContainText("Sole proprietorship");

    await expect(sidebar(page).getByRole("link", { name: /^Business structure , done/ })).toBeVisible();
    await open(page, "/business");
    await expect(page.getByRole("region", { name: "Decisions" })).toContainText("Sole proprietorship");
  });

  test("candles: two owners see a partnership, and record an LLC", async ({ browser }) => {
    const { page } = await newOwner(browser, candles);
    await open(page, "/structure");
    const q1 = page.getByRole("group", { name: /Question 1 of 3/ });
    await expect(q1.getByRole("radio", { name: /^Partnership Two or more of you/ })).toBeAttached();
    await expect(q1.getByRole("radio", { name: /^Sole proprietorship/ })).toHaveCount(0);
    await choose(q1, /^Limited liability company/);
    await choose(page.getByRole("group", { name: /Question 2 of 3/ }), /^Register a name to sell under/);
    await choose(page.getByRole("group", { name: /Question 3 of 3/ }), /^Keep the default/);
    await recordDecision(page);
    await expect(page.getByRole("region", { name: "Decision history" })).toContainText("Limited liability company (LLC)");
    const history = page.getByRole("region", { name: "Decision history" });
    const basedOn = await openFold(history, "Answers it was based on");
    await expect(basedOn).toContainText("2 owners");
  });

  test("tacos: “Not sure yet” is a fine answer and leaves structure steps waiting", async ({ browser }) => {
    const { page } = await newOwner(browser, tacos);
    await open(page, "/structure");
    await choose(page.getByRole("group", { name: /Question 1 of 3/ }), /^Not sure yet/);
    await choose(page.getByRole("group", { name: /Question 2 of 3/ }), /^Not sure yet/);
    await choose(page.getByRole("group", { name: /Question 3 of 3/ }), /^Not sure yet/);
    await recordDecision(page);
    await open(page, "/business");
    await expect(page.getByRole("region", { name: "Decisions" }).getByText(/Not sure yet|Not decided yet/).first()).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /^Business structure(?! , done)/ })).toBeVisible();
  });
});
