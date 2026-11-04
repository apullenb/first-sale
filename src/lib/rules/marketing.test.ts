import { describe, expect, it } from "vitest";
import { PLATFORM_DATA } from "@/data/marketing-platforms";
import type { MarketingIntake } from "@/lib/marketing/intake";
import type { MarketingPlanReply, MarketingStep } from "@/lib/marketing/types";
import {
  autoDoneSteps,
  buildMarketingSteps,
  doneFacts,
  checkPlan,
  doneSteps,
  handHolding,
  marketingMove,
  mentionsAny,
  moneyFlags,
  planTexts,
  type StepContext,
  visibleSteps,
  withCurrentBrandSteps,
  withoutPlatforms,
} from "./marketing";

function intake(overrides: Partial<MarketingIntake> = {}): MarketingIntake {
  return { include: ["instagram"], have: [], exclude: [], social: "some", seo: "some", content: "some", done: ["none"], doneNote: "", ...overrides };
}

function reply(overrides: Partial<MarketingPlanReply> = {}): MarketingPlanReply {
  return {
    summary: "Reach neighbors who love bread.",
    goals: [{ goal: "Get first orders", measure: "Ask each customer how they found you." }],
    audience: { who: "Families nearby.", where: "The Saturday market.", cares: "Fresh bread." },
    platforms: [{ platform: "instagram", role: "main", why: "Bread photographs well.", cadence: "Twice a week." }],
    themes: [{ title: "Fresh from the oven", idea: "Show each bake.", examples: ["A close-up of a loaf."] }],
    rhythm: "Plan on Sunday, post Tuesday and Friday.",
    firstActions: [{ title: "Tell your neighbors", why: "They buy first.", area: "social", platform: null, how: ["Write a short note."] }],
    ...overrides,
  };
}

const CONTEXT: StepContext = { hasLogo: false, hasWebsite: false, approvedPhotos: 0 };

describe("checkPlan", () => {
  it("never lets a ruled-out platform through, by entry, action or name in the text", () => {
    const checked = checkPlan(
      reply({
        summary: "Start on Instagram. TikTok videos would also help. Keep it simple.",
        goals: [
          { goal: "Grow on TikTok", measure: "Followers." },
          { goal: "First orders", measure: "Ask customers. Or check tiktok views." },
        ],
        platforms: [
          { platform: "instagram", role: "main", why: "Photos sell bread. Unlike TikTok, it’s calm.", cadence: "Twice a week." },
          { platform: "tiktok", role: "main", why: "Videos.", cadence: "Daily." },
        ],
        themes: [
          { title: "TikTok trends", idea: "Dance.", examples: [] },
          { title: "Bakes", idea: "Show loaves.", examples: ["A loaf.", "Cross-post it to TikTok."] },
        ],
        firstActions: [
          { title: "Film a TikTok", why: "Reach.", area: "content", platform: "tiktok", how: ["Film."] },
          { title: "Post a loaf", why: "Show it. TikTok can wait.", area: "content", platform: "instagram", how: ["Take a photo.", "Share it on TikTok too."] },
        ],
      }),
      intake({ exclude: ["tiktok"] }),
    );
    expect(checked.platforms.map((entry) => entry.platform)).toEqual(["instagram"]);
    expect(checked.summary).toBe("Start on Instagram. Keep it simple.");
    expect(checked.goals).toEqual([{ goal: "First orders", measure: "Ask customers." }]);
    expect(checked.themes.map((theme) => theme.title)).toEqual(["Bakes"]);
    expect(checked.themes[0].examples).toEqual(["A loaf."]);
    expect(checked.firstActions).toEqual([{ title: "Post a loaf", why: "Show it.", area: "content", platform: "instagram", how: ["Take a photo."] }]);
    expect(mentionsAny(planTexts(checked).join(" "), ["tiktok"])).toBe(false);
  });

  it("catches other names, plurals and possessives of a ruled-out platform, but not words that contain them", () => {
    expect(mentionsAny("Post it on IG.", ["instagram"])).toBe(true);
    expect(mentionsAny("A big loaf.", ["instagram"])).toBe(false);
    expect(mentionsAny("Start a newsletter.", ["email_list"])).toBe(true);
    expect(mentionsAny("Add it to Google Maps.", ["google_business"])).toBe(true);
    expect(mentionsAny("Ask for Google reviews.", ["google_business"])).toBe(true);
    expect(mentionsAny("Post three TikToks a week.", ["tiktok"])).toBe(true);
    expect(mentionsAny("Use Facebook’s events.", ["facebook"])).toBe(true);
    expect(mentionsAny("Ask a local YouTuber.", ["youtube"])).toBe(true);
    expect(mentionsAny("Fill in your Instagram business profile.", ["google_business"])).toBe(false);
  });

  it("keeps platforms the owner didn't pick only as a few suggestions", () => {
    const checked = checkPlan(
      reply({
        platforms: [
          { platform: "instagram", role: "suggested", why: "", cadence: "" },
          { platform: "google_business", role: "main", why: "", cadence: "" },
          { platform: "nextdoor", role: "support", why: "", cadence: "" },
          { platform: "yelp", role: "later", why: "", cadence: "" },
          { platform: "instagram", role: "later", why: "duplicate", cadence: "" },
        ],
      }),
      intake(),
    );
    // The one picked platform also leads, since nothing else can
    expect(checked.platforms.map((entry) => [entry.platform, entry.role])).toEqual([
      ["instagram", "main"],
      ["google_business", "suggested"],
      ["nextdoor", "suggested"],
    ]);
  });

  it("makes a picked platform lead when the draft put them all off until later", () => {
    const draft = reply({ platforms: [{ platform: "facebook", role: "later", why: "", cadence: "" }] });
    const answers = intake({ include: ["instagram", "facebook"] });
    const checked = checkPlan(draft, answers);
    expect(checked.platforms.map((entry) => [entry.platform, entry.role])).toEqual([
      ["facebook", "main"],
      ["instagram", "later"],
    ]);
    expect(buildMarketingSteps(checked, answers, CONTEXT).map((step) => step.key)).toContain("setup:facebook");

    // One the draft left out entirely gets a reason that fits leading
    const none = checkPlan(reply({ platforms: [] }), answers);
    expect(none.platforms[0]).toMatchObject({ platform: "instagram", role: "main", why: "You picked this. Start here." });
  });

  it("lets its suggestions lead when the owner picked none, and sets them up", () => {
    const draft = reply({
      platforms: [
        { platform: "instagram", role: "suggested", why: "", cadence: "" },
        { platform: "facebook", role: "suggested", why: "", cadence: "" },
        { platform: "nextdoor", role: "suggested", why: "", cadence: "" },
      ],
    });
    const answers = intake({ include: [], exclude: ["tiktok"] });
    const checked = checkPlan(draft, answers);
    expect(checked.platforms.map((entry) => [entry.platform, entry.role])).toEqual([
      ["instagram", "main"],
      ["facebook", "suggested"],
    ]);
    expect(buildMarketingSteps(checked, answers, CONTEXT).filter((step) => step.kind === "setup").map((step) => step.key)).toEqual(["setup:instagram"]);
  });

  it("gives every picked platform a place, even when the draft left it out", () => {
    const checked = checkPlan(reply(), intake({ include: ["instagram", "email_list"] }));
    expect(checked.platforms.find((entry) => entry.platform === "email_list")).toMatchObject({ role: "later" });
  });

  it("starts someone new to social media with one main place", () => {
    const draft = reply({
      platforms: [
        { platform: "instagram", role: "main", why: "", cadence: "" },
        { platform: "facebook", role: "main", why: "", cadence: "" },
      ],
    });
    const roles = (social: MarketingIntake["social"]) =>
      checkPlan(draft, intake({ include: ["instagram", "facebook"], social })).platforms.map((entry) => entry.role);
    expect(roles("new")).toEqual(["main", "support"]);
    expect(roles("confident")).toEqual(["main", "main"]);
  });

  it("leaves account setup to SnapStart's own steps", () => {
    const checked = checkPlan(
      reply({
        firstActions: [
          { title: "Set up your Instagram business account", why: "", area: "social", platform: "instagram", how: ["Tap Sign up."] },
          { title: "Post your first loaf", why: "", area: "content", platform: "instagram", how: ["Take a photo."] },
        ],
      }),
      intake(),
    );
    expect(checked.firstActions.map((action) => action.title)).toEqual(["Post your first loaf"]);
  });
});

describe("moneyFlags", () => {
  it("flags dollar amounts the owner didn't give", () => {
    const draft = reply({ rhythm: "Boost one post for $20. Price loaves at $8.", summary: "Spend $1,000 on signs." });
    expect(moneyFlags(draft, new Set(["8"]))).toEqual(["Check “$1,000”: it isn’t in your answers.", "Check “$20”: it isn’t in your answers."]);
  });
});

describe("handHolding", () => {
  it("follows the owner's answer for each area on its own", () => {
    const answers = { social: "new", seo: "some", content: "confident" } as const;
    expect(handHolding("social", answers)).toBe("walkthrough");
    expect(handHolding("seo", answers)).toBe("guided");
    expect(handHolding("content", answers)).toBe("checklist");
  });

  it("gives the most help when there's no answer", () => {
    expect(handHolding("seo", null)).toBe("walkthrough");
    expect(handHolding("seo", { social: "confident", seo: null, content: "confident" })).toBe("walkthrough");
  });
});

describe("buildMarketingSteps", () => {
  const plan = reply({
    platforms: [
      { platform: "instagram", role: "main", why: "Bread photographs well.", cadence: "" },
      { platform: "google_business", role: "support", why: "People search nearby.", cadence: "" },
      { platform: "facebook", role: "later", why: "", cadence: "" },
      { platform: "pinterest", role: "suggested", why: "", cadence: "" },
    ],
  });
  const answers = intake({ include: ["instagram", "google_business", "facebook"], have: ["google_business"] });

  it("sets up only the places the plan uses now, and tidies the ones the owner has", () => {
    const steps = buildMarketingSteps(plan, answers, CONTEXT);
    expect(steps.map((step) => step.key)).toEqual(["look", "brand_images", "setup:instagram", "tidy:google_business", "photos", "posts", "action:tell-your-neighbors"]);
    const instagram = steps.find((step) => step.key === "setup:instagram")!;
    expect(instagram).toMatchObject({ area: "social", why: "Bread photographs well.", how: PLATFORM_DATA.instagram.walkthrough, short: PLATFORM_DATA.instagram.checklist, by: "rule" });
    expect(instagram.links[0]).toEqual({ label: PLATFORM_DATA.instagram.start!.label, href: PLATFORM_DATA.instagram.start!.url, external: true, guide: false });
    const google = steps.find((step) => step.key === "tidy:google_business")!;
    expect(google).toMatchObject({ area: "seo", how: PLATFORM_DATA.google_business.tidy });
    // An account the owner has opens the account, not sign-up
    expect(google.links[0].href).toBe(PLATFORM_DATA.google_business.home!.url);
  });

  it("never makes a step for a platform the owner ruled out", () => {
    const sneaky = { ...plan, firstActions: [{ title: "Post on Pinterest", why: "", area: "social" as const, platform: "pinterest" as const, how: ["Pin it."] }] };
    const steps = buildMarketingSteps(sneaky, { ...answers, include: ["instagram"], have: [], exclude: ["google_business", "pinterest"] }, CONTEXT);
    expect(steps.some((step) => step.platform === "google_business" || step.platform === "pinterest")).toBe(false);
  });

  it("keeps a ruled-out platform's name out of every step's text", () => {
    const named = {
      ...plan,
      rhythm: "Post on Sunday. Cross-post to TikTok.",
      firstActions: [{ title: "Show a loaf", why: "It sells. TikTok loves it.", area: "content" as const, platform: null, how: ["Take a photo.", "Share it on TikTok."] }],
    };
    const steps = buildMarketingSteps(named, { ...answers, exclude: ["tiktok", "facebook"] }, CONTEXT);
    const text = steps.flatMap((step) => [step.title, step.why, ...step.how, ...step.short]).join(" ");
    expect(mentionsAny(text, ["tiktok", "facebook"])).toBe(false);
    expect(steps.find((step) => step.kind === "action")).toMatchObject({ why: "It sells.", how: ["Take a photo."] });
  });

  it("uses what the owner already made in SnapStart", () => {
    const steps = buildMarketingSteps(plan, answers, { hasLogo: true, hasWebsite: true, approvedPhotos: 3 });
    expect(steps.find((step) => step.key === "look")).toMatchObject({ title: "Download your profile picture", links: [{ href: "/logo" }] });
    expect(steps.find((step) => step.key === "brand_images")).toMatchObject({
      kind: "brand_images",
      title: "Create your brand images",
      links: [{ href: "/brand-library#group-brand_images", external: false }],
      by: "rule",
    });
    expect(steps.find((step) => step.key === "photos")?.why).toBe("You have 3 store-ready photos in Product photos.");
    expect(steps.find((step) => step.key === "search")).toMatchObject({ area: "seo", links: [{ href: "/website", external: false, guide: false }] });
  });

  it("skips the profile picture and posts when the plan uses only an email list", () => {
    const emailOnly = reply({ platforms: [{ platform: "email_list", role: "main", why: "", cadence: "" }] });
    const steps = buildMarketingSteps(emailOnly, intake({ include: ["email_list"] }), CONTEXT);
    expect(steps.map((step) => step.key)).toEqual(["setup:email_list", "photos", "action:tell-your-neighbors"]);
    expect(steps[0].title).toBe("Start your email list");
    expect(steps[0].links.map((link) => link.guide)).toEqual([true]);
    // A website still gets a header picture and link preview
    expect(buildMarketingSteps(emailOnly, intake({ include: ["email_list"] }), { ...CONTEXT, hasWebsite: true }).map((step) => step.key)).toContain("brand_images");
  });

  it("points to step 1 and step 2 before there's a logo, and asks for a logo before brand images", () => {
    const steps = buildMarketingSteps(plan, answers, CONTEXT);
    expect(steps.find((step) => step.key === "look")?.links.map((link) => link.href)).toEqual(["/brand", "/logo"]);
    expect(steps.find((step) => step.key === "brand_images")?.how[0]).toContain("Choose or upload your logo first");
  });

  it("gives the plan's own actions a checklist too, and marks practice plans' steps as the rules'", () => {
    const action = buildMarketingSteps(plan, answers, CONTEXT).find((step) => step.kind === "action")!;
    expect(action).toMatchObject({ how: ["Write a short note."], short: ["Write a short note."], by: "ai", practice: false });
    const practice = buildMarketingSteps({ ...plan, simulated: true }, answers, CONTEXT);
    expect(practice.every((step) => step.by === "rule" && step.practice)).toBe(true);
  });

  it("keeps action keys unique and marks them as AI's", () => {
    const twice = reply({
      firstActions: [
        { title: "Hand out cards", why: "", area: "content", platform: null, how: ["Print them."] },
        { title: "Hand out cards!", why: "", area: "content", platform: null, how: ["Again."] },
      ],
    });
    const actions = buildMarketingSteps(twice, intake(), CONTEXT).filter((step) => step.kind === "action");
    expect(actions.map((step) => [step.key, step.by])).toEqual([
      ["action:hand-out-cards", "ai"],
      ["action:hand-out-cards-2", "ai"],
    ]);
  });
});

describe("after the owner rules out a platform", () => {
  const answers = intake({ include: ["instagram", "facebook"] });
  const plan = reply({
    rhythm: "Post on Instagram Tuesdays. Plan on Sunday.",
    platforms: [
      { platform: "instagram", role: "main", why: "Photos sell bread.", cadence: "" },
      { platform: "facebook", role: "support", why: "Neighbors are there. Instagram posts can go here too.", cadence: "" },
    ],
  });
  const steps = buildMarketingSteps(plan, answers, CONTEXT);

  it("hides saved steps and lines that name it", () => {
    const shown = visibleSteps(steps, ["instagram"]);
    expect(shown.some((step) => step.platform === "instagram")).toBe(false);
    expect(mentionsAny(shown.flatMap((step) => [step.title, step.why, ...step.how, ...step.short]).join(" "), ["instagram"])).toBe(false);
    expect(shown.find((step) => step.key === "setup:facebook")?.why).toBe("Neighbors are there.");
  });

  it("drops a step with nothing left to do", () => {
    const action = { ...steps.find((step) => step.kind === "action")!, how: ["Post it on Instagram."], short: ["Post it on Instagram."] };
    expect(visibleSteps([action], ["instagram"])).toEqual([]);
  });

  it("hides it in the saved plan too", () => {
    const shown = withoutPlatforms({ ...plan, version: 1 as const }, ["instagram"]);
    expect(shown.platforms.map((entry) => entry.platform)).toEqual(["facebook"]);
    expect(mentionsAny(planTexts(shown).join(" "), ["instagram"])).toBe(false);
    expect(shown.version).toBe(1);
  });
});

describe("steps saved before brand images moved", () => {
  const plan = reply({ platforms: [{ platform: "instagram", role: "main", why: "", cadence: "" }] });
  const built = buildMarketingSteps({ ...plan, simulated: true }, intake({ include: ["instagram"] }), CONTEXT);
  // As an earlier approval saved them: the old profile picture step, and no brand images step
  const saved: MarketingStep[] = built
    .filter((step) => step.kind !== "brand_images")
    .map((step) =>
      step.kind === "look"
        ? { ...step, title: "Download your profile picture and cover", how: ["Open Build your brand in SnapStart.", "Download the cover pictures for Facebook and YouTube if you’ll use them."], links: [{ label: "Open Build your brand", href: "/brand", external: false, guide: false }] }
        : step,
    );

  it("get today's profile picture step and the brand images step, in place, without the model", () => {
    const current = withCurrentBrandSteps(saved, { hasLogo: true, hasWebsite: false });
    expect(current.map((step) => step.key)).toEqual(["look", "brand_images", ...saved.slice(1).map((step) => step.key)]);
    const text = current.flatMap((step) => [step.title, ...step.how, ...step.links.map((link) => link.href)]).join(" ");
    expect(text).not.toContain("Build your brand");
    expect(text).not.toContain("cover pictures");
    expect(current[0].links.map((link) => link.href)).toEqual(["/logo"]);
    expect(current[1]).toMatchObject({ kind: "brand_images", by: "rule", practice: true, links: [{ href: "/brand-library#group-brand_images" }] });
    expect(current.slice(2)).toEqual(saved.slice(1));
  });

  it("change nothing more when read again", () => {
    const once = withCurrentBrandSteps(saved, { hasLogo: false, hasWebsite: false });
    expect(withCurrentBrandSteps(once, { hasLogo: false, hasWebsite: false })).toEqual(once);
    expect(once[0].links.map((link) => link.href)).toEqual(["/brand", "/logo"]);
  });

  it("add brand images to an email-only plan only when there's a website", () => {
    const email = buildMarketingSteps(reply({ platforms: [{ platform: "email_list", role: "main", why: "", cadence: "" }] }), intake({ include: ["email_list"] }), CONTEXT);
    expect(withCurrentBrandSteps(email, { hasLogo: true, hasWebsite: false })).toEqual(email);
    expect(withCurrentBrandSteps(email, { hasLogo: true, hasWebsite: true })[0].key).toBe("brand_images");
  });
});

describe("doneSteps", () => {
  it("never counts practice previews as made brand images", () => {
    const file = { url: "/brand/files/x?view=1", width: 10, height: 10 };
    const images = { websiteHero: file, facebookCover: file, youtubeBanner: file, linkPreview: file, instagramPost: null, instagramStory: null, adSquare: null, flyer: null, productScene: null };
    // The social, ad and print pictures are optional
    expect(doneFacts({ images, simulated: false })).toEqual({ brandImagesPicked: true });
    expect(doneFacts({ images, simulated: true })).toEqual({ brandImagesPicked: false });
    expect(doneFacts({ images: { ...images, linkPreview: null }, simulated: false })).toEqual({ brandImagesPicked: false });
    expect(doneFacts(null)).toEqual({ brandImagesPicked: false });
  });

  it("counts the brand images step done once every kind has a picked image, or when ticked", () => {
    const steps = [{ key: "look", kind: "look" }, { key: "brand_images", kind: "brand_images" }] as MarketingStep[];
    expect(autoDoneSteps(steps, { brandImagesPicked: false })).toEqual([]);
    expect(autoDoneSteps(steps, { brandImagesPicked: true })).toEqual(["brand_images"]);
    expect(doneSteps(steps, [], autoDoneSteps(steps, { brandImagesPicked: true }))).toEqual(["brand_images"]);
    expect(doneSteps(steps, ["brand_images"], [])).toEqual(["brand_images"]);
    expect(doneSteps(steps, ["look"], [])).toEqual(["look"]);
  });

  it("drops ticks for steps that are gone", () => {
    expect(doneSteps([{ key: "look" } as MarketingStep], ["look", "setup:tiktok"])).toEqual(["look"]);
  });
});

describe("marketingMove", () => {
  const step = (key: string) => ({ key, title: key }) as MarketingStep;
  const base = { hasProfile: true, intake: intake(), plan: { intakeKey: "k" }, current: true, approved: true, steps: [step("a"), step("b")], done: [] as string[] };

  it("walks the owner through questions, plan, approval and steps", () => {
    expect(marketingMove({ ...base, hasProfile: false })).toEqual({ kind: "business" });
    expect(marketingMove({ ...base, intake: null })).toEqual({ kind: "intake" });
    expect(marketingMove({ ...base, plan: null, current: false })).toEqual({ kind: "write", again: false });
    expect(marketingMove({ ...base, current: false })).toEqual({ kind: "write", again: true });
    expect(marketingMove({ ...base, approved: false })).toEqual({ kind: "approve" });
    expect(marketingMove({ ...base, done: ["a"] })).toMatchObject({ kind: "step", step: { key: "b" }, number: 2 });
    expect(marketingMove({ ...base, done: ["a", "b"] })).toEqual({ kind: "done" });
  });
});

describe("duplicate steps", () => {
  const testPhotos = { title: "Take test photos of your cookies", why: "Practice first.", area: "content" as const, platform: null, how: ["Shoot near a window.", "Try a plain board as a background."] };

  it("folds a plan action that repeats the photo step into it, keeping new how-to lines", () => {
    const steps = buildMarketingSteps(reply({ firstActions: [testPhotos, reply().firstActions[0]] }), intake(), CONTEXT);
    expect(steps.filter((step) => /photo/i.test(step.title))).toHaveLength(1);
    const photos = steps.find((step) => step.kind === "photos")!;
    expect(photos.how).toContain("Try a plain board as a background.");
    expect(photos.merged).toEqual(["action:take-test-photos-of-your-cookies"]);
    expect(steps.some((step) => step.title === "Tell your neighbors")).toBe(true);
  });

  it("counts a tick on the folded action as the photo step's", () => {
    const steps = buildMarketingSteps(reply({ firstActions: [testPhotos] }), intake(), CONTEXT);
    expect(doneSteps(steps, ["action:take-test-photos-of-your-cookies"])).toEqual(["photos"]);
  });

  it("folds duplicates in steps saved before this check", () => {
    const step = { why: "", area: "content" as const, platform: null, short: [], links: [], general: false, practice: false };
    const saved: MarketingStep[] = [
      { ...step, key: "photos", kind: "photos", title: "Get photos ready for your posts", how: ["Take photos."], by: "rule" },
      { ...step, key: "action:test-shots", kind: "action", title: "Do a test photo shoot", how: ["Take photos."], by: "ai" },
    ];
    const current = withCurrentBrandSteps(saved, { hasLogo: false, hasWebsite: false });
    expect(current.map((each) => each.key)).toEqual(["photos"]);
    expect(current[0].how).toEqual(["Take photos."]);
  });

  it("leaves other actions alone, even ones that mention photos or the logo", () => {
    const action = (title: string) => ({ title, why: "", area: "content" as const, platform: null, how: ["Do it."] });
    const titles = ["Post your first photo", "Make a sign with your logo"];
    const steps = buildMarketingSteps(reply({ firstActions: titles.map(action) }), intake(), CONTEXT);
    for (const title of titles) expect(steps.some((each) => each.title === title)).toBe(true);
  });
});
