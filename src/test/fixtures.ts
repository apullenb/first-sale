import { users } from "@/db/schema";
import { createBusinessForOwner } from "@/lib/data/businesses";
import type { BusinessProfile, RequirementDraft } from "@/lib/domain";
import type { RetrievedPage } from "@/lib/research/retrieve";
import type { VerifiedRequirement } from "@/lib/research/verify";
import type { createTestDb } from "./db";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

// A full profile: Ohio, no county or city, one owner selling food at markets
export function testProfile(
  overrides: Partial<Omit<BusinessProfile, "location">> & { location?: Partial<BusinessProfile["location"]> } = {},
): BusinessProfile {
  const { location, ...rest } = overrides;
  return {
    name: "Rise Bakery",
    description: "",
    country: "US",
    location: { state: "OH", county: "", city: "", insideCityLimits: null, ...location },
    owners: { count: 1 },
    stage: null,
    registeredAs: null,
    offeringKinds: ["food"],
    firstItems: "",
    foodNeedsCold: null,
    channels: ["markets"],
    shipsOrders: null,
    premises: null,
    customersVisit: null,
    startupBudget: null,
    hiringPlans: null,
    experience: null,
    launchTiming: null,
    ...rest,
  };
}

export function requirementDraft(overrides: Partial<RequirementDraft> = {}): RequirementDraft {
  return {
    key: "ein",
    title: "Get an EIN",
    topic: "tax_registration",
    whyItApplies: "Why",
    level: "federal",
    agency: "Internal Revenue Service",
    sourceIds: [],
    evidence: null,
    feeUsd: null,
    deadline: null,
    needsProfessional: false,
    whoToCall: "the IRS",
    whatToAsk: [],
    gather: [],
    doneWhen: "",
    dependsOn: [],
    ...overrides,
  };
}

export function verifiedRequirement(overrides: Partial<VerifiedRequirement> = {}): VerifiedRequirement {
  return { ...requirementDraft(), verification: "needs_verification", problems: [], ...overrides };
}

export function retrievedPage(overrides: Partial<RetrievedPage> = {}): RetrievedPage {
  return {
    id: "irs-ein",
    title: "IRS: EIN",
    url: "https://www.irs.gov/ein",
    level: "federal",
    government: "Internal Revenue Service (Department of the Treasury)",
    discovered: false,
    text: "Get an EIN for free.",
    retrievedAt: "2026-10-26T15:00:00.000Z",
    ...overrides,
  };
}

// Owners A and B, each with a business
export async function seedOwners(db: TestDb, profile: BusinessProfile = testProfile()) {
  await db.insert(users).values([
    { id: "owner-a", name: "Owner A", email: "a@example.test" },
    { id: "owner-b", name: "Owner B", email: "b@example.test" },
  ]);
  const a = await createBusinessForOwner(db, "owner-a", { profile });
  const b = await createBusinessForOwner(db, "owner-b", { profile });
  return { businessA: a!.id, businessB: b!.id };
}
