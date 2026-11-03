import { describe, expect, it } from "vitest";
import { MAX_SOURCE_CHARS, pageText, sourceTitle } from "./page-text";

const html = `<!doctype html><html><head><title>Launch your business</title><style>p{}</style></head><body>
<header><nav><a href="/">Home</a></nav></header>
<main>
  <h1>Launch</h1>
  <h2 id="name">Choose your business name</h2>
  <p>Pick a name &amp; register it.</p>
  <h3>Trademarks</h3>
  <p>Protects you at a federal level.</p>
  <script>alert("x")</script>
  <h2 id="taxes">Get tax IDs</h2>
  <p>It’s free to apply for an EIN.</p>
</main>
<footer>Footer links</footer>
</body></html>`;

describe("pageText", () => {
  it("reads the main content without scripts, menus or footers", () => {
    const { title, text } = pageText(html);
    expect(title).toBe("Launch your business");
    expect(text).toContain("Pick a name & register it.");
    expect(text).toContain("It’s free to apply for an EIN.");
    expect(text).not.toMatch(/Home|Footer|alert/);
  });

  it("reads one section for a #fragment, through its subheadings", () => {
    expect(pageText(html, "name").text?.split("\n")).toEqual([
      "Choose your business name",
      "Pick a name & register it.",
      "Trademarks",
      "Protects you at a federal level.",
    ]);
  });

  it("reads a section whose heading is wrapped in its own element", () => {
    const wrapped = `<main><section><h2 id="x">Section X</h2></section><section><p>Body of X.</p><h3>Sub</h3><p>More X.</p></section><section><h2 id="y">Section Y</h2><p>Body of Y.</p></section></main>`;
    expect(pageText(wrapped, "x").text).toBe("Section X\nBody of X.\nSub\nMore X.");
    expect(pageText(wrapped, "y").text).toBe("Section Y\nBody of Y.");
  });

  it("ignores the page's own private-use characters", () => {
    const icons = `<main><h2 id="a">Forms</h2><p>${String.fromCharCode(0xe000)} Download the form</p><p>More body.</p><h2>Next</h2></main>`;
    expect(pageText(icons, "a").text).toBe("Forms\nDownload the form\nMore body.");
  });

  it.each([
    ["main", "main"],
    ["role=main", 'div role="main"'],
  ])("stops the last section at the end of the %s content", (_name, tag) => {
    const withAside = `<body><${tag}><h2 id="last">Last</h2><p>Body.</p></${tag.split(" ")[0]}><aside><h3>Related</h3><p>Other stuff.</p></aside></body>`;
    expect(pageText(withAside, "last").text).toBe("Last\nBody.");
  });

  it("keeps an article's own header, where a linked heading can sit", () => {
    const article = `<body><header>Site banner</header><main><article><header><h2 id="x">Title</h2></header><p>Body.</p></article></main></body>`;
    expect(pageText(article, "x").text).toBe("Title\nBody.");
    expect(pageText(article).text).not.toContain("Site banner");
  });

  it.each([
    ["inside the heading", `<main><h2><a id="x"></a>Title</h2><p>Body.</p><h2>Next</h2></main>`],
    ["just before the heading", `<main><a id="x"></a><h2>Title</h2><p>Body.</p><h2>Next</h2></main>`],
  ])("finds the section from an empty anchor %s", (_name, markup) => {
    expect(pageText(markup, "x").text).toBe("Title\nBody.");
  });

  it("returns no text when the section is gone or is only a heading", () => {
    expect(pageText(html, "missing").text).toBeNull();
    expect(pageText(`<main><h2 id="empty">Empty</h2><h2>Next</h2><p>Text</p></main>`, "empty").text).toBeNull();
  });

  it("cuts long pages at a line break", () => {
    const long = `<main>${"<p>A sentence that goes on for a while.</p>".repeat(1000)}</main>`;
    const text = pageText(long).text ?? "";
    expect(text.length).toBeLessThanOrEqual(MAX_SOURCE_CHARS);
    expect(text.endsWith("A sentence that goes on for a while.")).toBe(true);
  });
});

describe("sourceTitle", () => {
  const dba = "Assumed Names\nA business that operates under a name other than its owner’s must file an assumed name certificate with the County Clerk.";
  it("prefers the page's heading when the title is about something else", () => {
    expect(sourceTitle({ title: "Debarred, Divested, or Excluded Parties", heading: "Assumed Names", text: dba })).toBe("Assumed Names");
  });

  it("keeps a title that describes the page, and replaces a generic one", () => {
    expect(sourceTitle({ title: "Assumed Name Certificates | Denton County", heading: "Assumed Names", text: dba })).toBe("Assumed Name Certificates | Denton County");
    expect(sourceTitle({ title: "Home", heading: "Assumed Names", text: dba })).toBe("Assumed Names");
    expect(sourceTitle({ title: "County Clerk", heading: "", text: dba })).toBe("County Clerk");
  });

  it("reads the main heading of a page, or of the linked section", () => {
    expect(pageText(html).heading).toBe("Launch");
    expect(pageText(html, "taxes").heading).toBe("Get tax IDs");
  });
});
