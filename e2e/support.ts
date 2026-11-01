import { deflateSync } from "node:zlib";
import { type Browser, expect, type Locator, type Page } from "@playwright/test";
import type { Scenario } from "./scenarios";

export const PASSWORD = "correct horse battery staple";

let counter = 0;
export function uniqueEmail(tag: string): string {
  counter += 1;
  return `${tag}-${Date.now()}-${process.pid}-${counter}@example.test`;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function startsWith(text: string): RegExp {
  return new RegExp(`^${escape(text)}`);
}

// Loads a page and waits for it to settle, so clicks land after hydration
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

export async function signUp(page: Page, name: string, email: string, password = PASSWORD) {
  await open(page, "/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/business/new");
  await page.waitForLoadState("networkidle");
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await open(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

export async function logOut(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/login");
}

// Clicks a choice tile inside a question group, unless it's already on
export async function pick(group: Locator, option: string) {
  let button = group.getByRole("button", { name: option, exact: true });
  if (!(await button.count())) button = group.getByRole("button", { name: startsWith(option) });
  await expect(button.first(), `option “${option}”`).toBeVisible();
  if ((await button.first().getAttribute("aria-pressed")) !== "true") await button.first().click();
}

// Answers every choice question shown on the current part, including follow-ups that appear
async function answerGroups(page: Page, answers: Record<string, string[]>) {
  for (let round = 0; round < 8; round++) {
    const groups = page.locator("main [role=group]").filter({ visible: true, has: page.locator("button[aria-pressed]") });
    let acted = false;
    for (const group of await groups.all()) {
      const name = ((await group.getAttribute("aria-label")) ?? (await labelledBy(group)) ?? "").trim();
      const key = Object.keys(answers).find((title) => name.startsWith(title));
      const pressed = await group.locator("button[aria-pressed=true]").count();
      if (!key) {
        if (!pressed) throw new Error(`No scenario answer for intake question “${name}”`);
        continue;
      }
      for (const option of answers[key]) {
        const before = await group.locator("button[aria-pressed=true]").count();
        await pick(group, option);
        if ((await group.locator("button[aria-pressed=true]").count()) !== before) acted = true;
      }
    }
    if (!acted) return;
  }
}

async function labelledBy(group: Locator): Promise<string | null> {
  const ids = await group.getAttribute("aria-labelledby");
  if (!ids) return null;
  return group.evaluate((el, list) => list.split(" ").map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "").join(" "), ids);
}

export async function pickPlace(page: Page, box: string, value: string) {
  const input = page.getByRole("combobox", { name: box });
  if ((await input.inputValue()).startsWith(value)) return;
  await input.fill(value);
  await page.getByRole("option", { name: startsWith(value) }).first().click();
}

// Walks the intake wizard with the scenario's answers and confirms the summary
export async function completeIntake(page: Page, s: Scenario, { confirm = true } = {}) {
  if (!page.url().includes("/business/new")) await open(page, "/business/new");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("What kind of business is it?");

  await page.getByRole("button", { name: startsWith(s.kind) }).click();
  const sells = page.getByRole("group", { name: "What will you sell? Pick any." });
  for (const item of s.sells) await sells.getByRole("button", { name: item, exact: true }).click();
  if (s.specialty) await page.getByLabel("Anything else, or your specialty? (optional)").fill(s.specialty);

  for (let part = 0; part < 14; part++) {
    const title = (await heading.textContent()) ?? "";
    if (title === "Check your business summary") break;

    if (title === "Where will your business be?") {
      await pickPlace(page, "State", s.place.state);
      await pickPlace(page, "City or town", s.place.city);
      await pickPlace(page, "County", s.place.county);
    }
    if (title === "Who owns it?") {
      await pick(page.getByRole("group", { name: "Who owns it?" }), s.otherOwners ? "Me and other people" : "Just me");
    }
    if (title === "What’s it called?") await page.getByRole("textbox", { name: "Business name" }).fill(s.businessName);
    if (title === "Timing and goals") {
      if (s.launchDate) await page.getByRole("textbox", { name: "What’s your goal launch date?" }).fill(s.launchDate);
      else await page.getByText("I don’t have a date yet").click();
    }
    await answerGroups(page, s.answers);

    await page.getByRole("button", { name: /^(Continue|See my summary)$/ }).click();
    await expect(heading).not.toHaveText(title);
  }

  await expect(heading).toHaveText("Check your business summary");
  if (!confirm) return;
  await page.getByRole("button", { name: "This is right. Continue" }).click();
  await page.waitForURL("**/business?welcome=1");
  await expect(page.getByRole("heading", { level: 1, name: s.businessName })).toBeVisible();
}

export interface Owner {
  page: Page;
  email: string;
}

// A fresh owner for one scenario: own browser context, signed up and through the intake
export async function newOwner(browser: Browser, s: Scenario, tag: string = s.key): Promise<Owner> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail(tag);
  await signUp(page, s.ownerName, email);
  await completeIntake(page, s);
  return { page, email };
}

// Every practice-mode banner says this, so AI output is never mistaken for real
export async function expectPracticeBanner(page: Page) {
  await expect(page.getByRole("main").getByText("Practice mode.", { exact: true }).first()).toBeVisible();
}

export const PRACTICE_PREVIEW = "Practice preview, not made by AI";

export function sidebar(page: Page): Locator {
  return page.getByRole("navigation", { name: "Sections" });
}

// Opens a <details> fold by its summary text and returns it
export async function openFold(scope: Locator | Page, summary: string | RegExp): Promise<Locator> {
  const root = "goto" in scope ? scope : scope.page();
  const fold = scope.locator("details").filter({ has: root.locator("summary").filter({ hasText: summary }) }).last();
  if (!(await fold.evaluate((el) => (el as HTMLDetailsElement).open))) await fold.locator("summary").first().click();
  return fold;
}

// Picks a styled radio by its label; the real input is visually hidden
export async function choose(scope: Locator | Page, name: string | RegExp) {
  await scope.getByRole("radio", { name }).first().check({ force: true });
}

// Records the three structure answers on /structure
export async function decideStructure(page: Page, ownership: RegExp, name = /^Register a name to sell under/, tax = /^Keep the default/) {
  await open(page, "/structure");
  await choose(page.getByRole("group", { name: /Question 1 of 3/ }), ownership);
  await choose(page.getByRole("group", { name: /Question 2 of 3/ }), name);
  await choose(page.getByRole("group", { name: /Question 3 of 3/ }), tax);
  await page.getByRole("button", { name: "Review my choice" }).click();
  await page.getByRole("button", { name: "Record my decision" }).click();
  await expect(page.getByRole("region", { name: "Decision history" }).getByRole("listitem").first()).toBeVisible();
}

// Records a step as done before SnapStart ("I’ve already done this"), so the steps after it open up
export async function markStepDone(page: Page, title: RegExp) {
  await open(page, "/start");
  await page.getByRole("link", { name: title }).first().click();
  await page.waitForURL("**/checklist/**");
  await expectPracticeBanner(page);
  await page.getByRole("button", { name: "I’ve already done this" }).click();
  const already = page.getByRole("region", { name: "Already done" });
  await already.locator("input[type=file]").setInputFiles({ name: "filed.pdf", mimeType: "application/pdf", buffer: pdfBuffer("Filed") });
  await already.getByText("I finished this step myself, before or outside SnapStart.").click();
  await already.getByRole("button", { name: "Mark it done" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Done: / })).toBeAttached();
}

// Opens What applies to you and waits for the practice-mode check to finish
export async function checkRequirements(page: Page) {
  await open(page, "/requirements");
  const done = page.getByRole("button", { name: "Check again" });
  const retry = page.getByRole("button", { name: "Try again" });
  // Practice mode still reads the live official pages; a failed fetch offers “Try again”
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(done.or(retry)).toBeVisible({ timeout: 120_000 });
    if (await done.isVisible()) return;
    await retry.click();
  }
  await expect(done).toBeVisible({ timeout: 120_000 });
}

// Picks brand words and colors on /brand, describes the brand and approves it (one AI request)
export async function approveBrand(page: Page, s: Scenario) {
  await open(page, "/brand");
  const feel = page.getByRole("region", { name: "Step 2: How should your brand feel?" });
  for (const word of s.brand.words) await feel.getByRole("button", { name: word, exact: true }).click();
  for (const color of s.brand.colors) await feel.getByRole("button", { name: color, exact: true }).click();
  await feel.getByRole("button", { name: "Describe my brand" }).click();
  const description = page.getByRole("region", { name: "Step 3: Your brand description" });
  await description.getByRole("button", { name: "This feels like my business" }).click({ timeout: 60_000 });
  await expect(page.getByRole("region", { name: "You approved your brand description" })).toBeVisible();
}

// Saves one field under “Business details” on /business
export async function saveDetail(page: Page, label: string, value: string) {
  const details = page.getByRole("region", { name: "Business details" });
  await details.getByRole("button", { name: `Add ${label}` }).click();
  const field = details.getByRole("textbox", { name: label });
  await field.fill(value);
  await details.getByRole("button", { name: "Save" }).click();
  await expect(field).toBeHidden();
}

// A small solid-color PNG, encoded in memory
export function pngBuffer(size = 64, rgb: [number, number, number] = [180, 90, 40]): Buffer {
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// A one-page PDF with real text, small enough to build inline
export function pdfBuffer(text = "Application for a mobile vendor permit. Business name: ______ Owner name: ______"): Buffer {
  const stream = `BT /F1 12 Tf 40 740 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
