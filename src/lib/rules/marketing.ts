import { type MarketingPlatformId, PLATFORM_DATA, type SkillArea } from "@/data/marketing-platforms";
import { BRAND_IMAGES_HREF } from "@/lib/brand/library";
import type { BrandKit } from "@/lib/brand/types";
import type { MarketingIntake, SkillLevel, StoredIntake } from "@/lib/marketing/intake";
import type { FirstAction, HandHolding, MarketingPlan, MarketingPlanReply, MarketingStep, PlanPlatform, PlatformRole, StepKind, StepLink } from "@/lib/marketing/types";

// Plain code: which platforms a plan may use, how much help each step gets, the steps and their order, and what to do next.

// Platforms the owner didn't pick, when they picked some
export const MAX_SUGGESTED = 2;

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A platform's names and other names, also as plurals and possessives ("TikToks", "Facebook’s")
function namePattern(ids: readonly MarketingPlatformId[]): RegExp | null {
  const names = ids.flatMap((id) => [PLATFORM_DATA[id].name, ...PLATFORM_DATA[id].aliases]);
  if (!names.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(escape).join("|")})(?:s|['’]s)?(?![\\p{L}\\p{N}])`, "iu");
}

export function mentionsAny(text: string, ids: readonly MarketingPlatformId[]): boolean {
  return namePattern(ids)?.test(text) ?? false;
}

// Drops each sentence that names a ruled-out platform
function scrub(text: string, pattern: RegExp | null): string {
  if (!pattern) return text;
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !pattern.test(sentence))
    .join(" ")
    .trim();
}

const ROLE_ORDER: Record<PlatformRole, number> = { main: 0, support: 1, later: 2, suggested: 3 };

const ADDED_WHY = "You picked this. Start it once your main places are going.";
const LEAD_WHY = "You picked this. Start here.";

// Account setup belongs to SnapStart's own steps, so the plan's actions don't repeat it
const SETUP_ACTION = /\b(set ?up|create|make|open|start|claim)\b.*\b(account|page|profile|channel)\b/i;

// Removes every trace of ruled-out platforms: their entries and actions, and each sentence or line naming them.
// Also run on a saved plan, for platforms ruled out after it was written.
export function withoutPlatforms<T extends MarketingPlanReply>(plan: T, exclude: readonly MarketingPlatformId[]): T {
  const banned = namePattern(exclude);
  if (!banned) return plan;
  const clean = (text: string) => scrub(text, banned);
  const keep = (text: string) => !banned.test(text);
  return {
    ...plan,
    summary: clean(plan.summary),
    goals: plan.goals.filter((goal) => keep(goal.goal)).map((goal) => ({ goal: goal.goal, measure: clean(goal.measure) })),
    audience: { who: clean(plan.audience.who), where: clean(plan.audience.where), cares: clean(plan.audience.cares) },
    platforms: plan.platforms
      .filter((entry) => !exclude.includes(entry.platform))
      .map((entry) => ({ ...entry, why: clean(entry.why), cadence: clean(entry.cadence) })),
    themes: plan.themes.filter((theme) => keep(theme.title)).map((theme) => ({ title: theme.title, idea: clean(theme.idea), examples: theme.examples.filter(keep) })),
    rhythm: clean(plan.rhythm),
    firstActions: plan.firstActions
      .filter((action) => !(action.platform && exclude.includes(action.platform)) && keep(action.title))
      .map((action) => ({ ...action, why: clean(action.why), how: action.how.filter(keep) }))
      .filter((action) => action.how.length > 0),
  };
}

// The checks every drafted plan passes before the owner sees it. Ruled-out platforms never appear, platforms the
// owner didn't pick are only suggestions (unless they picked none), every one they picked has a place, and one leads.
export function checkPlan(reply: MarketingPlanReply, intake: MarketingIntake): MarketingPlanReply {
  const clean = withoutPlatforms(reply, intake.exclude);
  const pickedAny = intake.include.length > 0;

  const seen = new Set<MarketingPlatformId>();
  let unpicked = 0;
  const platforms: PlanPlatform[] = [];
  for (const entry of clean.platforms) {
    if (seen.has(entry.platform)) continue;
    const picked = intake.include.includes(entry.platform);
    if (!picked && ++unpicked > MAX_SUGGESTED) continue;
    // Nothing picked means the owner asked for suggestions, so they can lead
    const role: PlatformRole = picked ? (entry.role === "suggested" ? "support" : entry.role) : pickedAny ? "suggested" : entry.role;
    seen.add(entry.platform);
    platforms.push({ ...entry, role });
  }
  for (const id of intake.include) {
    if (!seen.has(id)) platforms.push({ platform: id, role: "later", why: ADDED_WHY, cadence: "" });
  }
  if (!platforms.some((entry) => entry.role === "main")) {
    const lead =
      platforms.find((entry) => entry.role === "support") ??
      platforms.find((entry) => entry.role === "later") ??
      (pickedAny ? undefined : platforms.find((entry) => entry.role === "suggested"));
    if (lead) {
      lead.role = "main";
      if (lead.why === ADDED_WHY) lead.why = LEAD_WHY;
    }
  }
  // Someone new to social media starts with one main place
  if (intake.social === "new") {
    let mains = 0;
    for (const entry of platforms) if (entry.role === "main" && ++mains > 1) entry.role = "support";
  }
  platforms.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  const active = new Set(activePlatforms(platforms, intake));
  const firstActions = clean.firstActions.filter((action) => !(action.platform && active.has(action.platform) && SETUP_ACTION.test(action.title)));
  return { ...clean, platforms, firstActions };
}

// Where the owner shows up now: the plan's main and support platforms they picked, or its leads when they picked none
export function activePlatforms(platforms: readonly PlanPlatform[], intake: Pick<MarketingIntake, "include" | "exclude">): MarketingPlatformId[] {
  return platforms
    .filter((entry) => entry.role === "main" || entry.role === "support")
    .filter((entry) => (intake.include.length ? intake.include.includes(entry.platform) : true) && !intake.exclude.includes(entry.platform))
    .map((entry) => entry.platform);
}

// Every piece of text in a plan, for checks
export function planTexts(plan: MarketingPlanReply): string[] {
  return [
    plan.summary,
    ...plan.goals.flatMap((goal) => [goal.goal, goal.measure]),
    plan.audience.who,
    plan.audience.where,
    plan.audience.cares,
    ...plan.platforms.flatMap((entry) => [entry.why, entry.cadence]),
    ...plan.themes.flatMap((theme) => [theme.title, theme.idea, ...theme.examples]),
    plan.rhythm,
    ...plan.firstActions.flatMap((action) => [action.title, action.why, ...action.how]),
  ];
}

// Dollar amounts the owner's own facts don't contain
export function moneyFlags(plan: MarketingPlanReply, known: ReadonlySet<string>): string[] {
  const flags = new Set<string>();
  for (const text of planTexts(plan)) {
    for (const match of text.matchAll(/\$\d[\d,]*(?:\.\d+)?/g)) {
      if (!known.has(String(Number(match[0].slice(1).replace(/,/g, ""))))) flags.add(`Check “${match[0]}”: it isn’t in your answers.`);
    }
  }
  return [...flags];
}

const HELP_FOR: Record<SkillLevel, HandHolding> = { new: "walkthrough", some: "guided", confident: "checklist" };

// New to an area: every click, open. Some: a checklist with the walk-through a click away. Confident: the checklist.
// Unanswered gets the most help.
export function handHolding(area: SkillArea, intake: Pick<StoredIntake, SkillArea> | null): HandHolding {
  const level = intake?.[area] ?? null;
  return level ? HELP_FOR[level] : "walkthrough";
}

export interface StepContext {
  hasLogo: boolean;
  // A website platform is chosen in SnapStart
  hasWebsite: boolean;
  approvedPhotos: number;
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "step"
  );
}

type StepDraft = Omit<MarketingStep, "practice">;

// Sign-up for a new account, the account itself for one the owner has, then the platform's own guide
function platformLinks(id: MarketingPlatformId, have = false): StepLink[] {
  const platform = PLATFORM_DATA[id];
  const go = have ? platform.home : platform.start;
  return [
    ...(go ? [{ label: go.label, href: go.url, external: true, guide: false }] : []),
    { label: platform.help.label, href: platform.help.url, external: true, guide: true },
  ];
}

function lookStep(hasLogo: boolean): StepDraft {
  return hasLogo
    ? {
        key: "look",
        kind: "look",
        title: "Download your profile picture",
        why: "The same picture everywhere helps people know it’s you.",
        area: "content",
        platform: null,
        how: [
          "Open Create your logo in SnapStart.",
          "Make the Icon (profile picture) version of your logo with the + button, and choose “Use this”. It’s made to fit a circle.",
          "Download it and save it on your phone, so it’s ready when you set up each account.",
        ],
        short: ["Make and download your icon (profile picture) on Create your logo"],
        links: [{ label: "Open Create your logo", href: "/logo", external: false, guide: false }],
        by: "rule",
        general: false,
      }
    : {
        key: "look",
        kind: "look",
        title: "Make your logo and profile picture",
        why: "Every account needs a profile picture, and the same one everywhere helps people know it’s you.",
        area: "content",
        platform: null,
        how: [
          "Open Build your brand in SnapStart, answer the questions about how your business should feel, and approve your brand description.",
          "Open Create your logo, and pick the logo idea you like best or upload the logo you already have.",
          "Make the Icon (profile picture) version with the + button, and choose “Use this”.",
          "Download it. You’ll add it to each account you set up.",
        ],
        short: ["Approve your brand description", "Make or upload your logo", "Make and download your icon (profile picture)"],
        links: [
          { label: "Open Build your brand", href: "/brand", external: false, guide: false },
          { label: "Open Create your logo", href: "/logo", external: false, guide: false },
        ],
        by: "rule",
        general: false,
      };
}

function brandImagesStep(hasLogo: boolean): StepDraft {
  return {
    key: "brand_images",
    kind: "brand_images",
    title: "Create your brand images",
    why: "Covers, a website header and a link preview in your logo’s colors make every page look like the same business.",
    area: "content",
    platform: null,
    how: [
      ...(hasLogo ? [] : ["Choose or upload your logo first, on Create your logo. Brand images are made from it."]),
      "Open the Brand images group in your Brand Library.",
      "Choose + on each recommended picture: website header, Facebook cover, YouTube banner and link preview.",
      "Look each one over. Choose Edit to say what to change, or Regenerate for a new one.",
      "Choose “Use this” on the one you like. This step is done once every picture has one.",
    ],
    short: ["Make each recommended brand image in your Brand Library", "Choose “Use this” on the ones you like"],
    links: [{ label: "Open your brand images", href: BRAND_IMAGES_HREF, external: false, guide: false }],
    by: "rule",
    general: false,
  };
}

function setupStep(entry: PlanPlatform, have: boolean): StepDraft {
  const platform = PLATFORM_DATA[entry.platform];
  return {
    key: `${have ? "tidy" : "setup"}:${entry.platform}`,
    kind: have ? "tidy" : "setup",
    title: have ? (platform.tidyTitle ?? `Get your ${platform.name} ready for customers`) : (platform.setupTitle ?? `Set up ${platform.name}`),
    why: entry.why,
    area: platform.area,
    platform: entry.platform,
    how: have ? platform.tidy : platform.walkthrough,
    short: have ? platform.tidy : platform.checklist,
    links: platformLinks(entry.platform, have),
    by: "rule",
    general: platform.checked === null,
  };
}

function photosStep(approvedPhotos: number): StepDraft {
  if (approvedPhotos > 0) {
    return {
      key: "photos",
      kind: "photos",
      title: "Pick photos for your first posts",
      why: `You have ${approvedPhotos} store-ready ${approvedPhotos === 1 ? "photo" : "photos"} in Product photos.`,
      area: "content",
      platform: null,
      how: [
        "Open Product photos in SnapStart and look over the ones you approved.",
        "Pick the ones that show your best work.",
        "Download them to your phone, so they’re ready to post.",
        "Add a few everyday photos too: you at work, your table at a market, a happy customer (ask first).",
      ],
      short: ["Pick and download your best approved photos"],
      links: [{ label: "Open Product photos", href: "/photos", external: false, guide: false }],
      by: "rule",
      general: false,
    };
  }
  return {
    key: "photos",
    kind: "photos",
    title: "Get photos ready for your posts",
    why: "Posts with clear photos of what you sell get noticed.",
    area: "content",
    platform: null,
    how: [
      "Take photos near a window in daylight, on a plain background.",
      "Take a few angles of each thing you sell, plus one of you making it or doing the work.",
      "Keep them honest: show exactly what customers get.",
      "Open Product photos in SnapStart to turn your best phone photos into store-ready ones.",
    ],
    short: ["Take clear photos of what you sell", "Polish your best ones in Product photos"],
    links: [{ label: "Open Product photos", href: "/photos", external: false, guide: false }],
    by: "rule",
    general: false,
  };
}

function postsStep(plan: MarketingPlanReply): StepDraft {
  const themes = plan.themes.slice(0, 2).map((theme) => `“${theme.title}”`);
  return {
    key: "posts",
    kind: "posts",
    title: "Plan your first two weeks of posts",
    why: "A short plan keeps you posting even on busy weeks.",
    area: "content",
    platform: null,
    how: [
      themes.length ? `Pick two themes from your plan, such as ${themes.join(" and ")}.` : "Pick two things to post about.",
      "Write down six post ideas, three for each theme. Your plan has examples to start from.",
      "Match a photo or short video to each idea.",
      "For each post, write one or two sentences: what it is, and how to buy it.",
      plan.rhythm ? `Put them on a calendar that follows your weekly rhythm: ${plan.rhythm}` : "Put them on a calendar.",
      "After you post, reply to comments and messages within a day.",
    ],
    short: ["Draft two weeks of posts from your themes", "Schedule them to match your weekly rhythm"],
    links: [],
    by: "rule",
    general: false,
  };
}

function searchStep(): StepDraft {
  return {
    key: "search",
    kind: "search",
    title: "Help people find your website on Google",
    why: "People search for what they want nearby. Clear words on your site help Google show it to them.",
    area: "seo",
    platform: null,
    how: [
      "Open Website in SnapStart and draft your pages, if you haven’t yet.",
      "Check the search title and search description. Each should say what you sell and your town, in plain words.",
      "Once your site is live, add its address to every profile you set up.",
    ],
    short: ["Search title and description name what you sell and your town", "Link your site from every profile"],
    links: [{ label: "Open Website", href: "/website", external: false, guide: false }],
    by: "rule",
    general: false,
  };
}

function actionStep(action: FirstAction, key: string, active: ReadonlySet<MarketingPlatformId>): StepDraft {
  return {
    key,
    kind: "action",
    title: action.title,
    why: action.why,
    area: action.area,
    platform: action.platform,
    // The plan's own steps are already short
    how: action.how,
    short: action.how,
    // The account itself, since its setup step comes first
    links: action.platform && active.has(action.platform) && PLATFORM_DATA[action.platform].home ? [platformLinks(action.platform, true)[0]] : [],
    by: "ai",
    general: false,
  };
}

// Steps to carry out an approved plan, in order: a profile picture, brand images, accounts, photos, posts, search, then the plan's first actions.
// Only platforms the plan uses now get setup steps, and never one the owner ruled out.
export function buildMarketingSteps(
  plan: MarketingPlanReply & { simulated?: boolean },
  intake: MarketingIntake,
  context: StepContext,
): MarketingStep[] {
  const activeIds = new Set(activePlatforms(plan.platforms, intake));
  const active = plan.platforms.filter((entry) => activeIds.has(entry.platform));
  const steps: StepDraft[] = [];
  const pages = active.some((entry) => entry.platform !== "email_list");
  if (pages) steps.push(lookStep(context.hasLogo));
  // Covers for pages, and a header and link preview for a website
  if (pages || context.hasWebsite) steps.push(brandImagesStep(context.hasLogo));
  for (const entry of active) steps.push(setupStep(entry, intake.have.includes(entry.platform)));
  steps.push(photosStep(context.approvedPhotos));
  if (active.some((entry) => entry.platform !== "email_list" && PLATFORM_DATA[entry.platform].area === "social")) steps.push(postsStep(plan));
  if (context.hasWebsite) steps.push(searchStep());

  const keys = new Set(steps.map((step) => step.key));
  for (const action of plan.firstActions) {
    if (action.platform && intake.exclude.includes(action.platform)) continue;
    const base = `action:${slug(action.title)}`;
    let key = base;
    for (let n = 2; keys.has(key); n++) key = `${base}-${n}`;
    keys.add(key);
    steps.push(actionStep(action, key, activeIds));
  }
  const practice = Boolean(plan.simulated);
  // A practice plan's actions came from a template, not AI
  const marked = steps.map((step) => ({ ...step, by: practice ? ("rule" as const) : step.by, practice }));
  return visibleSteps(mergeDuplicateSteps(marked), intake.exclude);
}

// Plan actions on the same job as a built-in step, matched on the title. Profile pictures come before photos.
const STEP_TOPICS: { kind: StepKind; pattern: RegExp }[] = [
  { kind: "look", pattern: /\bprofile (picture|photo)s?\b|\b(make|design|create|choose|pick|get) (a |your )?logo\b/i },
  {
    kind: "photos",
    pattern: /\b(take|shoot|snap|prepare|get|make|edit|pick|choose|test|practice|gather)\b.*\b(photos?|pictures?|pics)\b|\b(photo|picture) (shoot|session)s?\b|\btest (photos?|shots?)\b/i,
  },
  { kind: "posts", pattern: /\b(content calendar|post(ing)? (plan|schedule|calendar)|plan\b.*\bposts?|schedule\b.*\bposts?|post ideas)\b/i },
];
const MAX_HOW = 8;
const lineKey = (line: string) => line.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Folds plan actions that repeat a built-in step into it: their new how-to lines join it, and their keys stay so ticks carry over
export function mergeDuplicateSteps(steps: readonly MarketingStep[]): MarketingStep[] {
  const out = steps.map((step) => ({ ...step, how: [...step.how], merged: step.merged ? [...step.merged] : undefined }));
  const dropped = new Set<string>();
  for (const step of out) {
    if (step.kind !== "action") continue;
    const topic = STEP_TOPICS.find((each) => each.pattern.test(step.title));
    const target = topic && out.find((each) => each.kind === topic.kind);
    if (!target) continue;
    const seen = new Set(target.how.map(lineKey));
    for (const line of step.how) {
      if (target.how.length >= MAX_HOW || seen.has(lineKey(line))) continue;
      seen.add(lineKey(line));
      target.how.push(line);
    }
    target.merged = [...new Set([...(target.merged ?? []), step.key, ...(step.merged ?? [])])];
    dropped.add(step.key);
  }
  return out.filter((step) => !dropped.has(step.key)).map(({ merged, ...step }) => (merged?.length ? { ...step, merged } : step));
}

// Every key whose tick counts for this step
export function stepKeys(step: Pick<MarketingStep, "key" | "merged">): string[] {
  return [step.key, ...(step.merged ?? [])];
}

// Saved steps get today's profile-picture and brand-image steps, so plans approved earlier never point to old pages.
// The brand images step is added where buildMarketingSteps would put it. Ticks carry over by key.
export function withCurrentBrandSteps(steps: readonly MarketingStep[], context: Pick<StepContext, "hasLogo" | "hasWebsite">): MarketingStep[] {
  const practice = steps.some((step) => step.practice);
  const fresh = (draft: StepDraft): MarketingStep => ({ ...draft, practice });
  const current = steps.map((step) => (step.kind === "look" ? fresh(lookStep(context.hasLogo)) : step.kind === "brand_images" ? fresh(brandImagesStep(context.hasLogo)) : step));
  const look = current.findIndex((step) => step.kind === "look");
  if (!current.some((step) => step.kind === "brand_images") && (look !== -1 || context.hasWebsite)) {
    current.splice(look + 1, 0, fresh(brandImagesStep(context.hasLogo)));
  }
  return mergeDuplicateSteps(current);
}

// No step, or line of a step, names a ruled-out platform, whether it came from AI or the catalog.
// Also run on saved steps, for platforms ruled out after the plan was approved.
export function visibleSteps(steps: readonly MarketingStep[], exclude: readonly MarketingPlatformId[]): MarketingStep[] {
  const banned = namePattern(exclude);
  const keep = (line: string) => !banned?.test(line);
  return steps
    .filter((step) => !(step.platform && exclude.includes(step.platform)) && keep(step.title))
    .map((step) => (banned ? { ...step, why: scrub(step.why, banned), how: step.how.filter(keep), short: step.short.filter(keep) } : step))
    .filter((step) => step.how.length > 0);
}

// What SnapStart already knows is finished, apart from the owner's ticks
export interface DoneFacts {
  // Every brand image kind has a picked file, and none is a practice preview
  brandImagesPicked: boolean;
}

// Practice previews never count: the owner can still tick the step by hand
export function doneFacts(brand: Pick<BrandKit, "images" | "simulated"> | null): DoneFacts {
  return { brandImagesPicked: Boolean(brand && !brand.simulated && Object.values(brand.images).every(Boolean)) };
}

// Steps done by what the owner made in SnapStart; they can't be unticked
export function autoDoneSteps(steps: readonly MarketingStep[], facts: DoneFacts): string[] {
  return steps.filter((step) => step.kind === "brand_images" && facts.brandImagesPicked).map((step) => step.key);
}

// Ticks for steps that are still in the list, including actions folded into them, plus steps done by facts
export function doneSteps(steps: readonly MarketingStep[], done: readonly string[], auto: readonly string[] = []): string[] {
  return steps.filter((step) => stepKeys(step).some((key) => done.includes(key)) || auto.includes(step.key)).map((step) => step.key);
}

export type MarketingMove =
  | { kind: "business" }
  | { kind: "intake" }
  | { kind: "write"; again: boolean }
  | { kind: "approve" }
  | { kind: "step"; step: MarketingStep; number: number }
  | { kind: "done" };

export interface MarketingState {
  hasProfile: boolean;
  intake: MarketingIntake | null;
  plan: Pick<MarketingPlan, "intakeKey"> | null;
  // The plan's answers still match the saved ones
  current: boolean;
  approved: boolean;
  steps: readonly MarketingStep[];
  done: readonly string[];
}

// The one thing to do next on the marketing page
export function marketingMove(state: MarketingState): MarketingMove {
  if (!state.hasProfile) return { kind: "business" };
  if (!state.intake) return { kind: "intake" };
  if (!state.plan || !state.current) return { kind: "write", again: Boolean(state.plan) };
  if (!state.approved) return { kind: "approve" };
  const index = state.steps.findIndex((step) => !state.done.includes(step.key));
  return index === -1 ? { kind: "done" } : { kind: "step", step: state.steps[index], number: index + 1 };
}
