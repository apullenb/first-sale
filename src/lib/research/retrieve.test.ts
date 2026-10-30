import { describe, expect, it, vi } from "vitest";
import { textPdf } from "@/test/pdf";
import { fetchOfficialPage, retrieveSources, type SourceToRead } from "./retrieve";

const hosts = ["sba.gov"];
const page = (body: string, init: ResponseInit = {}) =>
  new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=UTF-8" }, ...init });
const redirect = (location: string) => new Response(null, { status: 301, headers: { Location: location } });

describe("fetchOfficialPage", () => {
  it("follows redirects on approved hosts and records the final URL", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(redirect("/new-path"))
      .mockResolvedValueOnce(page("<main><p>Hello</p></main>"));

    const result = await fetchOfficialPage("https://www.sba.gov/old", hosts, fetchImpl);
    expect(result).toMatchObject({ ok: true, finalUrl: "https://www.sba.gov/new-path" });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("refuses redirects to hosts that aren't approved", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(redirect("https://sba.gov.example.com/page"));
    expect(await fetchOfficialPage("https://www.sba.gov/old", hosts, fetchImpl)).toEqual({
      ok: false,
      reason: "Redirected to a site that isn’t approved",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never fetches a page off the approved hosts", async () => {
    const fetchImpl = vi.fn();
    expect((await fetchOfficialPage("https://example.com/", hosts, fetchImpl)).ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stops after too many redirects", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => redirect("/again"));
    expect(await fetchOfficialPage("https://www.sba.gov/", hosts, fetchImpl)).toEqual({ ok: false, reason: "Too many redirects" });
  });

  it.each([
    ["an error status", new Response("gone", { status: 404 }), "The site answered with error 404"],
    ["a file that isn't a web page", new Response("%PDF", { headers: { "Content-Type": "application/pdf" } }), "The link isn’t a web page"],
    ["a page that's too large", page("x".repeat(3_000_001)), "The page is too large"],
  ])("rejects %s", async (_name, response, reason) => {
    expect(await fetchOfficialPage("https://www.sba.gov/", hosts, vi.fn().mockResolvedValue(response))).toEqual({
      ok: false,
      reason,
    });
  });

  it("reports sites it can't reach", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    expect(await fetchOfficialPage("https://www.sba.gov/", hosts, fetchImpl)).toEqual({
      ok: false,
      reason: "Couldn’t reach the site",
    });
  });
});

describe("retrieveSources", () => {
  const html = `<main><h2 id="a">Section A</h2><p>About A.</p><h2 id="b">Section B</h2><p>About B.</p></main>`;
  const source = (id: string, url: string, overrides: Partial<SourceToRead> = {}): SourceToRead => ({
    id,
    title: id,
    url,
    level: "federal",
    allowedHosts: hosts,
    government: "Small Business Administration",
    discovered: false,
    ...overrides,
  });
  const read = { government: "Small Business Administration", discovered: false };

  it("reads a page once for several sections, keeping each section's link", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => page(html));
    const now = new Date("2026-10-26T12:00:00Z");

    const { pages, unread } = await retrieveSources(
      [source("a", "https://www.sba.gov/launch/#a"), source("b", "https://www.sba.gov/launch/#b")],
      fetchImpl,
      now,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(unread).toEqual([]);
    expect(pages).toEqual([
      { id: "a", title: "a", url: "https://www.sba.gov/launch/#a", level: "federal", ...read, text: "Section A\nAbout A.", retrievedAt: now.toISOString(), contacts: { emails: [], phones: [] } },
      { id: "b", title: "b", url: "https://www.sba.gov/launch/#b", level: "federal", ...read, text: "Section B\nAbout B.", retrievedAt: now.toISOString(), contacts: { emails: [], phones: [] } },
    ]);
  });

  it("counts a section that's gone from the page as unread", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => page(html));
    const { pages, unread } = await retrieveSources([source("c", "https://www.sba.gov/launch/#c")], fetchImpl);
    expect(pages).toEqual([]);
    expect(unread[0].reason).toBe("The linked section isn’t on the page anymore");
  });

  it("lists the pages it couldn't read, with the reason", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    const { pages, unread } = await retrieveSources([source("a", "https://www.sba.gov/x")], fetchImpl);
    expect(pages).toEqual([]);
    expect(unread).toEqual([{ id: "a", title: "a", url: "https://www.sba.gov/x", reason: "The site answered with error 503", level: "federal" }]);
  });

  it("keeps a found page's government and level, and that it was discovered", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => page("<main><p>City business licenses.</p></main>"));
    const { pages } = await retrieveSources(
      [source("city-license-1", "https://www.columbus.gov/license", { level: "city", allowedHosts: ["columbus.gov"], government: "City of Columbus", discovered: true })],
      fetchImpl,
    );
    expect(pages[0]).toMatchObject({ level: "city", government: "City of Columbus", discovered: true, text: "City business licenses." });
  });

  it("reads the text of an official PDF, even one sent as a generic file", async () => {
    const pdf = await textPdf([["Home occupation permit", "The permit fee is $25."]]);
    const fetchImpl = vi.fn().mockResolvedValue(new Response(pdf, { headers: { "Content-Type": "application/octet-stream" } }));
    const { pages, unread } = await retrieveSources([source("permit", "https://www.sba.gov/permit.pdf")], fetchImpl);
    expect(unread).toEqual([]);
    expect(pages[0]).toMatchObject({ url: "https://www.sba.gov/permit.pdf", text: "Home occupation permit\nThe permit fee is $25." });
    expect(fetchImpl.mock.calls[0][1].headers.Accept).toBe("text/html, application/pdf");
  });

  it("counts a file that claims to be a PDF but isn't as unread", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>nope</html>", { headers: { "Content-Type": "application/pdf" } }));
    const { pages, unread } = await retrieveSources([source("fake", "https://www.sba.gov/fake.pdf")], fetchImpl);
    expect(pages).toEqual([]);
    expect(unread[0].reason).toBe("The file isn’t a PDF");
  });

  it("counts a PDF with no text as unread", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(await textPdf([[]]), { headers: { "Content-Type": "application/pdf" } }));
    const { unread } = await retrieveSources([source("scan", "https://www.sba.gov/scan.pdf")], fetchImpl);
    expect(unread[0].reason).toBe("The page had no readable text");
  });
});
