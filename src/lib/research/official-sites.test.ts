import { describe, expect, it } from "vitest";
import type { BusinessProfile } from "@/lib/domain";
import { type Government, governmentFor, governsPlace, REGISTRY_AS_OF, VETTED_SITES } from "./official-sites";

const place = (state: BusinessProfile["location"]["state"], county = "", city = ""): BusinessProfile["location"] => ({
  state,
  county,
  city,
  insideCityLimits: null,
});

const gov = (url: string): Government => {
  const government = governmentFor(url);
  if (!government) throw new Error(`${url} isn't in the registry`);
  return government;
};

describe("governmentFor", () => {
  it("finds registry domains at every level", () => {
    expect(governmentFor("https://www.irs.gov/businesses")).toEqual({
      domain: "irs.gov",
      level: "federal",
      name: "Internal Revenue Service (Department of the Treasury)",
      city: "Washington",
      state: "DC",
    });
    expect(governmentFor("https://ohio.gov/")).toMatchObject({ domain: "ohio.gov", level: "state", state: "OH" });
    expect(governmentFor("https://franklincountyohio.gov/")).toMatchObject({ level: "county", state: "OH" });
    expect(governmentFor("https://www.columbus.gov/")).toMatchObject({ level: "city", name: "City of Columbus", city: "Columbus" });
  });

  it("covers subdomains of a registry domain, in any case", () => {
    expect(governmentFor("https://business.ohio.gov/start")?.domain).toBe("ohio.gov");
    expect(governmentFor("https://a.b.COLUMBUS.GOV/x")?.domain).toBe("columbus.gov");
  });

  it("only takes https", () => {
    expect(governmentFor("http://www.irs.gov/")).toBeNull();
    expect(governmentFor("ftp://irs.gov/")).toBeNull();
  });

  it("gives null for hosts that aren't registry .gov domains", () => {
    expect(governmentFor("https://irs.gov.example.com/")).toBeNull();
    expect(governmentFor("https://www.columbus.org/")).toBeNull();
    expect(governmentFor("https://not-a-registered-domain-xyz.gov/")).toBeNull();
    expect(governmentFor("https://gov/")).toBeNull();
    expect(governmentFor("not a url")).toBeNull();
    expect(governmentFor("")).toBeNull();
  });

  it("says when the registry was taken", () => {
    expect(Number.isNaN(Date.parse(REGISTRY_AS_OF))).toBe(false);
  });
});

describe("governsPlace", () => {
  const ohio = place("OH", "Franklin", "Columbus");

  it("always counts the federal government", () => {
    expect(governsPlace(gov("https://irs.gov"), ohio)).toBe(true);
    expect(governsPlace(gov("https://sba.gov"), place("CA"))).toBe(true);
  });

  it("needs the owner's own state", () => {
    expect(governsPlace(gov("https://ohio.gov"), ohio)).toBe(true);
    expect(governsPlace(gov("https://ohio.gov"), place("MI", "Franklin", "Columbus"))).toBe(false);
    expect(governsPlace(gov("https://ca.gov"), ohio)).toBe(false);
  });

  it("matches a county by name, with or without the word County", () => {
    const franklin = gov("https://franklincountyohio.gov");
    expect(governsPlace(franklin, place("OH", "Franklin"))).toBe(true);
    expect(governsPlace(franklin, place("OH", "Franklin County"))).toBe(true);
    expect(governsPlace(franklin, place("OH", "  franklin county "))).toBe(true);
  });

  it("refuses another county, a county in another state, and a missing county", () => {
    const franklin = gov("https://franklincountyohio.gov");
    expect(governsPlace(gov("https://delawarecountyohio.gov"), place("OH", "Franklin"))).toBe(false);
    expect(governsPlace(franklin, place("OH", "Delaware"))).toBe(false);
    expect(governsPlace(gov("https://franklincountypa.gov"), place("OH", "Franklin"))).toBe(false);
    expect(governsPlace(gov("https://franklincountyva.gov"), place("OH", "Franklin County"))).toBe(false);
    expect(governsPlace(franklin, place("OH", ""))).toBe(false);
  });

  it("matches a city by the registry's city or by its name", () => {
    expect(governsPlace(gov("https://columbus.gov"), place("OH", "", "Columbus"))).toBe(true);
    expect(governsPlace(gov("https://columbus.gov"), place("OH", "", "columbus"))).toBe(true);
    // Registry city is Dublin; name is "City of Dublin, Ohio"
    expect(governsPlace(gov("https://dublinohiousa.gov"), place("OH", "", "Dublin"))).toBe(true);
    // "St" and "Saint" are the same
    expect(governsPlace(gov("https://stlouis-mo.gov"), place("MO", "", "Saint Louis"))).toBe(true);
    expect(governsPlace(gov("https://stpaul.gov"), place("MN", "", "St. Paul"))).toBe(true);
  });

  it("refuses another city, the same city name in another state, and a missing city", () => {
    expect(governsPlace(gov("https://columbus.gov"), place("OH", "", "Dublin"))).toBe(false);
    expect(governsPlace(gov("https://columbusga.gov"), place("OH", "", "Columbus"))).toBe(false);
    expect(governsPlace(gov("https://columbus.gov"), place("OH", "Franklin", ""))).toBe(false);
  });

  // The registry's city column is where the office gets mail, not the place it governs
  it("doesn't take another municipality for the owner's city because it gets mail there", () => {
    // Village of Minerva Park and Franklin Township both list Columbus as their city
    expect(governsPlace(gov("https://minervapark.gov"), place("OH", "Franklin", "Columbus"))).toBe(false);
    expect(governsPlace(gov("https://franklin-townshipohio.gov"), place("OH", "Franklin", "Columbus"))).toBe(false);
    // Jackson Township lists Grove City
    expect(governsPlace(gov("https://jacksontwpfranklinoh.gov"), place("OH", "Franklin", "Grove City"))).toBe(false);
  });

  // A township that shares the city's name is a different government
  it("doesn't take a same-named township in another county for the owner's city", () => {
    // Franklin Township, Columbiana County, for an owner in the City of Franklin (Warren County)
    expect(governsPlace(gov("https://franklintwpcoloh.gov"), place("OH", "Warren", "Franklin"))).toBe(false);
  });
});

describe("vetted sites outside .gov", () => {
  it("counts a vetted government site and its subdomains as official, for its own place only", () => {
    expect(governmentFor("https://www.denvergov.org/Government/Agencies-Departments-Offices/Business-Licensing")).toMatchObject({ domain: "denvergov.org", level: "city", state: "CO" });
    expect(governmentFor("https://efile.sunbiz.org/fict_filing.html")).toMatchObject({ domain: "sunbiz.org", level: "state", state: "FL" });
    const denver = governmentFor("https://www.denvergov.org/x")!;
    expect(governsPlace(denver, { state: "CO", county: "Denver County", city: "Denver", insideCityLimits: "yes" })).toBe(true);
    expect(governsPlace(denver, { state: "CO", county: "Arapahoe County", city: "Aurora", insideCityLimits: "yes" })).toBe(false);
    const gallatin = governmentFor("https://www.healthygallatin.org/environmental-health/")!;
    expect(governsPlace(gallatin, { state: "MT", county: "Gallatin County", city: "Bozeman", insideCityLimits: "yes" })).toBe(true);
    expect(governsPlace(governmentFor("https://multco.us/assessment-taxation")!, { state: "OR", county: "Multnomah County", city: "Portland", insideCityLimits: "yes" })).toBe(true);
  });

  it("never counts a lookalike, a plain-http link, or a site off the list", () => {
    expect(governmentFor("https://denvergov.org.example.com/")).toBeNull();
    expect(governmentFor("https://notdenvergov.org/")).toBeNull();
    expect(governmentFor("http://www.denvergov.org/")).toBeNull();
    expect(governmentFor("https://www.flrules.org/")).toBeNull();
  });

  it("records a .gov page as proof for every vetted site", () => {
    for (const site of VETTED_SITES) {
      expect(governmentFor(site.proof)?.domain, site.domain).toMatch(/\.gov$/);
      expect(site.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
