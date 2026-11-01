import { DETAILS, detailAnchor } from "@/lib/details";
import { getSection } from "@/lib/sections";
import { INSIGHT_SECTIONS, type Insight, type InsightLink, type InsightPage, type InsightReplyItem, type InsightSection, type InsightsReply } from "./types";

// Code checks on the model's reply, run every time: tone, numbers, legal pointers, caps and links.
// Word lists can't catch every wording, so they lean toward leaving a point out.

export const INSIGHT_CAPS: Record<InsightSection, number> = { strengths: 4, watch: 3, tips: 4, ideas: 3 };

// Shortest useful next step for something to keep an eye on
const MIN_ACTION = 8;

export const PAGE_LINKS: Record<InsightPage, InsightLink> = {
  business: { href: "/business", label: getSection("/business").title },
  requirements: { href: "/requirements", label: getSection("/requirements").title },
  structure: { href: "/structure", label: getSection("/structure").title },
  checklist: { href: "/start", label: getSection("/start").title },
  documents: { href: "/documents", label: getSection("/documents").title },
  business_plan: { href: "/documents/business-plan", label: "Business plan" },
  logo: { href: "/logo", label: getSection("/logo").title },
  brand: { href: "/brand", label: getSection("/brand").title },
  website: { href: "/website", label: getSection("/website").title },
  photos: { href: "/photos", label: getSection("/photos").title },
  details: { href: "/business#details-heading", label: "Business details" },
  pickup: { href: `/business#${detailAnchor("pickup_details")}`, label: `Add ${DETAILS.pickup_details.label.toLowerCase()}` },
};

// Actions the owner does in one field: the link opens that field, whatever page the model picked
const FIELD_ACTIONS: [RegExp, InsightLink][] = [
  [/\bpick[- ]?ups?\b[^.]{0,40}\b(?:hours?|times?|days?|location|place|spot|address|details)\b|\b(?:hours?|times?|location|place|spot)\b[^.]{0,30}\bpick[- ]?ups?\b/i, PAGE_LINKS.pickup],
];

// Pages whose legal facts SnapStart checked against official sources
const SOURCED_HREFS = new Set(["/requirements", "/start", "/checklist", "/structure", "/documents"]);

const SMALL_NUMBER_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety";

// Wording that discourages rather than helps. An item using any of it is left out.
const DISCOURAGING: RegExp[] = [
  /\b(?:won[’']t|will not|wouldn[’']t|doesn[’']t|does not|may not|might not) (?:work|sell|succeed|last|pay off)\b/i,
  /\b(?:bad|poor|terrible|awful|weak) (?:idea|plan|choice|fit)\b/i,
  // A business or its owner failing or struggling; a card reader that might fail is fine
  /\b(?:you|it|this|business(?:es)?|idea|plan|venture|shops?|stores?|bakery|bakeries|company|companies|owners?|bakers?|sellers?|makers?|vendors?|startups?)(?:['’]ll|\s+(?:will|might|may|could|would|often|usually|tend to|is likely to|are likely to|is going to|are going to|is bound to))?\s+(?:fail|struggle|go under)\b/i,
  /\bfailures?\b/i,
  /\b(?:un|not )realistic\b/i,
  /(?<!(?:don[’']t|never|not)\s)\bgive up\b/i,
  /\bquit (?:your|the)\b/i,
  /\b(?:doomed|hopeless|pointless|impossible|unviable|not viable)\b/i,
  /\bwaste of (?:time|money)\b/i,
  /\b(?:saturated|over-?crowded|cutthroat|cut-throat)\b/i,
  /\bcrowded (?:field|space|industry)\b|\bmarket is (?:crowded|full)\b/i,
  /\b(?:too|very|highly|extremely|fiercely|really|quite|pretty|is|are|be|gets?|getting) competitive\b/i,
  /\bcompetitive (?:market|field|space|industry)\b/i,
  /\breconsider\b/i,
  /\brisk(?:y|ier|iest)\b/i,
  /\btough (?:market|business|industry|field|crowd|road)\b/i,
  /\bhard to (?:make (?:money|a profit|a living)|sell|compete|stand out|break (?:in|even)|succeed|earn|get customers)\b/i,
  /\bunlikely to (?:succeed|sell|work|make|earn|profit)\b/i,
  /\b(?:naive|naïve|stupid|foolish|silly|amateur(?:ish)?)\b/i,
  /\bdon[’']?t bother\b/i,
  /\bmistakes?\b/i,
  /\byou lack\b/i,
  /\black(?:s|ing)? (?:of )?(?:experience|skills?|knowledge)\b/i,
  /\bcan[’']?t afford\b/i,
  /\b(?:not|isn[’']t|aren[’']t|wasn[’']t) enough\b/i,
  /\bbudget is (?:too|tight|small|low|limited)\b/i,
  /\b(?:go(?:es)? out of business|(?:close|shut)s? (?:their|its) doors)\b/i,
  /\bmost (?:new |small |home |first-time )?(?:businesses|bakeries|shops|stores|sellers|bakers|owners|startups|ventures|makers|vendors) (?:close|fail|quit|stop|lose|struggle|don[’']t|never)\b/i,
];

// Made-up statistics about people or businesses
const STATISTIC = new RegExp(
  String.raw`\b(?:half|a third|a quarter|two thirds|three quarters|(?:the |a )?majority|most|many|nearly all|almost all) of (?:all |the |your )?(?:\w+ ){0,2}(?:shoppers|customers|buyers|people|businesses|owners|bakers|sellers|americans|consumers|vendors|families|parents|visitors)\b` +
    String.raw`|\b(?:\d+|${SMALL_NUMBER_WORDS}) (?:in|out of) (?:every )?(?:\d+|ten|five|four|three|two|a hundred|hundred)\b`,
  "i",
);

// Fees a platform or market charges are company facts, shown on the Website page, not government ones
const BUSINESS_FEES = /\b(?:card|processing|transaction|plan|monthly|yearly|annual|platform|subscription|hosting|domain|listing|booth|market|vendor|stall|delivery|shipping)\s+fees?\b/gi;

// Laws, rules and money owed to government: the model may only point to a checked page about them
const LEGAL: RegExp[] = [
  /\b(?:laws?|legal(?:ly)?|illegal|licen[cs](?:e|es|ed|ing)|permits?|regulat\w*|tax\w*|penalt(?:y|ies)|fined|fines|zoning|zoned|insurance|insured|liabilit(?:y|ies)|liable|compl(?:y|iance|iant)|inspect(?:ion|ions|ed|or|ors)|trademarks?|registrations?|paperwork|dba|assumed names?|ein|filing|health department|health code|cottage food|llc|sole proprietor(?:ship)?|corporations?|incorporat\w*)\b/i,
  /\brules?\b(?! of thumb)/i,
  /\bfees?\b/i,
  /\bregister(?:ed|ing)? (?:your|the|a|an|as|with|for|it)\b/i,
  /\bfile (?:your |a |an |the )?(?:taxes|tax|return|forms?|paperwork|with)\b|\bfiled with\b/i,
  /\b(?:form|register|file|start|set up|as)\s+(?:a\s+|an\s+)?(?:general\s+|limited\s+)?partnership\b|\b(?:general|limited) partnership\b/i,
  /\bcertificates? of\b|\b(?:assumed name|formation|occupancy|resale|sales tax|food handler['’]?s?) certificates?\b/i,
  /\bapprov(?:al|ed) (?:from|by) (?:the )?(?:city|county|state|health)\b/i,
  /\b(?:lets?|allows?|allowed)\b(?:\s+\w+){0,4}\s+(?:to\s+)?(?:sell|operate|run|bake|cook|work)\b/i,
];
const STRUCTURE_TOPIC = /\b(?:llc|sole proprietor(?:ship)?|partnership|corporations?|liabilit(?:y|ies)|liable)\b/i;

// Says whether a rule applies, what it allows or what it does; only SnapStart's checked pages may say that
const CLAIM_PARTS = [
  String.raw`\brequire[sd]?\b`,
  String.raw`\bmust\b`,
  String.raw`\bmandatory\b`,
  String.raw`\bexempt\w*`,
  String.raw`\b(?:have|has|had) to\b`,
  String.raw`\b(?:allowed|permitted|prohibited|banned|forbidden|illegal|only)\b`,
  String.raw`\b(?:lets?|allows?)\b`,
  String.raw`\b(?:can|could|may)\s?(?:not|n[’']t)? (?:sell|operate|run|open|cook|bake|work)\b`,
  String.raw`\bcan(?:not|[’']t)\b`,
  String.raw`\b(?:limits?|protects?|shields?|lowers?|reduces?|saves?|covers?|keeps?|safe|separates?)\b`,
  String.raw`\bowe[sd]?\b`,
  String.raw`\bdue\b`,
  String.raw`n[’']t\b|\b(?:not|no|none|never|without|free)\b|\w-free\b`,
  String.raw`\b(?:within|every|each|per|by|after|for|in) (?:\w+ )?(?:days?|weeks?|months?|years?)\b`,
  String.raw`\b(?:\d+|${SMALL_NUMBER_WORDS}) (?:days?|weeks?|months?|years?)\b`,
  String.raw`\b(?:law|state|county|city|irs) (?:says|requires|allows|lets)\b`,
  String.raw`\bobligat\w*`,
];
const NEED = String.raw`\bneed(?:s|ed)?\b`;
const CLAIM = new RegExp([...CLAIM_PARTS, NEED].join("|"), "i");
// Pointing at one of the owner's own plan steps: the plan, built by rules, already says it's needed
const CLAIM_ON_STEP = new RegExp(CLAIM_PARTS.join("|"), "i");

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const MONEY_OR_SHARE = /\$\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:%|percent\b|dollars?\b)/gi;
// "fifty dollars", "a few bucks": money written without digits
const MONEY_WORDS = new RegExp(
  String.raw`\b(?:a few|few|a couple(?: of)?|several|hundreds?|thousands?|${SMALL_NUMBER_WORDS})[\s-]+(?:\w+[\s-]+)?(?:dollars?|bucks|percent|per cent)\b`,
  "i",
);

const plain = (text: string) => String(Number(text.replace(/[^\d.]/g, "")));

function unknownNumbers(text: string, pattern: RegExp, known: ReadonlySet<string>): boolean {
  return [...text.matchAll(pattern)].some((match) => !known.has(plain(match[0])));
}

export function isDiscouraging(text: string): boolean {
  return DISCOURAGING.some((pattern) => pattern.test(text));
}

// On a point linked to the Website page, any fee is the platform's
export function isLegal(text: string, aboutWebsite = false): boolean {
  const stripped = text.replace(BUSINESS_FEES, " ");
  const withoutBusinessFees = aboutWebsite ? stripped.replace(/\bfees?\b/gi, " ") : stripped;
  return LEGAL.some((pattern) => pattern.test(withoutBusinessFees));
}

export function insightKey(section: InsightSection, title: string): string {
  return `${section}:${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`.slice(0, 160);
}

const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

export interface CheckContext {
  // Numbers the owner gave in their own answers; money and percentages must be one of these
  known: ReadonlySet<string>;
  // Counts and days SnapStart worked out itself, which may be repeated but never as money
  counts: ReadonlySet<string>;
  // Startup-plan steps by key, for "take me there"
  steps: ReadonlyMap<string, { id: string; title: string }>;
  // Keys the owner dismissed before
  dismissed: ReadonlySet<string>;
  // Null when unnamed, or when the name is the owner's own
  businessName: string | null;
}

export interface CheckedInsights {
  opening: string;
  items: Insight[];
  // Left out by these checks or the caps; dismissed repeats aren't counted
  removed: number;
}

// True when text breaks a rule that holds everywhere, opening included
function breaksRules(text: string, context: CheckContext, link: InsightLink | null): boolean {
  if (isDiscouraging(text) || STATISTIC.test(text) || MONEY_WORDS.test(text)) return true;
  if (unknownNumbers(text, MONEY_OR_SHARE, context.known)) return true;
  if (unknownNumbers(text, NUMBER, new Set([...context.known, ...context.counts]))) return true;
  const onStep = Boolean(link?.href.startsWith("/checklist/"));
  return isLegal(text, link?.href === "/website") && (onStep ? CLAIM_ON_STEP : CLAIM).test(text);
}

function linkFor(item: InsightReplyItem, context: CheckContext): InsightLink | null {
  const field = FIELD_ACTIONS.find(([pattern]) => pattern.test(`${item.title} ${item.action}`));
  if (field) return field[1];
  const step = item.stepKey ? context.steps.get(item.stepKey) : undefined;
  if (step) return { href: `/checklist/${step.id}`, label: step.title };
  return item.link ? PAGE_LINKS[item.link] : null;
}

const sourced = (link: InsightLink | null) => Boolean(link && SOURCED_HREFS.has(link.href.startsWith("/checklist/") ? "/checklist" : link.href));

// Null when the item breaks a rule
function checkItem(section: InsightSection, item: InsightReplyItem, context: CheckContext): Insight | null {
  const title = tidy(item.title);
  const detail = tidy(item.detail);
  const action = tidy(item.action);
  if (!title || !detail) return null;
  if (section === "watch" && action.length < MIN_ACTION) return null;

  const text = `${title} ${detail} ${action}`;
  let link = linkFor(item, context);
  if (breaksRules(text, context, link)) return null;
  if (isLegal(text, link?.href === "/website") && !sourced(link)) link = STRUCTURE_TOPIC.test(text) ? PAGE_LINKS.structure : PAGE_LINKS.requirements;
  return { key: insightKey(section, title), section, title, detail, action: action || null, link };
}

export function checkInsights(reply: InsightsReply, context: CheckContext): CheckedInsights {
  let removed = 0;
  const seen = new Set<string>();
  const kept = {} as Record<InsightSection, Insight[]>;
  for (const section of INSIGHT_SECTIONS) {
    kept[section] = [];
    for (const item of reply[section]) {
      const insight = checkItem(section, item, context);
      if (insight && context.dismissed.has(insight.key)) continue;
      if (!insight || seen.has(insight.key)) {
        removed++;
        continue;
      }
      seen.add(insight.key);
      kept[section].push(insight);
    }
  }

  // Never more to keep an eye on than there is to celebrate
  const caps = { ...INSIGHT_CAPS, watch: Math.min(INSIGHT_CAPS.watch, Math.min(kept.strengths.length, INSIGHT_CAPS.strengths)) };
  const items = INSIGHT_SECTIONS.flatMap((section) => {
    removed += Math.max(0, kept[section].length - caps[section]);
    return kept[section].slice(0, caps[section]);
  });

  const opening = tidy(reply.opening);
  const openingOk = opening && !breaksRules(opening, context, null);
  return { opening: openingOk ? opening : `Here’s what stands out about ${context.businessName ?? "your business"} so far.`, items, removed };
}
