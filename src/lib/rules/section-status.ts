import { CHECK_WHERE, type GroupState } from "./paperwork";
import { CONTACT_HREF, CONTACT_STEP_TITLE } from "./contact-setup";
import { CHECK_MINUTES, stepMinutes } from "./progress";

// Plain code: whether each step in the sidebar is done, waiting on someone else, locked behind another, or still the owner's to do

export type PartState = "done" | "waiting" | "locked" | "todo";

export interface PartStatus {
  state: PartState;
  // What the owner can still start here, and its time; zero elsewhere
  count: number;
  minutes: number;
  // What a locked step waits on, by where the owner does it
  waitsOn?: string[];
  // What the count counts; only steps add up to Today's total, like Today's own count
  unit?: "step" | "question" | "decision";
  // The step's name when it depends on the owner's answers, such as "Manage your services"
  title?: string;
}

// A paperwork group as the menu shows it
export interface GroupFacts {
  href: string;
  // The group's title, and its part when it's split
  title: string;
  part: string | null;
  name: string;
  state: GroupState;
  left: number;
  minutesLeft: number;
  waitsOn: readonly string[];
  later: boolean;
}

export interface JourneyFacts {
  // Saved answers that still fit the questions
  business: boolean;
  research: "none" | "stale" | "current";
  // Plan changes from a re-check or a new decision, waiting for the owner's review
  // Questions and place answers still open on What applies to you
  questionsOpen: number;
  structureChosen: boolean;
  // The plan's own structure step, counted under Business structure until one is chosen
  structureStep: { left: number; minutes: number };
  // Paperwork groups, once there are any
  groups: readonly GroupFacts[];
  // Library documents with answers for the owner to check or facts that changed
  libraryToCheck: number;
  logoChosen: boolean;
  // The owner approved the short description of their brand
  brandDescribed: boolean;
  // The demo finish of a SnapStart site, or an existing site connected in the demo
  websiteFinished: boolean;
  websiteConnected: boolean;
  products: number;
  // The products step's name, from the owner's answers and confirmed items
  productsTitle?: string;
  marketingApproved: boolean;
  // Accounts the owner picked in their marketing plan, and the ones they already have
  socialPlatforms: readonly string[];
  socialHave: readonly string[];
  // "I already have this" marks by key
  marks: ReadonlySet<string>;
  // The business email and phone step, once the owner put it in their plan
  contact?: "none" | "todo" | "done";
}

export type SidebarStatus = Record<string, PartStatus>;

// Brand steps the owner can mark "I already have this"; social accounts add their platform, like "social:instagram"
export const MARK_KEYS = ["logo", "brand", "website", "products", "marketing", "social"] as const;
export type MarkKey = (typeof MARK_KEYS)[number];

export interface StartStep {
  href: string;
  title: string;
  // "Part 1 of 2", shown under the title so the menu stays short
  part?: string | null;
  // After the first sale: shown, but it never holds the section open
  later: boolean;
}

// Stands in for the paperwork groups until the check finds what applies
export const PAPERWORK_PLACEHOLDER: StartStep = { href: "/start#paperwork", title: "Licenses and registrations", later: false };

export const START_STEPS: readonly StartStep[] = [
  { href: "/business", title: "Your business", later: false },
  { href: "/structure", title: "Business structure", later: false },
  { href: "/requirements", title: "What applies to you", later: false },
];

// A paperwork group or one of its parts, as the paperwork rules give it
export interface PartFacts {
  key: string;
  base: string;
  href: string;
  title: string;
  name: string;
  part: { index: number; of: number } | null;
  state: GroupState;
  left: number;
  minutesLeft: number;
  waitsOn: readonly string[];
  later: boolean;
}

// One menu step per group, so the menu fits; a split group shows the part to work on now, and its time
export function menuGroups(parts: readonly PartFacts[]): (GroupFacts & { hrefs: string[] })[] {
  const bases = [...new Set(parts.map((part) => part.base))];
  return bases.map((base) => {
    const all = parts.filter((part) => part.base === base);
    const open = all.filter((part) => part.state !== "done");
    const current = all.find((part) => part.state === "todo") ?? open[0] ?? all[all.length - 1];
    const state: GroupState = !open.length
      ? "done"
      : open.some((part) => part.state === "todo")
        ? "todo"
        : open.every((part) => part.state === "waiting")
          ? "waiting"
          : "locked";
    const own = new Set(all.map((part) => part.name));
    return {
      href: current.href,
      hrefs: all.map((part) => part.href),
      title: current.title,
      part: current.part ? `Part ${current.part.index} of ${current.part.of}` : null,
      name: current.name,
      state,
      left: all.reduce((sum, part) => sum + part.left, 0),
      minutesLeft: current.minutesLeft,
      waitsOn: state === "locked" ? [...new Set(open.flatMap((part) => part.waitsOn))].filter((where) => !own.has(where)) : [],
      later: current.later,
    };
  });
}

// The steps of Start your business in order: the three fixed ones, email and phone if the owner put it off, then one per paperwork group
export function startSteps(groups: readonly Pick<GroupFacts, "href" | "title" | "part" | "later">[], contact = false): StartStep[] {
  return [
    ...START_STEPS,
    ...(contact ? [{ href: CONTACT_HREF, title: CONTACT_STEP_TITLE, later: false }] : []),
    ...(groups.length ? groups.map((group) => ({ href: group.href, title: group.title, part: group.part, later: group.later })) : [PAPERWORK_PLACEHOLDER]),
  ];
}

const DONE: PartStatus = { state: "done", count: 0, minutes: 0 };
// Signing up for an email address and a phone number
const CONTACT_MINUTES = 20;
const TODO: PartStatus = { state: "todo", count: 0, minutes: 0 };
const either = (done: boolean) => (done ? DONE : TODO);
const locked = (waitsOn: string[]): PartStatus => ({ state: "locked", count: 0, minutes: 0, waitsOn });

export function sidebarStatus(facts: JourneyFacts): SidebarStatus {
  const marked = (key: string) => facts.marks.has(key);
  const checkDone = facts.research === "current" && facts.questionsOpen === 0;
  const groups = Object.fromEntries(
    facts.groups.map((group): [string, PartStatus] => [
      group.href,
      group.state === "done"
        ? DONE
        : group.state === "waiting"
          ? { state: "waiting", count: 0, minutes: 0 }
          : {
              state: group.state,
              // After you open is kept out of what's left before the first sale
              count: group.later ? 0 : group.left,
              minutes: group.minutesLeft,
              ...(group.state === "locked" ? { waitsOn: [...group.waitsOn] } : {}),
            },
    ]),
  );
  return {
    "/business": either(facts.business),
    "/structure": !facts.business
      ? locked(["Your business"])
      : facts.structureChosen
        ? DONE
        : { state: "todo", count: facts.structureStep.left, minutes: facts.structureStep.minutes || stepMinutes({ topic: "structure" }), unit: "decision" },
    "/requirements": !facts.business
      ? locked(["Your business"])
      : checkDone
        ? DONE
        : { state: "todo", count: facts.research === "current" ? facts.questionsOpen : 0, minutes: CHECK_MINUTES, unit: "question" },
    ...(facts.groups.length ? groups : { [PAPERWORK_PLACEHOLDER.href]: checkDone ? DONE : locked([CHECK_WHERE]) }),
    ...(facts.contact && facts.contact !== "none" ? { [CONTACT_HREF]: facts.contact === "done" ? DONE : { state: "todo" as const, count: 1, minutes: CONTACT_MINUTES } } : {}),
    // Not a step: just a count of documents to check
    "/documents": { state: facts.libraryToCheck ? "todo" : "done", count: facts.libraryToCheck, minutes: 0 },
    "/brand": either(facts.brandDescribed || marked("brand")),
    "/logo": either(facts.logoChosen || marked("logo")),
    "/website": either(facts.websiteFinished || facts.websiteConnected || marked("website")),
    "/products": { ...either(facts.products > 0 || marked("products")), ...(facts.productsTitle ? { title: facts.productsTitle } : {}) },
    "/marketing": either(facts.marketingApproved || marked("marketing")),
    "/social": either(
      marked("social") ||
        (facts.socialPlatforms.length > 0 && facts.socialPlatforms.every((platform) => facts.socialHave.includes(platform) || marked(`social:${platform}`))),
    ),
  };
}

// Steps left across the menu's sections, counted as Today counts them: paperwork and brand steps, not decisions or questions
export function stepsLeft(status: SidebarStatus, hrefs: readonly string[]): number {
  return hrefs.reduce((sum, href) => sum + (status[href] && (status[href].unit ?? "step") === "step" ? status[href].count : 0), 0);
}

// A section is done once nothing in it is left for the owner; it's waiting if any step still is. Locked steps wait on the owner.
export function sectionState(status: SidebarStatus, hrefs: readonly string[]): "done" | "waiting" | "todo" {
  const states = hrefs.flatMap((href) => status[href]?.state ?? []);
  if (!states.length || states.includes("todo") || states.includes("locked")) return "todo";
  return states.includes("waiting") ? "waiting" : "done";
}
