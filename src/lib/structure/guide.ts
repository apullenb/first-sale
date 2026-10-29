import { type ExampleTopic, type NameCase, STRUCTURE_EXAMPLES, type StructureExample } from "@/data/structure-examples";
import type { BusinessProfile, BusinessStructure } from "@/lib/domain";
import { optionsFor } from "./options";
import { nameNeed, type PathSuggestion, recommendedTaxPlan, suggestPath } from "./suggest";

// What the guide shows open for these answers, what it folds away, and which made-up examples fit

export interface Guide {
  // Options shown side by side, the recommended one first
  main: BusinessStructure[];
  // Possible but less common, folded away
  more: BusinessStructure[];
  // Name registration likely doesn't apply: they use their legal name or already registered one
  nameFolded: boolean;
  // Other tax statuses, like S corporation, open only when worth asking about now
  otherTaxOpen: boolean;
  // Married co-owners may choose not to be a partnership
  spouseNote: boolean;
}

// Name and tax guidance follow the structure the owner recorded, or the suggested one until then
export function guideFor(p: BusinessProfile, path: PathSuggestion = suggestPath(p), basis: BusinessStructure = path.option): Guide {
  const options = optionsFor(p.owners.count)
    .map((option) => option.id)
    .sort((a, b) => Number(b === path.option) - Number(a === path.option));
  const open = (id: BusinessStructure) => id !== "corporation" || path.option === "corporation" || basis === "corporation";
  return {
    main: options.filter(open),
    more: options.filter((id) => !open(id)),
    nameFolded: p.alreadyHave.includes("business_name") || nameNeed(p, basis).status === "not_needed",
    otherTaxOpen: recommendedTaxPlan(p, basis).value === "ask_professional",
    spouseNote: p.owners.count > 1 && p.ownerRelation === "spouse",
  };
}

const fitsOwners = (example: StructureExample, owners: number) => example.owners === "any" || (example.owners === "one") === (owners === 1);

// Same number of owners first, then the same kind of business, then the data's order
function ranked(examples: StructureExample[], p: BusinessProfile): StructureExample[] {
  const score = (example: StructureExample) =>
    2 * Number(fitsOwners(example, p.owners.count)) + Number((p.offeringKinds as readonly string[]).includes(example.kind));
  return [...examples].sort((a, b) => score(b) - score(a));
}

function about(topic: ExampleTopic) {
  return STRUCTURE_EXAMPLES.filter((example) => example.topic === topic);
}

export function ownershipExamples(p: BusinessProfile, structure: BusinessStructure, limit = 2): StructureExample[] {
  const fits = about("ownership").filter((example) => example.structure === structure && fitsOwners(example, p.owners.count));
  return ranked(fits, p).slice(0, limit);
}

// The owner's own name situation first
export function nameExamples(p: BusinessProfile, structure: BusinessStructure): StructureExample[] {
  const company = structure === "llc" || structure === "corporation";
  const order: NameCase[] = company
    ? ["entity_dba", "dba"]
    : p.owners.count > 1
      ? ["dba"]
      : nameNeed(p, structure).status === "not_needed"
        ? ["legal_name", "dba"]
        : ["dba", "legal_name"];
  const named = ranked(about("name"), p);
  return order.flatMap((nameCase) => named.find((example) => example.nameCase === nameCase) ?? []);
}

export function taxExamples(p: BusinessProfile, structure: BusinessStructure): StructureExample[] {
  const fits = about("tax").filter((example) => !example.otherTaxStatus && example.structure === structure && fitsOwners(example, p.owners.count));
  const other = recommendedTaxPlan(p, structure).value === "ask_professional" ? about("tax").filter((example) => example.otherTaxStatus) : [];
  return [...ranked(fits, p).slice(0, 1), ...other];
}
