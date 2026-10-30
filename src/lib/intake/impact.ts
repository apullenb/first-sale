import type { BusinessProfile } from "@/lib/domain";
import { STRUCTURE_LABELS } from "@/lib/details";
import { basisLines, suggestPath } from "@/lib/structure/suggest";
import { profileToAnswers, summarize } from "./answers";

// What a changed answer affects, shown before the owner confirms it. Nothing here changes data.

export interface ImpactContext {
  // When requirements were last checked, if ever
  researchCheckedAt: string | null;
  planSteps: number;
  // The owner's recorded structure, as saved in business details
  structureDecision: string | null;
  // Documents with drafted answers, and which profile facts those answers came from ("profile.name")
  documents: { id: string; title: string; facts: string[] }[];
}

export interface ProfileImpact {
  changes: { label: string; before: string; after: string }[];
  effects: { title: string; detail: string; href: string }[];
}

type Key = keyof BusinessProfile;

// Answers the requirements research doesn't depend on
const NOT_FOR_RESEARCH: readonly Key[] = ["experience", "launchTiming", "launchDate", "goals", "mayAddOwners", "ownerRelation", "takesOnDebt", "startupBudget"];

// Profile facts the paperwork companion drafts from, by the profile keys behind them
const DRAFT_FACTS: Partial<Record<Key, string[]>> = {
  name: ["profile.name"],
  description: ["profile.description"],
  firstItems: ["profile.first_items"],
  location: ["profile.state", "profile.county", "profile.city", "derived.county_state"],
  owners: ["profile.owner_count"],
  nameIsLegalName: ["derived.name_is_legal_name"],
  stage: ["derived.stage", "derived.structure"],
  registeredAs: ["derived.structure"],
};

export function changedKeys(before: BusinessProfile, after: BusinessProfile): Key[] {
  return (Object.keys(after) as Key[]).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

export function profileImpact(before: BusinessProfile, after: BusinessProfile, context: ImpactContext): ProfileImpact {
  const oldRows = summarize(profileToAnswers(before), { followUps: true });
  const newRows = summarize(profileToAnswers(after), { followUps: true });
  const labels = [...new Set([...newRows, ...oldRows].map((row) => row.label))];
  const value = (rows: typeof oldRows, label: string) => rows.find((row) => row.label === label)?.value || "Not answered";
  const changes = labels
    .map((label) => ({ label, before: value(oldRows, label), after: value(newRows, label) }))
    .filter((change) => change.before !== change.after);

  const keys = changedKeys(before, after);
  const effects: ProfileImpact["effects"] = [];
  if (keys.some((key) => !NOT_FOR_RESEARCH.includes(key))) {
    effects.push(
      context.researchCheckedAt
        ? {
            title: "What applies to you",
            detail: "First Sale updates it for your new answers when you open it.",
            href: "/requirements",
          }
        : { title: "What applies to you", detail: "It’ll use your new answers when you find what applies.", href: "/requirements" },
    );
    if (context.planSteps > 0) {
      effects.push({
        title: "Start your business",
        detail: "Your steps update to match. Steps you’ve finished stay finished.",
        href: "/start",
      });
    }
  }

  const oldPath = suggestPath(before);
  const newPath = suggestPath(after);
  if (oldPath.option !== newPath.option) {
    effects.push({
      title: "Suggested structure",
      detail: `Changes from ${STRUCTURE_LABELS[oldPath.option]} to ${STRUCTURE_LABELS[newPath.option]}.`,
      href: "/structure",
    });
  }
  if (context.structureDecision && context.structureDecision !== "undecided" && basisLines(before).join("|") !== basisLines(after).join("|")) {
    const chosen = STRUCTURE_LABELS[context.structureDecision as keyof typeof STRUCTURE_LABELS] ?? context.structureDecision;
    effects.push({
      title: "Your structure decision",
      detail: `You chose ${chosen} with your old answers. It stays as it is; look at it again with the new ones.`,
      href: "/structure",
    });
  }

  const staleFacts = new Set(keys.flatMap((key) => DRAFT_FACTS[key] ?? []));
  for (const doc of context.documents) {
    if (doc.facts.some((fact) => staleFacts.has(fact))) {
      effects.push({ title: doc.title, detail: "Has drafted answers from your old answers. Check them before you use the form.", href: `/documents/${doc.id}` });
    }
  }
  // What the website and brand drafts read
  const forWebsite: readonly Key[] = ["name", "description", "category", "productTags", "firstItems", "offeringKinds", "channels", "shipsOrders", "handoff", "location"];
  if (keys.some((key) => forWebsite.includes(key))) {
    effects.push({ title: "Website and branding", detail: "Drafts there use your business name, what you sell and how. Check them after you save.", href: "/website" });
  }
  return { changes, effects };
}

// One line per change, for the history
export function changeSummary(impact: ProfileImpact): string[] {
  return impact.changes.map((change) => `${change.label}: ${change.before} → ${change.after}`);
}
