import type { BusinessStructure, JurisdictionLevel, PlanTopic, RequirementDraft, TaskStatus, VerificationState } from "@/lib/domain";
import { type Place, questionOf, type RequirementStatus } from "@/lib/research/applicability";
import type { Contacts } from "@/lib/research/contacts";
import { type OfficeContact, officeOf } from "@/lib/research/office";
import { orderTasks } from "./checklist";

// Plain code: AI drafts each requirement, these rules turn checked requirements into ordered steps.

export interface PlanLink {
  title: string;
  url: string;
  // Owner of the site in the .gov registry
  government: string;
  // The page backs this step: its quote was found on it
  confirms: boolean;
}

export interface PlanTaskDraft {
  key: string;
  title: string;
  topic: PlanTopic;
  level: JurisdictionLevel;
  why: string;
  agency: string;
  links: PlanLink[];
  prepare: string[];
  feeCents: number | null;
  // When the page showing the fee was read
  feeCheckedAt: string | null;
  deadline: string | null;
  needsProfessional: boolean;
  verification: VerificationState;
  uncertainty: string[];
  whoToCall: string;
  whatToAsk: string[];
  doneWhen: string;
  prerequisites: string[];
  // Built from practice-mode results; missing on plans saved before this was tracked
  simulated?: boolean;
  // Whether and how it applies, kept apart from whether a page confirms it (verification)
  requirementStatus: RequirementStatus;
  conditions: string[];
  timing: "before_selling" | "later";
  forStructures: BusinessStructure[];
  renewal: { text: string; feeCents: number | null } | null;
  // The government whose rule it is, such as "State of Texas"
  jurisdiction: string;
  alreadyHave: string | null;
  // The model's condition, asked of the owner on What applies to you; empty when it doesn't depend on one
  question: string;
  // For a step to confirm: general background on each rule it covers, from the model and labeled as such
  notes?: { title: string; background: string }[];
  // Read from the office's official pages
  contacts?: Contacts | null;
}

// The rule-written part of a step, for plans saved before it existed
export const PLAN_DEFAULTS = {
  requirementStatus: "needs_confirmation",
  conditions: [],
  timing: "before_selling",
  forStructures: [],
  renewal: null,
  jurisdiction: "",
  alreadyHave: null,
  question: "",
} satisfies Partial<PlanTaskDraft>;

type CheckedRequirement = RequirementDraft & {
  verification: VerificationState;
  problems: string[];
  confirmedBy?: string[];
  // From classify(); without it, status follows the source check alone
  status?: RequirementStatus;
  conditions?: string[];
  fitsStructure?: boolean;
  alreadyHave?: string | null;
  // From the follow-up check; empty until it runs
  background?: string;
};

export interface ReadSource {
  id: string;
  title: string;
  url: string;
  government: string;
  retrievedAt: string;
}

export function slugKey(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "step"
  );
}

// IRS: "form your entity through the secretary of state before you apply for an EIN"
const EIN = /\bein\b|employer identification/i;
const FORMATION = /articles|form(ing)? (an |your )?(llc|corporation|limited liability)|incorporat/i;

// Ordered steps, prerequisites first. Unknown or circular prerequisites are dropped, never guessed.
// Requirements ruled out by the owner's structure stay in the requirements list but not in the plan.
export function buildPlan(
  allRequirements: readonly CheckedRequirement[],
  sources: readonly ReadSource[],
  simulated = false,
  options: { place?: Place; offices?: readonly OfficeContact[] } = {},
): PlanTaskDraft[] {
  const requirements = allRequirements.filter((requirement) => requirement.fitsStructure !== false);
  const byId = new Map(sources.map((source) => [source.id, source]));
  const keyFor = new Map<string, string>();
  const used = new Set<string>();
  const keys = requirements.map((requirement) => {
    const base = slugKey(requirement.key || requirement.title);
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}-${n}`;
    used.add(key);
    if (!keyFor.has(slugKey(requirement.key))) keyFor.set(slugKey(requirement.key), key);
    return key;
  });

  const drafts = requirements.map((requirement, index): PlanTaskDraft => {
    const cited = requirement.sourceIds.flatMap((id) => byId.get(id) ?? []);
    const sourced = requirement.verification === "sourced";
    const uncertainty: string[] = [];
    if (!sourced) {
      uncertainty.push(
        cited.length > 0
          ? "The official page we found doesn’t confirm the details of this step."
          : "We didn’t find an official page for this yet. That doesn’t mean it doesn’t apply.",
      );
    }
    if (requirement.needsProfessional) uncertainty.push("A lawyer or accountant can help you decide how this applies to you.");

    return {
      key: keys[index],
      title: requirement.title,
      topic: requirement.topic,
      level: requirement.level,
      why: requirement.whyItApplies,
      agency: requirement.agency,
      links: cited.map((source) => ({
        title: source.title,
        url: source.url,
        government: source.government,
        // Only the page the quote was actually found on
        confirms: sourced && (requirement.confirmedBy ? requirement.confirmedBy.includes(source.id) : true),
      })),
      prepare: requirement.gather,
      feeCents: requirement.feeUsd === null ? null : Math.round(requirement.feeUsd * 100),
      feeCheckedAt: requirement.feeUsd === null ? null : latest(cited.map((source) => source.retrievedAt)),
      deadline: requirement.deadline,
      needsProfessional: requirement.needsProfessional,
      verification: requirement.verification,
      uncertainty,
      whoToCall: requirement.whoToCall,
      whatToAsk: requirement.whatToAsk,
      doneWhen: requirement.doneWhen,
      prerequisites: [],
      simulated,
      requirementStatus: requirement.status ?? (sourced ? "verified" : "needs_confirmation"),
      conditions: requirement.conditions ?? [],
      timing: requirement.timing,
      forStructures: requirement.forStructures,
      renewal: requirement.renewal ? { text: requirement.renewal, feeCents: requirement.renewalFeeUsd === null ? null : Math.round(requirement.renewalFeeUsd * 100) } : null,
      jurisdiction: [...new Set(cited.filter((source) => source.government).map((source) => source.government))].join(", "),
      alreadyHave: requirement.alreadyHave ?? null,
      question: questionOf(requirement) ?? "",
      notes: requirement.background ? [{ title: requirement.title, background: requirement.background }] : [],
      contacts: null,
    };
  });

  // Rule-based order the model may have missed, then the model's own; never one that closes a loop
  // Only once the structure is settled: until then the structure step comes first anyway
  const formation = drafts.find(
    (draft) =>
      draft.forStructures.some((each) => each === "llc" || each === "corporation") &&
      draft.conditions.length === 0 &&
      FORMATION.test(`${draft.key} ${draft.title}`),
  );
  const link = (draft: PlanTaskDraft, key: string | undefined) => {
    if (!key || key === draft.key || draft.prerequisites.includes(key)) return;
    if (!reaches(drafts, key, draft.key)) draft.prerequisites.push(key);
  };
  // The rule's edges go in first, so a model edge pointing the other way can't win
  for (const draft of drafts) if (formation && EIN.test(`${draft.key} ${draft.title}`)) link(draft, formation.key);
  drafts.forEach((draft, index) => {
    for (const wanted of requirements[index].dependsOn) link(draft, keyFor.get(slugKey(wanted)));
  });

  const steps = options.place ? askByOffice(drafts, requirements, options.place, options.offices ?? []) : drafts;
  const byKey = new Map(steps.map((draft) => [draft.key, draft]));
  return orderTasks(steps.map((draft) => ({ id: draft.key, prerequisites: draft.prerequisites }))).map((node) => byKey.get(node.id)!);
}

const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

// Rules no official page confirmed go to their office: one step and one message per office, never one per rule.
// Federal rules and structure-specific filings stay as their own steps.
function askByOffice(drafts: PlanTaskDraft[], requirements: readonly CheckedRequirement[], place: Place, offices: readonly OfficeContact[]): PlanTaskDraft[] {
  const contactsOf = new Map(offices.map((office) => [office.key, office]));
  const groups = new Map<string, { office: ReturnType<typeof officeOf>; members: PlanTaskDraft[] }>();
  drafts.forEach((draft, index) => {
    if (draft.requirementStatus !== "needs_confirmation" || draft.level === "federal" || draft.forStructures.length) return;
    const office = officeOf(requirements[index], place);
    draft.contacts = contactsOf.get(office.key)?.contacts ?? null;
    const group = groups.get(office.key) ?? { office, members: [] };
    group.members.push(draft);
    groups.set(office.key, group);
  });

  const into = new Map<string, string>();
  const asks = new Map<string, PlanTaskDraft>();
  for (const { office, members } of groups.values()) {
    if (members.length < 2) continue;
    const key = `ask-${slugKey(office.name)}`;
    const site = contactsOf.get(office.key)?.site;
    const links = [...new Map([...(site ? [{ ...site, government: office.name, confirms: false }] : []), ...members.flatMap((member) => member.links)].map((link) => [link.url, link])).values()];
    const name = /^(city|county|state) of /i.test(office.name) ? `the ${office.name}` : office.name;
    asks.set(members[0].key, {
      ...members[0],
      key,
      title: `Ask ${name} about ${members.length} rules`,
      why: `No official page settled ${LIST.format(members.map((member) => member.title.replace(/^./, (first) => first.toLowerCase())))}. One message to ${name} covers ${members.length === 2 ? "both" : "all of them"}.`,
      agency: office.name,
      links,
      prepare: [...new Set(members.flatMap((member) => member.prepare))].slice(0, 8),
      feeCents: null,
      feeCheckedAt: null,
      deadline: null,
      needsProfessional: members.some((member) => member.needsProfessional),
      verification: "needs_verification",
      uncertainty: ["No official page we found settles these. That doesn’t mean they don’t apply."],
      whoToCall: office.name,
      whatToAsk: members.flatMap((member) => member.whatToAsk.slice(0, 2)).slice(0, 6),
      doneWhen: `${name.replace(/^./, (first) => first.toUpperCase())} answered about each rule. If one applies, check your requirements again so it becomes a step.`,
      prerequisites: [],
      timing: members.some((member) => member.timing === "before_selling") ? "before_selling" : "later",
      renewal: null,
      jurisdiction: office.name,
      alreadyHave: null,
      question: "",
      notes: members.flatMap((member) => member.notes ?? []),
    });
    for (const member of members) into.set(member.key, key);
  }
  if (!into.size) return drafts;

  return drafts.flatMap((draft) => {
    if (into.has(draft.key)) return asks.has(draft.key) ? [asks.get(draft.key)!] : [];
    const prerequisites = [...new Set(draft.prerequisites.map((key) => into.get(key) ?? key))];
    return [{ ...draft, prerequisites }];
  });
}

// True when `from` already depends on `to`, directly or through other steps
function reaches(drafts: readonly { key: string; prerequisites: readonly string[] }[], from: string, to: string): boolean {
  const byKey = new Map(drafts.map((draft) => [draft.key, draft]));
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const key = stack.pop()!;
    if (key === to) return true;
    if (seen.has(key)) continue;
    seen.add(key);
    stack.push(...(byKey.get(key)?.prerequisites ?? []));
  }
  return false;
}

function latest(dates: readonly string[]): string | null {
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}

// Steps that wait on this one
// The step that chooses a structure, done on Business structure. Filings, like forming an LLC, name a structure or carry a fee.
export function choosesStructure(step: { topic?: string; forStructures?: readonly string[] | null; feeCents?: number | null }): boolean {
  return step.topic === "structure" && !step.forStructures?.length && !step.feeCents;
}

// A known structure, chosen or already registered, settles that step; saying "not decided yet" leaves it open
export function settleStructureChoice<T extends { topic?: string; forStructures?: readonly string[] | null; feeCents?: number | null; status: string }>(
  steps: readonly T[],
  known: boolean,
): T[] {
  return steps.map((step) => (known && choosesStructure(step) && step.status !== "done" ? { ...step, status: "done" } : step));
}

export function followingSteps<T extends { key: string; prerequisites: readonly string[] }>(tasks: readonly T[], key: string): T[] {
  return tasks.filter((task) => task.prerequisites.includes(key));
}

export interface CurrentTask extends PlanTaskDraft {
  id: string;
  status: TaskStatus;
  retired: boolean;
}

export type PlanChange =
  | { kind: "added"; key: string; title: string }
  | { kind: "removed"; key: string; title: string; done: boolean }
  | { kind: "changed"; key: string; title: string; what: string[] };

// What a new plan would change that the owner should see. Rewording alone isn't a change.
export function diffPlan(current: readonly CurrentTask[], proposed: readonly PlanTaskDraft[]): PlanChange[] {
  const live = current.filter((task) => !task.retired);
  const now = new Map(live.map((task) => [task.key, task]));
  const next = new Map(proposed.map((task) => [task.key, task]));
  const changes: PlanChange[] = [];

  for (const task of proposed) {
    const before = now.get(task.key);
    if (!before) {
      changes.push({ kind: "added", key: task.key, title: task.title });
      continue;
    }
    const what = changedParts(before, task);
    if (what.length) changes.push({ kind: "changed", key: task.key, title: task.title, what });
  }
  for (const task of live) {
    // Submitted counts as started: it's kept as a record, never deleted
    if (!next.has(task.key)) changes.push({ kind: "removed", key: task.key, title: task.title, done: task.status !== "todo" });
  }
  return changes;
}

function changedParts(before: PlanTaskDraft, after: PlanTaskDraft): string[] {
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const what: string[] = [];
  if (before.feeCents !== after.feeCents) what.push("Fee");
  if (before.deadline !== after.deadline) what.push("Deadline");
  if (before.verification !== after.verification) what.push("Whether an official page confirms it");
  if (!same(before.links.map((link) => link.url), after.links.map((link) => link.url))) what.push("Official links");
  if (!same(before.prerequisites, after.prerequisites)) what.push("Steps to finish first");
  if (before.level !== after.level || before.topic !== after.topic) what.push("Which government it comes from");
  if (Boolean(before.simulated) !== Boolean(after.simulated)) what.push(after.simulated ? "Now from practice mode" : "Checked for real, not in practice mode");
  if ((before.requirementStatus ?? PLAN_DEFAULTS.requirementStatus) !== after.requirementStatus) what.push("Whether it applies to you");
  if ((before.timing ?? PLAN_DEFAULTS.timing) !== after.timing) what.push("When it’s needed");
  if ((before.renewal?.feeCents ?? null) !== (after.renewal?.feeCents ?? null) || (before.renewal?.text ?? null) !== (after.renewal?.text ?? null)) {
    what.push("Renewal");
  }
  if (!same(before.forStructures ?? [], after.forStructures)) what.push("Which business structures it’s for");
  return what;
}

export interface PlanWrite {
  // Rows to insert or update, in plan order; `id` is set for rows that exist
  upserts: (PlanTaskDraft & { id: string | null; position: number; retired: boolean })[];
  deleteIds: string[];
}

// Applies the accepted changes. Done steps keep their status; a done step dropped from the plan is kept as retired.
export function applyPlan(
  current: readonly CurrentTask[],
  proposed: readonly PlanTaskDraft[],
  accepted: ReadonlySet<string>,
): PlanWrite {
  const changes = new Map(diffPlan(current, proposed).map((change) => [change.key, change]));
  const byKey = new Map(current.map((task) => [task.key, task]));
  const upserts: PlanWrite["upserts"] = [];
  const deleteIds: string[] = [];
  const placed = new Set<string>();

  for (const task of proposed) {
    const before = byKey.get(task.key);
    const change = changes.get(task.key);
    const take = !change || accepted.has(task.key);
    if (before && !take) {
      upserts.push({ ...strip(before), id: before.id, position: upserts.length, retired: before.retired });
    } else if (before) {
      upserts.push({ ...task, id: before.id, position: upserts.length, retired: false });
    } else if (take) {
      upserts.push({ ...task, id: null, position: upserts.length, retired: false });
    }
    placed.add(task.key);
  }

  for (const task of current) {
    if (placed.has(task.key)) continue;
    const removing = changes.has(task.key) && accepted.has(task.key);
    if (!removing) {
      upserts.push({ ...strip(task), id: task.id, position: upserts.length, retired: task.retired });
    } else if (task.status !== "todo") {
      upserts.push({ ...strip(task), id: task.id, position: upserts.length, retired: true });
    } else {
      deleteIds.push(task.id);
    }
  }
  // Taking some changes and not others can pair old and new prerequisites into a loop
  return { upserts: withoutLoops(upserts), deleteIds };
}

// Keeps each prerequisite only if it names a step in the list and doesn't close a loop, earlier steps first
function withoutLoops<T extends { key: string; prerequisites: string[] }>(tasks: readonly T[]): T[] {
  const keys = new Set(tasks.map((task) => task.key));
  const kept = tasks.map((task) => ({ ...task, prerequisites: [] as string[] }));
  tasks.forEach((task, index) => {
    for (const key of task.prerequisites) {
      if (!keys.has(key) || key === task.key || kept[index].prerequisites.includes(key)) continue;
      if (!reaches(kept, key, task.key)) kept[index].prerequisites.push(key);
    }
  });
  return kept;
}

function strip(task: CurrentTask): PlanTaskDraft {
  const draft: Partial<CurrentTask> = { ...task };
  delete draft.id;
  delete draft.status;
  delete draft.retired;
  return draft as PlanTaskDraft;
}
