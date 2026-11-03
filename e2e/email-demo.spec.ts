import { expect, test } from "@playwright/test";
import { open, sidebar, signUp, uniqueEmail } from "./support";

test("email demo: links land there, sample emails become orders and replies, nothing saved", async ({ browser }) => {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  await signUp(page, "Dana Baker", uniqueEmail("email-demo"));

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

  await expect(page.getByRole("region", { name: "Coming soon" })).toContainText("Forwarding customer emails to SnapStart is coming soon.");
  const address = page.getByRole("region", { name: "Your SnapStart email address" });
  await expect(address.getByLabel("Sample SnapStart address")).toHaveText("maple-crumb+sample@inbound.example");
  await address.getByRole("button", { name: "Copy address" }).click();
  await expect(address.getByRole("button", { name: "Copied!" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("maple-crumb+sample@inbound.example");
  await page.getByRole("tab", { name: "Forward automatically" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Add a forwarding address");

  const inbox = page.getByRole("region", { name: "Customer inbox" });
  await expect(inbox.getByRole("article")).toHaveCount(4);
  await expect(inbox.getByRole("article").first()).toContainText("Sample");
  await inbox.getByRole("button", { name: "Read new emails" }).click();
  await expect(inbox).toContainText("Read 4 sample emails");

  const order = inbox.getByRole("article", { name: "2 dozen chocolate chip cookies" });
  await expect(order).toContainText("Order");
  await expect(order).toContainText("DEMO");
  await expect(order).toContainText("Pickup Saturday, about 10 am");
  await order.getByRole("button", { name: "Review and confirm" }).click();
  await expect(order).toContainText("Added to Orders & jobs");
  const orders = page.getByRole("region", { name: "Orders & jobs", exact: true });
  await expect(orders).toContainText("DEMO · 2 dozen chocolate chip cookies");
  await expect(orders).toContainText("Confirmed");

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

  await page.getByRole("button", { name: "Start the demo over" }).click();
  await expect(inbox.getByRole("button", { name: "Read new emails" })).toBeVisible();
  await expect(orders).toContainText("Confirm an order or request above");
  await context.close();
});
