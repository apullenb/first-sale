import type { BusinessProfile, JurisdictionLevel, PlanTopic, VerificationState } from "@/lib/domain";
import type { Place } from "./applicability";
import type { SearchGap } from "./discover";
import type { SOURCE_TOPICS } from "./source-pack";

// What each research category found at each level of government, so a gap reads as "not checked", never "nothing applies".

export const RESEARCH_CATEGORIES = ["formation", "tax", "licenses", "zoning", "food", "activity"] as const;
export type ResearchCategory = (typeof RESEARCH_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ResearchCategory, string> = {
  formation: "Business structure and name",
  tax: "Tax accounts and sales tax",
  licenses: "Business and industry licenses",
  zoning: "Zoning and working from home",
  food: "Making and selling food",
  activity: "Other requirements for what you make",
};

export const COVERAGE_STATES = [
  "confirmed",
  "read_unconfirmed",
  "unreadable",
  "no_official_page",
  "search_failed",
  "not_searched",
  "place_unknown",
] as const;
export type CoverageState = (typeof COVERAGE_STATES)[number];

export const COVERAGE_LABELS: Record<CoverageState, string> = {
  confirmed: "Official page confirms at least one requirement",
  read_unconfirmed: "Official pages read, but none confirmed a requirement",
  unreadable: "The official site didn’t let SnapStart read it",
  no_official_page: "No official page found",
  search_failed: "Search didn’t finish",
  not_searched: "Not searched yet",
  place_unknown: "Needs your place first",
};

export interface CoverageCell {
  category: ResearchCategory;
  level: JurisdictionLevel;
  state: CoverageState;
  // Official pages read for this cell
  pagesRead: number;
}

type SourceTopic = (typeof SOURCE_TOPICS)[number];

const SOURCE_CATEGORY: Record<SourceTopic, ResearchCategory> = {
  business_structure: "formation",
  name_registration: "formation",
  tax_registration: "tax",
  employer_id: "tax",
  employment: "tax",
  licenses_permits: "licenses",
  zoning: "zoning",
  food_safety: "food",
  activity: "activity",
};

export function categoriesOfTopics(topics: readonly SourceTopic[]): ResearchCategory[] {
  return [...new Set(topics.map((topic) => SOURCE_CATEGORY[topic]))];
}

const FOOD_WORDS = /food|bak|cottage|kitchen|health|label/i;

export function categoryOf(requirement: { topic: PlanTopic; title: string; key: string }): ResearchCategory {
  switch (requirement.topic) {
    case "structure":
    case "name_registration":
      return "formation";
    case "tax_registration":
    case "employer":
      return "tax";
    case "location_zoning":
      return "zoning";
    case "license_permit":
      return FOOD_WORDS.test(`${requirement.key} ${requirement.title}`) ? "food" : "licenses";
    default:
      return "activity";
  }
}

// Which categories and levels matter for this business
export function relevantCells(profile: BusinessProfile): { category: ResearchCategory; level: JurisdictionLevel }[] {
  const cells: { category: ResearchCategory; level: JurisdictionLevel }[] = [
    { category: "formation", level: "federal" },
    { category: "formation", level: "state" },
    { category: "tax", level: "federal" },
    { category: "tax", level: "state" },
    { category: "licenses", level: "federal" },
    { category: "licenses", level: "state" },
    { category: "licenses", level: "county" },
    { category: "licenses", level: "city" },
    { category: "zoning", level: "city" },
  ];
  if (profile.offeringKinds.includes("food")) cells.push({ category: "food", level: "state" }, { category: "food", level: "county" });
  // "Not sure" keeps the row, so the gap shows instead of disappearing
  const maybe = (answer: string | null) => answer === "yes" || answer === "unsure";
  const special =
    maybe(profile.makesForKids) ||
    maybe(profile.foodContact) ||
    maybe(profile.servicesLicensed) ||
    profile.inventorySources.some((source) => source === "secondhand" || source === "consignment" || source === "unsure");
  if (special) cells.push({ category: "activity", level: "federal" }, { category: "activity", level: "state" });
  return cells;
}

interface CoverageInput {
  profile: BusinessProfile;
  place: Place;
  searched: boolean;
  gaps: readonly SearchGap[];
  pages: readonly { level: JurisdictionLevel; categories?: readonly ResearchCategory[] }[];
  unread: readonly { level?: JurisdictionLevel; categories?: readonly ResearchCategory[] }[];
  requirements: readonly { topic: PlanTopic; title: string; key: string; level: JurisdictionLevel; verification: VerificationState }[];
}

export function coverageFor(input: CoverageInput): CoverageCell[] {
  return relevantCells(input.profile).map(({ category, level }) => {
    const inCell = (item: { level?: JurisdictionLevel; categories?: readonly ResearchCategory[] }) =>
      item.level === level && (item.categories ?? []).includes(category);
    const pagesRead = input.pages.filter(inCell).length;
    const confirmed = input.requirements.some(
      (requirement) => requirement.level === level && requirement.verification === "sourced" && categoryOf(requirement) === category,
    );
    const gap = input.gaps.find((each) => each.level === level && each.category === category);
    let state: CoverageState;
    if ((level === "county" && !input.place.county) || (level === "city" && !input.place.city)) state = "place_unknown";
    else if (confirmed) state = "confirmed";
    else if (pagesRead) state = "read_unconfirmed";
    else if (input.unread.some(inCell)) state = "unreadable";
    else if (gap && input.searched) state = gap.failed ? "search_failed" : "no_official_page";
    else state = "not_searched";
    return { category, level, state, pagesRead };
  });
}
