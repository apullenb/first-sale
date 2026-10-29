import type { BusinessProfile, BusinessStructure, JurisdictionLevel, PlanTopic, TaskStatus, VerificationState } from "@/lib/domain";
import {
  classify,
  type ConditionAnswer,
  type Place,
  placeConditions,
  questionOf,
  RULE_CONDITION,
  type RequirementStatus,
  type StructureDecision,
} from "@/lib/research/applicability";
import { choosesStructure } from "./plan";
import { MAX_SITTING_MINUTES, stepMinutes } from "./progress";

// Plain code: which plan steps are the owner's tasks, which paperwork group each goes in, and what each waits on.
// The plan keeps every step as a record; answers and decisions decide what shows, so Undo brings a step back as it was.

export interface PaperStep {
  id: string;
  key: string;
  title: string;
  topic: PlanTopic;
  level: JurisdictionLevel;
  status: TaskStatus;
  requirementStatus: RequirementStatus;
  conditions: readonly string[];
  verification: VerificationState;
  forStructures: readonly BusinessStructure[];
  timing: "before_selling" | "later";
  prerequisites: readonly string[];
  feeCents?: number | null;
  question?: string;
  why?: string;
  doneWhen?: string;
}

export type Inclusion =
  // Applies, and an official page confirms it
  | "task"
  // Applies, but no official page confirmed it: confirm with the office first
  | "confirm"
  // The owner isn't sure it applies, so finding out is the task
  | "find_out"
  // Waits on the owner's yes, no or not sure
  | "question"
  // Waits on the owner's county, city or city limits
  | "place"
  // Only for some structures, and none is chosen yet
  | "structure"
  // Choosing the structure itself, done on Business structure
  | "structure_choice"
  | "no"
  | "optional"
  | "outside"
  // Not for the structure the owner chose
  | "other_structure";

export const TASK_KINDS = ["task", "confirm", "find_out"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
export const isTaskKind = (inclusion: Inclusion): inclusion is TaskKind => (TASK_KINDS as readonly string[]).includes(inclusion);

export interface SavedAnswer {
  stepKey: string;
  condition: string;
  answer: ConditionAnswer;
}

const normal = (text: string) => text.replace(/\s+/g, " ").trim();

// Keyed by the step and the condition's wording, so a reworded condition is asked again
export function answerFor(answers: readonly SavedAnswer[], key: string, question: string): ConditionAnswer | null {
  const asked = normal(question);
  return answers.find((each) => each.stepKey === key && normal(each.condition) === asked)?.answer ?? null;
}

export interface PaperworkContext {
  // The answers the requirements were checked with
  profile: BusinessProfile;
  place: Place;
  decision: StructureDecision;
  answers: readonly SavedAnswer[];
}

export interface Standing<T extends PaperStep> {
  step: T;
  inclusion: Inclusion;
  // After the owner's answers and decisions
  requirementStatus: RequirementStatus;
  conditions: string[];
  question: string | null;
  answer: ConditionAnswer | null;
  // What the owner's place leaves open
  place: string[];
}

// Plans saved before questions were kept: the model's condition is the first one the rules didn't write
export function questionFor(step: Pick<PaperStep, "question" | "requirementStatus" | "conditions">): string {
  if (step.question) return step.question;
  if (step.requirementStatus !== "conditional") return "";
  if (!step.conditions.length) return questionOf({ applicability: "conditional", condition: "" }) ?? "";
  return step.conditions.find((condition) => !RULE_CONDITION.test(condition)) ?? "";
}

export function standingOf<T extends PaperStep>(step: T, context: PaperworkContext): Standing<T> {
  if (choosesStructure(step)) {
    return { step, inclusion: "structure_choice", requirementStatus: step.requirementStatus, conditions: [], question: null, answer: null, place: [] };
  }
  const question = questionFor(step);
  const applicability =
    step.requirementStatus === "optional" || step.requirementStatus === "outside_coverage" ? step.requirementStatus : question ? "conditional" : "applies";
  const saved = question ? answerFor(context.answers, step.key, question) : null;
  const classified = classify(
    { key: step.key, title: step.title, topic: step.topic, level: step.level, applicability, condition: question, forStructures: [...step.forStructures], verification: step.verification },
    context.profile,
    context.place,
    context.decision,
    saved,
  );
  const place = placeConditions(step.level, context.place);
  const inclusion: Inclusion = !classified.fitsStructure
    ? "other_structure"
    : classified.status === "outside_coverage"
      ? "outside"
      : classified.status === "optional"
        ? "optional"
        : classified.answer === "no"
          ? "no"
          : step.forStructures.length && !context.decision.structure
            ? "structure"
            : outsideCity(step, context.place)
              ? "place"
              : classified.question && !classified.answer
                ? "question"
                : place.length
                  ? "place"
                  : classified.answer === "unsure"
                    ? "find_out"
                    : classified.status === "verified"
                      ? "task"
                      : "confirm";
  const requirementStatus: RequirementStatus = inclusion === "task" ? "verified" : inclusion === "confirm" ? "needs_confirmation" : classified.status;
  const conditions = inclusion === "task" || inclusion === "confirm" ? [] : inclusion === "find_out" ? [question] : classified.conditions;
  return { step, inclusion, requirementStatus, conditions, question: classified.question, answer: classified.answer, place };
}

// The owner said they're outside city limits: a city rule isn't asked about, though their township may have its own
const outsideCity = (step: Pick<PaperStep, "level">, place: Place) => step.level === "city" && place.insideCity === "no";

// Place answers the owner can still give; being outside city limits is an answer, not a gap
export function placeOpen(standing: Pick<Standing<PaperStep>, "inclusion" | "step">, place: Place): boolean {
  return standing.inclusion === "place" && !outsideCity(standing.step, place);
}

export const GROUP_KEYS = ["register", "tax-ids", "where-you-work", "licenses", "hiring", "other", "after-you-open"] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

export const GROUPS: Record<GroupKey, { title: string; summary: string }> = {
  register: { title: "Register your business", summary: "Form your company, if you chose one, and register the name you sell under." },
  "tax-ids": { title: "Get your tax IDs", summary: "Sign up with the IRS and your state for the taxes your business collects or pays." },
  "where-you-work": { title: "Where you work", summary: "Check that your home or space is allowed for your kind of business." },
  licenses: { title: "Licenses and permits", summary: "The licenses, permits and training your kind of business needs." },
  hiring: { title: "Get ready to hire", summary: "What an employer sets up before a first hire." },
  other: { title: "Other steps", summary: "Anything else to settle before your first sale." },
  "after-you-open": { title: "After you open", summary: "Yearly filings and steps that come after your first sale. They don’t hold up your launch." },
};

const BY_TOPIC: Record<PlanTopic, GroupKey> = {
  structure: "register",
  name_registration: "register",
  tax_registration: "tax-ids",
  location_zoning: "where-you-work",
  license_permit: "licenses",
  employer: "hiring",
  other: "other",
};

export function groupKeyOf(step: Pick<PaperStep, "topic" | "timing">): GroupKey {
  return step.timing === "later" ? "after-you-open" : BY_TOPIC[step.topic];
}

// The menu fits a laptop screen with this many groups
export const MAX_GROUPS = 5;
const FOLDABLE: readonly GroupKey[] = ["where-you-work", "hiring"];

// Plan order kept: as few parts as fit the time limit, then as even as they can be
export function splitByTime<T>(items: readonly T[], minutes: (item: T) => number, cap = MAX_SITTING_MINUTES): T[][] {
  if (!items.length) return [];
  const sizes = items.map(minutes);
  let parts = 1;
  let sum = 0;
  for (const size of sizes) {
    if (sum > 0 && sum + size > cap) {
      parts++;
      sum = size;
    } else sum += size;
  }
  const prefix = sizes.reduce<number[]>((all, size) => [...all, all[all.length - 1] + size], [0]);
  const n = items.length;
  // worst[k][i]: the longest part when the first i items make k parts; cut[k][i]: where the last of them starts
  const worst = Array.from({ length: parts + 1 }, () => Array<number>(n + 1).fill(Infinity));
  const cut = Array.from({ length: parts + 1 }, () => Array<number>(n + 1).fill(0));
  worst[0][0] = 0;
  for (let k = 1; k <= parts; k++) {
    for (let i = k; i <= n; i++) {
      for (let j = k - 1; j < i; j++) {
        const longest = Math.max(worst[k - 1][j], prefix[i] - prefix[j]);
        if (longest <= worst[k][i]) {
          worst[k][i] = longest;
          cut[k][i] = j;
        }
      }
    }
  }
  const result: T[][] = [];
  for (let k = parts, i = n; k > 0; k--) {
    const j = cut[k][i];
    result.unshift(items.slice(j, i));
    i = j;
  }
  return result;
}

export interface Blocker {
  title: string;
  href: string;
  // Where the owner does it: a group's name, Business structure or What applies to you
  where: string;
  // A task sent to an office: the wait is theirs, not the owner's
  office: boolean;
  // Set when it's another task
  taskKey: string | null;
}

export type TaskState = "done" | "waiting" | "locked" | "ready";

export interface PaperworkTask<T extends PaperStep> extends Standing<T> {
  kind: TaskKind;
  // The group or part it's in
  group: string;
  minutes: number;
  state: TaskState;
  blockers: Blocker[];
  summary: string;
}

export type GroupState = "done" | "todo" | "waiting" | "locked";

export interface PaperworkGroup<T extends PaperStep> {
  // "licenses", or "licenses-2" for a part
  key: string;
  href: string;
  base: GroupKey;
  title: string;
  // With its part, like "Licenses and permits, part 1 of 2"
  name: string;
  summary: string;
  part: { index: number; of: number } | null;
  later: boolean;
  tasks: PaperworkTask<T>[];
  // Filings that wait on a structure decision; not tasks until one is chosen
  waitingOnStructure: Standing<T>[];
  minutes: number;
  // Not started yet, with their time
  left: number;
  minutesLeft: number;
  state: GroupState;
  // Where the owner's work is, when the group is locked
  waitsOn: string[];
  // The task to do next here
  next: PaperworkTask<T> | null;
}

export interface Paperwork<T extends PaperStep> {
  // Every live step, plan order
  standings: Standing<T>[];
  tasks: PaperworkTask<T>[];
  groups: PaperworkGroup<T>[];
  // The next task to do: needed before selling first
  first: PaperworkTask<T> | null;
  // Questions and place answers the owner can still give on What applies to you
  open: Standing<T>[];
}

export const STRUCTURE_WHERE = "Business structure";
export const CHECK_WHERE = "What applies to you";

export function groupHref(key: string): string {
  return `/start/${key}`;
}

// A line under the title: the first sentence of why, or what done looks like, kept short
export function summaryOf(step: Pick<PaperStep, "why" | "doneWhen">): string {
  const text = (step.why?.trim() || step.doneWhen?.trim() || "").replace(/\s+/g, " ");
  const first = text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;
  if (first.length <= 140) return first;
  const cut = first.slice(0, 139);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : 139).replace(/[,;:]$/, "")}…`;
}

// Steps must be live and in plan order
export function paperwork<T extends PaperStep>(steps: readonly T[], context: PaperworkContext): Paperwork<T> {
  const standings = steps.map((step) => standingOf(step, context));
  const included = standings.filter((standing): standing is Standing<T> & { inclusion: TaskKind } => isTaskKind(standing.inclusion));

  // Base groups; when there are too many to fit, the smallest foldable ones go into "Other steps"
  const waitingStructure = standings.filter((standing) => standing.inclusion === "structure" && standing.step.timing === "before_selling");
  const folded = new Set<GroupKey>();
  const baseFor = (step: PaperStep): GroupKey => (folded.has(groupKeyOf(step)) ? "other" : groupKeyOf(step));
  const present = () => new Set([...included, ...waitingStructure].map((standing) => baseFor(standing.step)));
  const size = (key: GroupKey) => [...included, ...waitingStructure].filter((standing) => groupKeyOf(standing.step) === key).length;
  for (const key of [...FOLDABLE].sort((a, b) => size(a) - size(b))) {
    if (present().size <= MAX_GROUPS) break;
    folded.add(key);
  }

  const groups: PaperworkGroup<T>[] = [];
  const groupOfTask = new Map<string, PaperworkGroup<T>>();
  for (const base of GROUP_KEYS) {
    const members = included.filter((standing) => baseFor(standing.step) === base);
    const waiting = waitingStructure.filter((standing) => baseFor(standing.step) === base);
    if (!members.length && !waiting.length) continue;
    const parts = members.length ? splitByTime(members, (standing) => stepMinutes(standing.step)) : [[]];
    parts.forEach((part, index) => {
      const split = parts.length > 1;
      const key = split ? `${base}-${index + 1}` : base;
      const group: PaperworkGroup<T> = {
        key,
        href: groupHref(key),
        base,
        title: GROUPS[base].title,
        name: split ? `${GROUPS[base].title}, part ${index + 1} of ${parts.length}` : GROUPS[base].title,
        summary: GROUPS[base].summary,
        part: split ? { index: index + 1, of: parts.length } : null,
        later: base === "after-you-open",
        tasks: [],
        // More may come once a structure is chosen; they belong at the end
        waitingOnStructure: index === parts.length - 1 ? waiting : [],
        minutes: 0,
        left: 0,
        minutesLeft: 0,
        state: "todo",
        waitsOn: [],
        next: null,
      };
      for (const standing of part) {
        const task: PaperworkTask<T> = {
          ...standing,
          kind: standing.inclusion,
          group: key,
          minutes: stepMinutes(standing.step),
          state: "ready",
          blockers: [],
          summary: summaryOf(standing.step),
        };
        group.tasks.push(task);
        groupOfTask.set(standing.step.key, group);
      }
      groups.push(group);
    });
  }

  const byKey = new Map(standings.map((standing) => [standing.step.key, standing]));
  const tasks = groups.flatMap((group) => group.tasks);
  const taskByKey = new Map(tasks.map((task) => [task.step.key, task]));
  for (const task of tasks) {
    // Asking whether it applies never waits on the filing's own prerequisites
    task.blockers = task.kind === "find_out" ? [] : blockersOf(task.step, byKey, groupOfTask, context.place);
    task.state = task.step.status === "done" ? "done" : task.step.status === "submitted" ? "waiting" : task.blockers.length ? "locked" : "ready";
  }

  // The owner's own work a locked task waits on, followed back through other locked tasks; empty when only offices hold it up
  const rootsOf = (task: PaperworkTask<T>, seen = new Set<string>()): Set<string> => {
    const roots = new Set<string>();
    if (seen.has(task.step.key)) return roots;
    seen.add(task.step.key);
    for (const blocker of task.blockers) {
      if (blocker.office) continue;
      const before = blocker.taskKey ? taskByKey.get(blocker.taskKey) : undefined;
      if (!before) roots.add(blocker.where);
      else if (before.state === "ready") roots.add(groupOfTask.get(before.step.key)!.name);
      else if (before.state === "locked") for (const root of rootsOf(before, seen)) roots.add(root);
    }
    return roots;
  };

  for (const group of groups) {
    const open = group.tasks.filter((task) => task.state !== "done");
    const todo = group.tasks.filter((task) => task.step.status === "todo");
    group.minutes = group.tasks.reduce((sum, task) => sum + task.minutes, 0);
    group.left = todo.length;
    group.minutesLeft = todo.reduce((sum, task) => sum + task.minutes, 0);
    group.next = group.tasks.find((task) => task.state === "ready") ?? null;
    const roots = new Set(open.filter((task) => task.state === "locked").flatMap((task) => [...rootsOf(task)]));
    roots.delete(group.name);
    if (group.waitingOnStructure.length) roots.add(STRUCTURE_WHERE);
    group.state = group.next ? "todo" : !open.length && !roots.size ? "done" : roots.size ? "locked" : "waiting";
    group.waitsOn = group.state === "locked" ? [...roots] : [];
  }

  const soon = groups.filter((group) => !group.later).flatMap((group) => group.tasks);
  const later = groups.filter((group) => group.later).flatMap((group) => group.tasks);
  return {
    standings,
    tasks,
    groups,
    first: soon.find((task) => task.state === "ready") ?? later.find((task) => task.state === "ready") ?? null,
    open: standings.filter((standing) => standing.inclusion === "question" || placeOpen(standing, context.place)),
  };
}

// What holds a step up: unfinished tasks, a structure still to choose, or an answer still to give. Steps that don't apply never do.
function blockersOf<T extends PaperStep>(
  step: T,
  byKey: ReadonlyMap<string, Standing<T>>,
  groupOf: ReadonlyMap<string, PaperworkGroup<T>>,
  place: Place,
): Blocker[] {
  const blockers: Blocker[] = [];
  const add = (blocker: Blocker) => {
    if (!blockers.some((each) => each.href === blocker.href)) blockers.push(blocker);
  };
  for (const key of step.prerequisites) {
    const before = byKey.get(key);
    if (!before || before.step.status === "done" || before.step.key === step.key) continue;
    if (isTaskKind(before.inclusion)) {
      add({
        title: before.step.title,
        href: `/checklist/${before.step.id}`,
        where: groupOf.get(before.step.key)?.name ?? "",
        office: before.step.status === "submitted",
        taskKey: before.step.key,
      });
    } else if (before.inclusion === "structure_choice" || before.inclusion === "structure") {
      add({ title: "Choose your business structure", href: "/structure", where: STRUCTURE_WHERE, office: false, taskKey: null });
    } else if (before.inclusion === "question" || placeOpen(before, place)) {
      add({ title: `Answer whether “${before.step.title}” applies to you`, href: "/requirements#questions", where: CHECK_WHERE, office: false, taskKey: null });
    }
  }
  return blockers;
}

// Where to send the owner after a task: the next ready one in list order, then earlier ones, never a finished one
export function nextTaskAfter<T extends PaperStep>(tasks: readonly PaperworkTask<T>[], key: string | null): PaperworkTask<T> | null {
  const index = key ? tasks.findIndex((task) => task.step.key === key) : -1;
  const around = [...tasks.slice(index + 1), ...tasks.slice(0, Math.max(index, 0))];
  const ready = around.filter((task) => task.state === "ready");
  return ready.find((task) => task.step.timing !== "later") ?? ready[0] ?? null;
}
