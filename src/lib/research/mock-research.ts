import type { BusinessProfile, BusinessStructure, RequirementDraft } from "@/lib/domain";
import { STATE_NAMES } from "@/lib/intake/options";

// Offline stand-in for the research model: fixed rules over the profile, quoting the pages it was given.
// Real research comes from the configured model; results from this are labeled as practice.

type Fixed = "sourceIds" | "evidence" | "feeUsd" | "deadline";
type Base = Omit<RequirementDraft, Fixed | "gather" | "doneWhen" | "dependsOn" | "applicability" | "condition" | "timing" | "forStructures" | "renewal" | "renewalFeeUsd"> &
  Partial<Pick<RequirementDraft, "gather" | "doneWhen" | "dependsOn" | "applicability" | "condition" | "timing" | "forStructures" | "renewal" | "renewalFeeUsd">>;

const DEFAULTS = {
  gather: [],
  doneWhen: "",
  dependsOn: [],
  applicability: "applies",
  condition: "",
  timing: "before_selling",
  forStructures: [],
  renewal: null,
  renewalFeeUsd: null,
} satisfies Partial<RequirementDraft>;

const unknown = (answer: string | null) => answer === null || answer === "unsure";

export function mockResearch(
  profile: BusinessProfile,
  sources: ReadonlyMap<string, string>,
  structure: BusinessStructure | null = null,
): RequirementDraft[] {
  const sells = (channel: BusinessProfile["channels"][number]) => profile.channels.includes(channel);
  const food = profile.offeringKinds.includes("food");
  const goods = profile.offeringKinds.some((kind) => kind !== "services");
  const onlyFood = food && profile.offeringKinds.every((kind) => kind === "food" || kind === "services");
  const hiring = profile.hiringPlans === "first_year" || profile.hiringPlans === "right_away" || profile.helpKinds.includes("employees");
  // Not answered, or "not sure": a maybe, never a no
  const maybeHiring = !hiring && (profile.hiringPlans === null || profile.helpKinds.includes("unsure"));
  const atHome = profile.premises === "home" || profile.handoff.includes("pickup_home");
  const list: RequirementDraft[] = [];

  // Quotes the first sentence on a cited page that matches, plus the next one when `also` matches it
  const sourced = (ids: string[], pattern: RegExp, draft: Base & { feeUsd?: number; deadline?: string }, also?: RegExp) => {
    const cited = ids.filter((id) => sources.has(id));
    if (cited.length === 0) return false;
    const evidence = cited.map((id) => sentenceMatching(sources.get(id)!, pattern, also)).find(Boolean) ?? null;
    list.push({ ...DEFAULTS, ...draft, sourceIds: cited, evidence, feeUsd: draft.feeUsd ?? null, deadline: draft.deadline ?? null });
    return true;
  };
  const gap = (draft: Omit<Base, "needsProfessional"> & { needsProfessional?: boolean }) =>
    list.push({ ...DEFAULTS, needsProfessional: false, ...draft, sourceIds: [], evidence: null, feeUsd: null, deadline: null });
  const texas = (id: string) => profile.location.state === "TX" && sources.has(id);
  const baked = profile.category === "baked_goods" || /bak|bread|cake|cookie|pie/i.test(`${profile.firstItems} ${profile.productTags.join(" ")}`);

  sourced(["sba-business-structure", "irs-business-structures"], /before you register/i, {
    key: "structure",
    title: "Choose a business structure",
    topic: "structure",
    level: "federal",
    agency: "Your choice; the SBA explains the options",
    needsProfessional: profile.owners.count > 1,
    whyItApplies:
      profile.owners.count > 1
        ? `With ${profile.owners.count} owners, your structure decides who’s responsible for what, how you’re taxed, and what you file.`
        : "Your structure decides your taxes, your paperwork and whether your personal savings are protected.",
    whoToCall: "a small business counselor (SBA or SCORE)",
    whatToAsk: ["Which structure fits a business like mine?", "What does each one cost to set up and keep up?"],
    gather: ["How many owners there are", "How much risk your business could carry"],
    doneWhen: "You’ve picked a structure and noted it in SnapStart.",
  });

  if (texas("tx-sos-205")) {
    sourced(["tx-sos-205"], /^Filing Fee:/, {
      key: "llc-formation",
      title: "File a certificate of formation to form your LLC",
      topic: "structure",
      level: "state",
      agency: "Texas Secretary of State",
      feeUsd: 300,
      forStructures: ["llc"],
      needsProfessional: false,
      whyItApplies: "A Texas LLC exists once the Secretary of State files its certificate of formation (Form 205).",
      whoToCall: "the Texas Secretary of State’s business filings office",
      whatToAsk: ["Can I be my own registered agent?", "How long does filing take?"],
      gather: [
        "Your LLC’s name, including “limited liability company”, “limited company” or an abbreviation like LLC",
        "A registered agent in Texas who has agreed to serve",
        "The name and address of each member or manager",
      ],
      doneWhen: "The Secretary of State has filed your certificate of formation.",
      dependsOn: ["structure"],
    });
  }

  // Other states: a practice step with no page behind it, so no fee, form name or timing
  const company = structure === "llc" || structure === "corporation" ? structure : null;
  const formationKey = company === "corporation" ? "corporation-formation" : "llc-formation";
  if (company && !texas("tx-sos-205")) {
    const stateName = STATE_NAMES[profile.location.state];
    const kind = company === "llc" ? "LLC" : "corporation";
    gap({
      key: formationKey,
      title: `Form your ${kind} with the state of ${stateName}`,
      topic: "structure",
      level: "state",
      agency: `${stateName}’s business filing office`,
      forStructures: [company],
      whyItApplies: `Practice step: you chose ${company === "llc" ? "an LLC" : "a corporation"}, and ${kind === "LLC" ? "an LLC" : "a corporation"} is usually formed by filing with the state. Practice mode doesn’t read ${stateName}’s pages, so the form, fee and timing are unknown until real research runs.`,
      whoToCall: `${stateName}’s business filing office (often the Secretary of State)`,
      whatToAsk: [`Which form creates ${kind === "LLC" ? "an LLC" : "a corporation"} in ${stateName}?`, "What’s the fee, and how long does filing take?"],
      gather: [`Your ${kind}’s name`, "A registered agent in the state", "Each owner’s name and address"],
      doneWhen: `${stateName} has filed the paperwork that forms your ${kind}.`,
      dependsOn: ["structure"],
    });
  }

  // A Texas LLC's other filings name the LLC, so they wait for its certificate of formation
  const formedFirst = structure === "llc" ? ["llc-formation"] : ["structure"];
  const sellsAs = profile.name && profile.nameIsLegalName !== "yes" ? profile.name : null;
  const nameCondition = unknown(profile.nameIsLegalName)
    ? `Only if “${sellsAs}” isn’t your own legal name (or your company’s registered name). You haven’t told us yet.`
    : "";
  const nameRule = { topic: "name_registration", applicability: nameCondition ? "conditional" : "applies", condition: nameCondition, needsProfessional: false, dependsOn: ["structure"] } satisfies Partial<Base>;
  if (sellsAs && texas("tx-sos-503")) {
    const county = {
      ...nameRule,
      key: "assumed-name-county",
      level: "county",
      forStructures: ["sole_proprietorship", "partnership"],
      gather: [`The name “${sellsAs}”`, "Your business address", "Each owner’s name and address", "ID for every owner if you file in person, or the form signed before a notary if you mail it"],
      doneWhen: "The county clerk has recorded your assumed name certificate.",
    } satisfies Partial<Base>;
    if (texas("tx-travis-dba")) {
      sourced(["tx-travis-dba"], /^Filing fee is/, {
        ...county,
        title: "File an assumed name certificate with the Travis County Clerk",
        agency: "Travis County Clerk",
        feeUsd: 23,
        whyItApplies: `You plan to sell as “${sellsAs}”. Travis County records assumed names for businesses that aren’t incorporated: $23 for the name and one owner, plus 50 cents for each other owner.`,
        whoToCall: "the Travis County Clerk’s Recording Division",
        whatToAsk: [`Is “${sellsAs}” free to use in Travis County?`],
      });
    } else {
      gap({
        ...county,
        title: "File an assumed name certificate with your county clerk",
        agency: "Your county clerk",
        whyItApplies: `You plan to sell as “${sellsAs}”. A Texas business that isn’t incorporated usually records its assumed name with the county clerk. SnapStart couldn’t read your county’s pages to confirm.`,
        whoToCall: "your county clerk",
        whatToAsk: [`Do I need to file an assumed name certificate for “${sellsAs}”?`, "What’s the fee, and how long does it last?"],
      });
    }
    sourced(["tx-sos-503"], /^Filing Fee:/, {
      ...nameRule,
      key: "assumed-name-state",
      title: "File an assumed name certificate with the Texas Secretary of State",
      level: "state",
      agency: "Texas Secretary of State",
      feeUsd: 25,
      forStructures: ["llc", "corporation"],
      whyItApplies: `You plan to sell as “${sellsAs}”. An LLC or corporation using a name other than its registered one files Form 503 with the Secretary of State, not the county.`,
      whoToCall: "the Texas Secretary of State’s business filings office",
      whatToAsk: [`Does selling as “${sellsAs}” without “LLC” need an assumed name certificate?`],
      gather: [`The name “${sellsAs}”`, "Your company’s registered name and file number", "Your principal office address"],
      doneWhen: "The Secretary of State has filed your assumed name certificate.",
      dependsOn: formedFirst,
    });
  } else if (sellsAs) {
    sourced(["sba-business-name"], /register/i, {
      key: "business-name",
      title: "Register your business name",
      topic: "name_registration",
      level: "state",
      agency: "Your state’s business filing office",
      needsProfessional: false,
      whyItApplies: `You plan to sell as “${sellsAs}”. If that isn’t your own legal name, it usually has to be registered.`,
      whoToCall: "your state’s business filing office (often the Secretary of State) or your county clerk",
      whatToAsk: [`Do I need to register “${sellsAs}” as a “doing business as” (DBA) name?`, "Is there a fee, and does it need renewing?"],
      gather: [`The name “${sellsAs}”`, "Your own legal name and address"],
      doneWhen: "The office confirms your name is registered.",
      dependsOn: ["structure"],
    });
  }

  const needsEin = hiring || profile.owners.count > 1 || structure === "partnership" || structure === "llc" || structure === "corporation";
  sourced(["irs-ein", "sba-tax-ids"], /\bfree\b/i, {
    key: "ein",
    title: "Employer Identification Number (EIN)",
    topic: "tax_registration",
    level: "federal",
    agency: "Internal Revenue Service (IRS)",
    feeUsd: 0,
    applicability: needsEin ? "applies" : "optional",
    needsProfessional: false,
    whyItApplies: needsEin
      ? profile.owners.count > 1
        ? "With more than one owner, your business is a partnership or company, and those need an EIN."
        : "You plan to hire or to form a company, so you’ll need one."
      : "A sole proprietor without employees can use their Social Security number, but banks often ask for an EIN, and it keeps your SSN off forms.",
    whoToCall: "the IRS",
    whatToAsk: ["Do I need an EIN if I’m the only owner and have no employees?"],
    gather: ["Your business structure", "Your business’s legal name and address"],
    doneWhen: "You have your EIN from the IRS, saved somewhere safe.",
    dependsOn: ["structure"],
  });

  if (goods && texas("tx-cpa-permit-faq")) {
    sourced(["tx-cpa-permit-faq", "tx-cpa-permit", ...(onlyFood && baked ? ["tx-cpa-bakery"] : [])], /no fee for the permit/i, {
      key: "sales-tax-permit",
      title: "Get a Texas sales and use tax permit",
      topic: "tax_registration",
      level: "state",
      agency: "Texas Comptroller of Public Accounts",
      feeUsd: 0,
      applicability: onlyFood ? "conditional" : "applies",
      condition: onlyFood ? "Only if you sell anything Texas taxes. Not all food is taxed, so ask the Comptroller about what you sell." : "",
      needsProfessional: false,
      whyItApplies: onlyFood
        ? baked
          ? "Texas requires this permit to make taxable sales. Bakery items aren’t always taxed: a business that isn’t a bakery storefront owes tax on them when it sells them heated or with plates or utensils."
          : "Texas requires this permit to make taxable sales. Not all food is taxed, so check what you sell."
        : "You’ll sell goods in Texas, and Texas requires this permit to sell tangible personal property. It’s free, though you may have to post a security bond.",
      whoToCall: "the Texas Comptroller of Public Accounts",
      whatToAsk: onlyFood
        ? ["Are the foods I sell taxable?", "Do I need a permit if none of my sales are taxed?"]
        : ["Will I need to post a security bond?", "Which local sales tax rate do I charge?"],
      gather: ["Your legal name and the name you sell under", "Where you’ll make sales", "What you’ll sell and when you’ll start", "Your SSN or EIN"],
      doneWhen: "You have your sales and use tax permit.",
      dependsOn: formedFirst,
    });
  } else if (goods) {
    gap({
      key: "sales-tax",
      title: "Sales tax permit",
      topic: "tax_registration",
      level: "state",
      agency: "Your state’s department of revenue",
      whyItApplies: food
        ? "You sell goods directly to customers. Some states don’t tax certain foods, so ask what you charge tax on."
        : "You sell goods directly to customers, so you’ll likely collect sales tax and send it to the state.",
      whoToCall: "your state’s department of revenue",
      whatToAsk: ["Do I need a sales tax permit for what I sell?", "Which of my products are taxed, and at what rate?"],
      dependsOn: ["ein"],
    });
  }

  if (food && atHome && texas("tx-dshs-cottage")) {
    const cold = profile.foodNeedsCold;
    const cottage = { topic: "license_permit", level: "state", agency: "Texas Department of State Health Services (DSHS)", needsProfessional: false, whoToCall: "the Texas DSHS cottage food program" } satisfies Partial<Base>;
    sourced(["tx-dshs-cottage"], /exempt from the requirements of a food service establishment/i, {
      ...cottage,
      key: "cottage-food",
      title: "Check that your foods fit Texas cottage food rules",
      whyItApplies: "You make food at home to sell. In Texas that’s a cottage food operation: no health department permit, inspection or fee, but limits on what you sell and how you label it.",
      whatToAsk: ["Are all the foods I plan to sell allowed as cottage foods?", "Does my yearly income stay under the cottage food limit?"],
      gather: ["A list of the foods you’ll sell"],
      doneWhen: "You’ve checked that everything you sell is allowed as a cottage food.",
    });
    sourced(["tx-dshs-cottage"], /THIS PRODUCT WAS PRODUCED IN A PRIVATE RESIDENCE/, {
      ...cottage,
      key: "cottage-labels",
      title: "Label your cottage foods the way Texas requires",
      whyItApplies: "Each Texas cottage food label must carry this statement, along with your address or a DSHS registration number.",
      whatToAsk: ["What else must my labels show?", "What must I post online before I take payment?"],
      gather: ["Your label design", "A list of the allergens in each food"],
      doneWhen: "Your labels show everything Texas requires.",
      dependsOn: ["cottage-food"],
    });
    sourced(["tx-dshs-cottage"], /must successfully complete a basic food safety education or training program/i, {
      ...cottage,
      key: "food-handler",
      title: "Complete an accredited food handler course",
      agency: "A food handler program accredited in Texas",
      whyItApplies: "Texas requires anyone running a cottage food operation to complete an accredited food handler course.",
      whatToAsk: ["Which food handler courses are accredited?"],
      doneWhen: "You have your food handler certificate.",
    });
    sourced(["tx-dshs-cottage"], cold === "no" ? /^Registration will allow CFPOs/ : /that sell time and temperature control for safety \(TCS\) foods must register/i, {
      ...cottage,
      key: "cottage-registration",
      title: "Register your cottage food operation with DSHS",
      applicability: cold === "yes" ? "applies" : cold === "no" ? "optional" : "conditional",
      condition: unknown(cold) ? "Only if any food you sell needs time and temperature control for safety (TCS), like refrigeration. You haven’t told us yet." : "",
      whyItApplies:
        cold === "no"
          ? "Your foods don’t need refrigeration, so registering is your choice. It lets you print a DSHS number on labels instead of your home address."
          : "Texas requires cottage food operations that sell foods needing time and temperature control (TCS), like refrigeration, to register with DSHS.",
      whatToAsk: ["Do any of my foods count as TCS foods?", "Is there a fee to register?"],
      doneWhen: "DSHS lists your cottage food operation in its registry.",
    });
  } else if (food) {
    gap({
      key: "cottage-food",
      title: "Home food business (“cottage food”) rules",
      topic: "license_permit",
      level: "county",
      agency: "Your county health department",
      whyItApplies: "You make food to sell. Many states allow some foods made at home, with limits on what and where.",
      whoToCall: "your county health department",
      whatToAsk: ["Can I sell what I make from my home kitchen?", "Do I need a permit, registration or food-safety training first?", "What do my labels need to say?"],
    });
  }

  if (texas("tx-cpa-franchise")) {
    sourced(["tx-cpa-franchise"], /annual franchise tax report is due/i, {
      key: "franchise-tax",
      title: "File a Texas franchise tax report each year",
      topic: "tax_registration",
      level: "state",
      agency: "Texas Comptroller of Public Accounts",
      deadline: "due May 15",
      timing: "later",
      forStructures: ["llc", "corporation"],
      needsProfessional: false,
      whyItApplies: "Texas’s franchise tax applies to each taxable entity formed or doing business in Texas, with a report every year. A business at or below the no-tax-due threshold still files one.",
      whoToCall: "the Texas Comptroller of Public Accounts",
      whatToAsk: ["Is my business a taxable entity?", "When is my first report due, and which report do I file if I owe no tax?"],
      doneWhen: "You’ve filed your first franchise tax report.",
      dependsOn: ["structure", "llc-formation"],
    });
  }

  sourced(["sba-licenses-permits"], /federal license or permit/i, {
    key: "federal-license",
    title: "Check whether anything you do needs a federal license",
    topic: "license_permit",
    level: "federal",
    agency: "The federal agency for your activity",
    needsProfessional: false,
    whyItApplies: "A few activities are regulated by federal agencies. Most small makers and shops aren’t on the list.",
    whoToCall: "the federal agency that regulates your activity",
    whatToAsk: ["Does my product or activity need a federal license or permit?"],
    doneWhen: "You’ve checked the list and know whether you need one.",
  });
  if (hiring || maybeHiring) {
    sourced(["sba-hire-employees"], /payroll/i, {
      applicability: hiring ? "applies" : "conditional",
      condition: hiring ? "" : "Only if you hire employees. You haven’t told us yet.",
      key: "payroll",
      title: "Set up payroll before your first hire",
      topic: "employer",
      level: "federal",
      agency: "Internal Revenue Service (IRS) and your state",
      timing: "later",
      needsProfessional: true,
      whyItApplies: "You plan to hire, and employers withhold and pay taxes for each employee.",
      whoToCall: "an accountant or payroll service",
      whatToAsk: ["What do I need in place before my first employee starts?"],
      doneWhen: "Payroll is set up before your first employee’s first day.",
      dependsOn: ["ein"],
    });
  }

  if (profile.makesForKids === "yes" || profile.makesForKids === "unsure") {
    gap({
      key: "childrens-products",
      title: "Safety rules for children’s products",
      topic: "other",
      level: "federal",
      agency: "U.S. Consumer Product Safety Commission",
      applicability: "outside_coverage",
      whyItApplies: `${profile.makesForKids === "yes" ? "You make things for children." : "You weren’t sure whether you make things for children."} Federal safety rules for children’s products can require testing and labels. SnapStart doesn’t research product safety rules.`,
      whoToCall: "the U.S. Consumer Product Safety Commission",
      whatToAsk: ["Which children’s product rules apply to what I make?", "Do small makers need third-party testing?"],
    });
  }
  if (profile.foodContact === "yes" || profile.foodContact === "unsure") {
    gap({
      key: "food-contact",
      title: "Rules for items that touch food",
      topic: "other",
      level: "federal",
      agency: "U.S. Food and Drug Administration",
      applicability: "outside_coverage",
      whyItApplies: `${profile.foodContact === "yes" ? "Some of what you make will touch food, like cutting boards or bowls." : "You weren’t sure whether what you make will touch food."} Finishes and materials for food-contact items have federal rules SnapStart doesn’t research.`,
      whoToCall: "the U.S. Food and Drug Administration",
      whatToAsk: ["Which finishes are allowed on items that touch food?"],
    });
  }
  if (profile.handoff.includes("ship_out_of_state")) {
    gap({
      key: "other-states-tax",
      title: "Sales tax in other states you ship to",
      topic: "tax_registration",
      level: "state",
      agency: "Each state you ship to",
      applicability: "outside_coverage",
      timing: "later",
      whyItApplies: "You plan to ship to other states. Some states require sellers to collect their sales tax once sales there pass a limit. SnapStart only researches your own state.",
      whoToCall: "each state’s department of revenue",
      whatToAsk: ["At what level of sales must an out-of-state seller collect your sales tax?"],
    });
  }

  const austinHome = atHome && texas("tx-austin-home");
  gap({
    key: "business-license",
    title: "General business license",
    topic: "license_permit",
    level: "city",
    agency: "Your city or county clerk",
    whyItApplies: austinHome
      ? "Austin says it can’t require permits for most home businesses, but SnapStart couldn’t confirm whether another city or county license applies to what you do."
      : atHome
        ? "Many cities license home-based businesses too."
        : "Many cities license businesses that operate inside city limits.",
    whoToCall: "your city or county clerk’s office",
    whatToAsk: ["Do I need a general business license?", "What does it cost, and how often do I renew it?"],
  });
  if (austinHome) {
    sourced(["tx-austin-home"], /City of Austin cannot prohibit or require permits for home-based businesses/i, {
      key: "home-business",
      title: "Keep your home business within Austin’s limits",
      topic: "location_zoning",
      level: "city",
      agency: "City of Austin Development Services",
      needsProfessional: false,
      whyItApplies: profile.handoff.includes("pickup_home")
        ? "Customers will pick up at your home. Austin can’t require a permit for a home business that stays within these limits, so keep pickups from causing much traffic."
        : "You’ll work from home. Austin can’t require a permit for a home business that stays within these limits.",
      whoToCall: "City of Austin Development Services",
      whatToAsk: ["Does my home business stay within the city’s limits?", "Can customers pick up orders at my home?"],
      gather: ["Your homeowners’ association rules, if you have one"],
      doneWhen: "You’ve checked that your business stays within these limits, and within any HOA rules.",
    }, /do not need to rezone/i);
  } else if (atHome) {
    gap({
      key: "home-business",
      title: "Approval for a home business",
      topic: "location_zoning",
      level: "city",
      agency: "Your city’s planning or zoning office",
      whyItApplies: profile.handoff.includes("pickup_home")
        ? "Customers will pick up at your home, and zoning rules decide what a home business may do, including customer visits."
        : "You’ll work from home, and zoning rules decide what a home business may do.",
      whoToCall: "your city’s planning or zoning office",
      whatToAsk: ["Is a home-based business allowed at my address?", "Can customers pick up orders at my home?"],
    });
  }
  if (sells("markets")) {
    gap({
      key: "vendor-permit",
      title: "Market or event vendor permit",
      topic: "license_permit",
      level: "county",
      agency: "The market organizer, then your city or county",
      whyItApplies: "You sell at markets and events, which can need their own permit.",
      whoToCall: "the market organizer first, then your city or county",
      whatToAsk: food
        ? ["Do I need a temporary food permit to sell at this market?", "Does the market need proof of insurance?"]
        : ["Do I need a vendor or temporary sales permit?", "Does the market need proof of insurance?"],
    });
  }
  if (sells("storefront") || profile.premises === "rented_space") {
    gap({
      key: "occupancy",
      title: "Certificate of occupancy for your space",
      topic: "location_zoning",
      level: "city",
      agency: "Your city’s building department",
      whyItApplies: "You’ll work from a rented space, which has to be approved for your kind of business.",
      whoToCall: "your city’s building department",
      whatToAsk: ["Does this space already have a certificate of occupancy for my use?", "Do I need an inspection before I open?"],
    });
  }
  return list;
}

// A sentence (or a whole short line, as statutes put each clause on one) that matches, and the next one when it matches `also`.
// A line too short to quote alone, like a form's fee, comes with the line before it.
function sentenceMatching(text: string, pattern: RegExp, also?: RegExp): string | null {
  const units = text
    .split("\n")
    .flatMap((line) => (line.length <= 600 ? [line] : line.split(/(?<=[.!?])\s+/)))
    .map((unit) => unit.trim())
    .filter(Boolean);
  const at = units.findIndex((unit) => pattern.test(unit) && unit.length >= 20 && unit.length <= 600);
  if (at === -1) {
    const short = units.findIndex((unit) => pattern.test(unit) && /\$\d/.test(unit));
    return short > 0 && units[short - 1].length + units[short].length >= 20 ? `${units[short - 1]} ${units[short]}` : null;
  }
  const next = units[at + 1];
  return also && next && also.test(next) && units[at].length + next.length < 600 ? `${units[at]} ${next}` : units[at];
}
