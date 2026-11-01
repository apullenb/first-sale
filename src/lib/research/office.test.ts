import { describe, expect, it } from "vitest";
import { officeLink, orderLinks } from "./office";

const denton = { state: "TX" as const, county: "Denton County", city: "Denton", insideCityLimits: "yes" as const };
const sba = { title: "Choose your business location", url: "https://www.sba.gov/business-guide/launch-your-business/pick-your-business-location" };
const city = { title: "Development Services", url: "https://www.cityofdenton.gov/development" };
const county = { title: "Assumed Names", url: "https://www.dentoncounty.gov/assumed-names" };

describe("officeLink", () => {
  it("links only a page of the office's own government", () => {
    expect(officeLink({ level: "city", links: [sba, city] }, denton)).toEqual(city);
    expect(officeLink({ level: "city", links: [sba, county] }, denton)).toBeNull();
  });

  it("falls back to the official page the office's contacts were read on", () => {
    const contacts = { emails: [{ value: "planning@cityofdenton.gov", url: "https://www.cityofdenton.gov/contact" }], phones: [] };
    expect(officeLink({ level: "city", links: [sba], contacts }, denton)).toEqual({ title: "City of Denton: official site", url: "https://www.cityofdenton.gov/contact" });
  });

  it("never treats another city's page as this office's", () => {
    expect(officeLink({ level: "city", links: [city] }, { ...denton, city: "Aubrey" })).toBeNull();
  });
});

describe("orderLinks", () => {
  it("puts confirming pages first, then the rule's own government's", () => {
    const links = [
      { ...sba, confirms: false },
      { ...county, confirms: false },
      { ...city, confirms: true },
    ];
    expect(orderLinks(links, "county").map((link) => link.url)).toEqual([city.url, county.url, sba.url]);
  });
});
