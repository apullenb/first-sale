import type { JurisdictionLevel, RequirementDraft } from "@/lib/domain";
import { jurisdictionName, type Place } from "./applicability";
import type { Contacts } from "./contacts";

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
