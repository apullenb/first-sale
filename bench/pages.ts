import { texasPage } from "@/test/texas-pages";

// Research reads saved copies of the official pages, never the live sites, so every run sees the same text.
// Texas, Travis County and Austin come from src/test/texas-pages.ts; the federal pages are the stand-ins the research journey tests use.

const FEDERAL: Record<string, string> = {
  "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number":
    "<main><h1>Get an EIN</h1><p>Use this tool to get an EIN directly from the IRS in minutes for free.</p></main>",
  "https://www.irs.gov/businesses/small-businesses-self-employed/business-structures":
    "<main><h1>Business structures</h1><p>Before you register your business, choose a business structure that fits your goals.</p></main>",
  "https://www.sba.gov/counseling/launch-your-business/": `<main>${[
    ["business-structure", "Choose a business structure", "Your structure affects how much you pay in taxes."],
    ["business-name", "Choose your business name", "There are four different ways to register your business name."],
    ["register-business", "Register your business", "Most small businesses register with their state."],
    ["business-location", "Pick your business location", "Check zoning laws before you sign a lease."],
    ["licenses-permits", "Apply for licenses and permits", "Find out if you need a federal license or permit for what you do."],
    ["tax-ids", "Get federal and state tax ID numbers", "Your EIN is your federal tax ID."],
  ]
    .map(([id, heading, text]) => `<h2 id="${id}">${heading}</h2><p>${text}</p>`)
    .join("")}</main>`,
  "https://www.sba.gov/counseling/manage-your-business/": `<main><h2 id="hire-and-manage">Hire and manage employees</h2><p>Set up payroll before you hire.</p></main>`,
};

// Pages found by search that aren't saved come back unread, as an unreachable site would
export const savedPages: typeof fetch = async (input) => {
  const url = String(input instanceof Request ? input.url : input);
  if (FEDERAL[url]) return new Response(`<html><body>${FEDERAL[url]}</body></html>`, { headers: { "Content-Type": "text/html" } });
  return (await texasPage(url)) ?? new Response("Not saved for the benchmark", { status: 404 });
};
