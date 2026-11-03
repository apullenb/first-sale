import type { BusinessProfile, BusinessStructure } from "@/lib/domain";
import { placeLabel, placeOf, STRUCTURE_NAMES } from "./applicability";

// Which answers changed since the last check, and which part of the plan each one can change

export interface AnswerChange {
  what: string;
  before: string;
  now: string;
  affects: string;
  // A new search is needed, rather than re-planning from the saved research
  recheck: boolean;
}

type Watched = { what: string; affects: string; read: (profile: BusinessProfile) => unknown };

const WATCHED: Watched[] = [
  {
    what: "Where your business is",
    affects: "Which state, county and city requirements apply",
    read: (profile) => `${placeLabel(placeOf(profile))}${profile.location.insideCityLimits === "yes" ? " (inside city limits)" : profile.location.insideCityLimits === "no" ? " (outside city limits)" : ""}`,
  },
  { what: "What you sell", affects: "Licenses, permits, food safety laws and sales tax", read: (profile) => [profile.category, [...profile.offeringKinds].sort(), [...profile.productTags].sort(), profile.firstItems] },
  { what: "Whether your food needs refrigeration", affects: "Cottage food and home bakery laws", read: (profile) => profile.foodNeedsCold },
  {
    what: "How you sell and hand things over",
    affects: "Zoning, vendor licenses and sales tax",
    read: (profile) => [[...profile.channels].sort(), [...profile.handoff].sort(), profile.premises, profile.customersVisit, profile.shipsOrders],
  },
  { what: "Who owns the business", affects: "Your structure, EIN and name registration", read: (profile) => [profile.owners.count, profile.ownerRelation, profile.mayAddOwners] },
  { what: "What you’ve already done", affects: "Formation steps you may have finished", read: (profile) => [profile.stage, profile.registeredAs] },
  { what: "Licensed services", affects: "Professional licenses", read: (profile) => profile.servicesLicensed },
  { what: "Your business name", affects: "Name registration", read: (profile) => [profile.name, profile.nameIsLegalName] },
  { what: "Help you’ll have", affects: "Steps for hiring", read: (profile) => [profile.hiringPlans, [...profile.helpKinds].sort()] },
  { what: "What you already have", affects: "Steps you may have finished", read: (profile) => [...profile.alreadyHave].sort() },
  { what: "What you make", affects: "Product safety requirements", read: (profile) => [profile.makesForKids, profile.foodContact, [...profile.inventorySources].sort()] },
];

export function answerChanges(
  before: BusinessProfile | null,
  now: BusinessProfile,
  structureBefore: BusinessStructure | null,
  structureNow: BusinessStructure | null,
): AnswerChange[] {
  const changes: AnswerChange[] = [];
  if (before) {
    for (const watched of WATCHED) {
      const a = watched.read(before);
      const b = watched.read(now);
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
      changes.push({ what: watched.what, before: shown(a), now: shown(b), affects: watched.affects, recheck: true });
    }
  }
  if (structureBefore !== structureNow) {
    changes.push({
      what: "Your business structure",
      before: structureBefore ? STRUCTURE_NAMES[structureBefore] : "not decided",
      now: structureNow ? STRUCTURE_NAMES[structureNow] : "not decided",
      affects: "Formation steps and the forms that go with them",
      recheck: false,
    });
  }
  return changes;
}

// Only places and names read well as before → now; other answers just say they changed
function shown(value: unknown): string {
  return typeof value === "string" && value.length <= 80 ? value : "";
}
