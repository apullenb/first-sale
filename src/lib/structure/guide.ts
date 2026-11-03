import { type ExampleTopic, type NameCase, STRUCTURE_EXAMPLES, type StructureExample } from "@/data/structure-examples";
import type { BusinessProfile, BusinessStructure } from "@/lib/domain";
import { optionsFor } from "./options";
import { nameNeed, type PathSuggestion, sCorpWorthKnowing, suggestPath } from "./suggest";

// What the guide shows open for these answers, what it folds away, and which made-up examples fit

export interface Guide {
  // Options shown side by side, the recommended one first
  main: BusinessStructure[];
  // Possible but less common, folded away
  more: BusinessStructure[];
  // Why the name details fold away, when they likely don't apply; null keeps them open
  nameFolded: string | null;
  // Other tax statuses, like S corporation, open only when worth asking about now
  otherTaxOpen: boolean;
  // Co-owners who are spouses or partners; the note says it applies only if they are married
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
    nameFolded: nameFoldedWhy(p, basis),
    otherTaxOpen: sCorpWorthKnowing(p, basis),
    spouseNote: p.owners.count > 1 && p.ownerRelation === "spouse",
  };
}

function nameFoldedWhy(p: BusinessProfile, basis: BusinessStructure): string | null {
  const status = nameNeed(p, basis).status;
  if (status === "done") return "You already registered a business name";
  if (status === "not_needed") return "You sell under your legal name, so this likely doesn’t apply";
  return null;
}

const forOwners = (example: StructureExample, owners: number) => (example.owners === "one") === (owners === 1);

// Same number of owners first, then the same kind of business, then the data's order
function ranked(examples: StructureExample[], p: BusinessProfile): StructureExample[] {
  const score = (example: StructureExample) =>
    2 * Number(forOwners(example, p.owners.count)) + Number((p.offeringKinds as readonly string[]).includes(example.kind));
  return [...examples].sort((a, b) => score(b) - score(a));
}

function about(topic: ExampleTopic) {
  return STRUCTURE_EXAMPLES.filter((example) => example.topic === topic);
}

export function ownershipExamples(p: BusinessProfile, structure: BusinessStructure, limit = 2): StructureExample[] {
  const fits = about("ownership").filter((example) => example.structure === structure && forOwners(example, p.owners.count));
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
  const fits = about("tax").filter((example) => example.structure === structure && forOwners(example, p.owners.count));
  const asking = sCorpWorthKnowing(p, structure);
  const base = fits.filter((example) => !example.otherTaxStatus);
  const other = asking ? fits.filter((example) => example.otherTaxStatus) : [];
  return [...ranked(base, p).slice(0, 1), ...other];
}
