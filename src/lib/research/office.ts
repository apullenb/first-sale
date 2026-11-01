import type { BusinessProfile, JurisdictionLevel, RequirementDraft } from "@/lib/domain";
import { jurisdictionName, type Place } from "./applicability";
import type { Contacts } from "./contacts";
import { governmentFor, governsPlace } from "./official-sites";

// Who an owner writes to about a rule: one city hall for a city's rules; otherwise the office the rule names,
// since a county's health department and its clerk are different places to write to

export interface Office {
  key: string;
  name: string;
  level: JurisdictionLevel;
}

export interface OfficeContact extends Office {
  contacts: Contacts;
  // The office's official page to start from
  site: { title: string; url: string } | null;
}

export function officeOf(requirement: Pick<RequirementDraft, "level" | "agency">, place: Place): Office {
  const agency = requirement.agency
    .trim()
    .replace(/^your county(’s|'s)?\b/i, jurisdictionName("county", place))
    .replace(/^your state(’s|'s)?\b/i, place.stateName)
    .replace(/^your city(’s|'s)?\b/i, `City of ${jurisdictionName("city", place)}`);
  const name = requirement.level === "city" ? `City of ${jurisdictionName("city", place)}` : agency || jurisdictionName(requirement.level, place);
  return { key: `${requirement.level}:${officeSlug(name)}`, name, level: requirement.level };
}

export function officeSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

type Link = { title: string; url: string };

// A page of the office's own government, as the .gov registry decides; null when none is verified
export function officeLink(
  step: { level: JurisdictionLevel; links: readonly Link[]; contacts?: Contacts | null },
  location: BusinessProfile["location"],
): Link | null {
  const ours = (url: string) => {
    const government = governmentFor(url);
    return government !== null && government.level === step.level && governsPlace(government, location) ? government : null;
  };
  const link = step.links.find((each) => ours(each.url));
  if (link) return { title: link.title, url: link.url };
  const listed = [...(step.contacts?.emails ?? []), ...(step.contacts?.phones ?? [])].find((each) => ours(each.url));
  return listed ? { title: `${ours(listed.url)!.name}: official site`, url: listed.url } : null;
}

// Pages of the step's own level of government first, then the rest in their order
export function orderLinks<T extends { url: string; confirms?: boolean }>(links: readonly T[], level: JurisdictionLevel): T[] {
  const rank = (link: T) => (link.confirms ? 0 : 2) + (governmentFor(link.url)?.level === level ? 0 : 1);
  return links.map((link, index) => ({ link, index })).sort((a, b) => rank(a.link) - rank(b.link) || a.index - b.index).map((each) => each.link);
}
