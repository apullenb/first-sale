import { describe, expect, it } from "vitest";
import { mergeContacts, pageContacts } from "./contacts";

const URL = "https://www.aubreytx.gov/contact";

describe("pageContacts", () => {
  it("reads linked and printed addresses and numbers, footer included", () => {
    const html = `<main><p>Questions? Call (940) 555-0101.</p></main>
      <footer><a href="mailto:Permits@AubreyTX.gov?subject=Hi">Email us</a> · 940.555.0102 · <a href="tel:+19405550101">Call</a>
      <img src="logo@2x.png"> clerk&#64;aubreytx.gov</footer>`;
    expect(pageContacts(html, URL)).toEqual({
      emails: [
        { value: "permits@aubreytx.gov", url: URL },
        { value: "clerk@aubreytx.gov", url: URL },
      ],
      phones: [
        { value: "(940) 555-0101", url: URL },
        { value: "(940) 555-0102", url: URL },
      ],
    });
  });

  it("skips script text and things that only look like numbers", () => {
    const html = `<script>var x = "fake@example.com"; var n = "214-555-0199";</script><p>Ordinance 2023-555-1234 and ZIP 76227-1234</p>`;
    expect(pageContacts(html, URL)).toEqual({ emails: [], phones: [] });
  });

  it("merges an office's pages without repeats", () => {
    const a = pageContacts(`<a href="mailto:a@x.gov">a</a> (940) 555-0101`, URL);
    const b = pageContacts(`<a href="mailto:a@x.gov">a</a> <a href="mailto:b@x.gov">b</a>`, "https://x.gov/b");
    expect(mergeContacts([a, b]).emails.map((each) => each.value)).toEqual(["a@x.gov", "b@x.gov"]);
  });
});
