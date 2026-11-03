import { expect, test } from "@playwright/test";
import { groomer } from "./scenarios";
import { completeIntake, open, sidebar, signUp, uniqueEmail } from "./support";

test("email demo: links land there, confirmed samples become DEMO orders, start over removes only them", async ({ browser }) => {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  await signUp(page, groomer.ownerName, uniqueEmail("email-demo"));
  await completeIntake(page, groomer);

  // A real job, which starting the demo over must leave alone
  await open(page, "/orders");
  await page.getByRole("button", { name: "Add job", exact: true }).click();
  const entry = page.getByRole("region", { name: "New service job" });
  await entry.getByLabel("Customer name", { exact: true }).fill("Jo");
  await entry.getByLabel("What is the job?").fill("Groom Bailey");
  await entry.getByRole("button", { name: "Save order or job" }).click();
  const real = page.getByRole("button").filter({ hasText: "Groom Bailey" });
  await expect(real).toBeVisible();

  await open(page, "/run");
  await expect(page.getByText("Additional features coming soon!")).toBeVisible();
  const card = page.getByRole("region", { name: "Customer email" });
  await expect(card).toContainText("Coming soon · try the demo");
  await card.getByRole("link", { name: "Try the email demo" }).click();
  await page.waitForURL("**/email/demo");

  await open(page, "/run");
  const nav = sidebar(page);
  await nav.getByRole("link", { name: "Connect your email" }).click();
  await page.waitForURL("**/email/demo");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("region", { name: "Coming soon" })).toContainText("Connecting your email is coming soon.");
  await expect(page.getByRole("region", { name: "Your connected inbox" })).toContainText("Connected");
  await expect(page.getByText("Your SnapStart email address")).toHaveCount(0);

  const inbox = page.getByRole("region", { name: "Customer inbox" });
  await expect(inbox.getByRole("article")).toHaveCount(9);
  await expect(inbox.getByRole("article").first()).toContainText("Sample");
  await inbox.getByRole("button", { name: "Read new emails" }).click();
  await expect(inbox).toContainText("Read 9 sample emails");

  await expect(inbox.getByRole("article", { name: "150 wedding favor cookies" })).toContainText("Quote request");
  const shipping = inbox.getByRole("article", { name: "Shipping update for order #1043" });
  await expect(shipping).toContainText("Shipping update");
  await expect(shipping.getByRole("button", { name: "Review and confirm" })).toHaveCount(0);
  await expect(inbox.getByRole("article", { name: "Vegan and gluten-free options" })).toContainText("Question");

  const order = inbox.getByRole("article", { name: "2 dozen chocolate chip cookies" });
  await expect(order).toContainText("Order");
  await expect(order).toContainText("DEMO");
  await expect(order).toContainText("Pickup Saturday, about 10 am");
  await order.getByRole("button", { name: "Review and confirm" }).click();
  await expect(order).toContainText("Added to Orders & jobs");
  await expect(order.getByRole("button", { name: "Review and confirm" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Orders & jobs", exact: true })).toHaveCount(0);
  const quote = inbox.getByRole("article", { name: "150 wedding favor cookies" });
  await quote.getByRole("button", { name: "Review and confirm" }).click();
  await expect(quote).toContainText("Added to Orders & jobs");

  await order.getByLabel(/Your reply/).fill("Hi Dana,\nSee you Saturday!");
  await order.getByRole("button", { name: "Reply in your email" }).click();
  const preview = order.getByRole("region", { name: "Email preview" });
  await expect(preview).toContainText("dana.whitfield@example.com");
  await expect(preview).toContainText("Re: Order for Saturday pickup: 2 dozen chocolate chip cookies");
  await expect(preview).toContainText("See you Saturday!");
  await order.getByRole("button", { name: "Copy reply" }).click();
  await expect(order).toContainText("Copied. Paste it into your reply.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Hi Dana,\nSee you Saturday!");
  await order.getByRole("button", { name: "I sent it" }).click();
  await expect(order).toContainText("Sent from your email (demo)");

  await order.getByRole("link", { name: "Open Orders & jobs" }).click();
  await page.waitForURL("**/orders");
  const cookies = page.getByRole("button").filter({ hasText: "2 dozen chocolate chip cookies" });
  const favors = page.getByRole("button").filter({ hasText: "150 wedding favor cookies" });
  await expect(cookies).toContainText("DEMO");
  await expect(cookies).toContainText("From email");
  await expect(favors).toContainText("DEMO");
  await expect(favors).toContainText("Needs review");
  await cookies.click();
  const detail = page.getByRole("region", { name: "2 dozen chocolate chip cookies", exact: true });
  await expect(detail).toContainText("When: Pickup Saturday, about 10 am");
  await expect(detail.getByText("Record payment or refund")).toHaveCount(0);
  await detail.getByRole("button", { name: "Mark making" }).click();
  await expect(cookies).toContainText("Making");

  await open(page, "/email/demo");
  await inbox.getByRole("button", { name: "Read new emails" }).click();
  await expect(order).toContainText("Added to Orders & jobs");
  await page.getByRole("button", { name: "Start the demo over" }).click();
  await expect(inbox.getByRole("button", { name: "Read new emails" })).toBeVisible();
  await inbox.getByRole("button", { name: "Read new emails" }).click();
  await expect(order.getByRole("button", { name: "Review and confirm" })).toBeVisible();

  await open(page, "/orders");
  await expect(real).toBeVisible();
  await expect(cookies).toHaveCount(0);
  await expect(favors).toHaveCount(0);
  await context.close();
});
