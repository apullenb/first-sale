import type { BusinessProfile, RequirementDraft } from "@/lib/domain";

// Offline stand-in for the research model: fixed rules over the profile, quoting the pages it was given.
// Real research comes from the configured model; results from this are labeled as practice.

type Fixed = "sourceIds" | "evidence" | "feeUsd" | "deadline";
type Base = Omit<RequirementDraft, Fixed | "gather" | "doneWhen" | "dependsOn"> &
  Partial<Pick<RequirementDraft, "gather" | "doneWhen" | "dependsOn">>;

export function mockResearch(profile: BusinessProfile, sources: ReadonlyMap<string, string>): RequirementDraft[] {
  const sells = (channel: BusinessProfile["channels"][number]) => profile.channels.includes(channel);
  const food = profile.offeringKinds.includes("food");
  const goods = profile.offeringKinds.some((kind) => kind !== "services");
  const hiring = profile.hiringPlans === "first_year" || profile.hiringPlans === "right_away";
  const list: RequirementDraft[] = [];
  const fill = (draft: Base) => ({ gather: [], doneWhen: "", dependsOn: [], ...draft });

  const sourced = (ids: string[], pattern: RegExp, draft: Base & { feeUsd?: number }) => {
    const cited = ids.filter((id) => sources.has(id));
    if (cited.length === 0) return;
    const evidence = cited.map((id) => sentenceMatching(sources.get(id)!, pattern)).find(Boolean) ?? null;
    list.push({ ...fill(draft), sourceIds: cited, evidence, feeUsd: draft.feeUsd ?? null, deadline: null });
  };
  const gap = (draft: Omit<Base, "needsProfessional">) =>
    list.push({ ...fill({ ...draft, needsProfessional: false }), sourceIds: [], evidence: null, feeUsd: null, deadline: null });

  sourced(["sba-business-structure", "irs-business-structures"], /before you register/i, {
    key: "structure",
    title: "Choose a business structure",
    topic: "structure",
    level: "federal",
    agency: "Your choice; the SBA explains the options",
    needsProfessional: profile.owners.count > 1,
    whyItApplies: "Your structure decides your taxes, your paperwork and whether your personal savings are protected.",
    whoToCall: "a small business counselor (SBA or SCORE)",
    whatToAsk: ["Which structure fits a business like mine?", "What does each one cost to set up and keep up?"],
    gather: ["How many owners there are", "How much risk your business could carry"],
    doneWhen: "You’ve picked a structure and noted it in First Sale.",
  });
  if (profile.name) {
    sourced(["sba-business-name"], /register/i, {
      key: "business-name",
      title: "Register your business name",
      topic: "name_registration",
      level: "state",
      agency: "Your state’s business filing office",
      needsProfessional: false,
      whyItApplies: `You plan to sell as “${profile.name}”. If that isn’t your own legal name, it usually has to be registered.`,
      whoToCall: "your state’s business filing office (often the Secretary of State) or your county clerk",
      whatToAsk: [
        `Do I need to register “${profile.name}” as a “doing business as” (DBA) name?`,
        "Is there a fee, and does it need renewing?",
      ],
      gather: [`The name “${profile.name}”`, "Your own legal name and address"],
      doneWhen: "The office confirms your name is registered.",
      dependsOn: ["structure"],
    });
  }
  sourced(["irs-ein", "sba-tax-ids"], /\bfree\b/i, {
    key: "ein",
    title: "Employer Identification Number (EIN)",
    topic: "tax_registration",
    level: "federal",
    agency: "Internal Revenue Service (IRS)",
    feeUsd: 0,
    needsProfessional: false,
    whyItApplies:
      hiring || profile.owners.count > 1
        ? "You plan to hire or have more than one owner, so you’ll need one."
        : "Banks often ask for one, and you’ll need it before you hire.",
    whoToCall: "the IRS",
    whatToAsk: ["Do I need an EIN if I’m the only owner and have no employees?"],
    gather: ["Your business structure", "Your business’s legal name and address"],
    doneWhen: "You have your EIN from the IRS, saved somewhere safe.",
    dependsOn: ["structure"],
  });
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
  if (hiring) {
    sourced(["sba-hire-employees"], /payroll/i, {
      key: "payroll",
      title: "Set up payroll before your first hire",
      topic: "employer",
      level: "federal",
      agency: "Internal Revenue Service (IRS) and your state",
      needsProfessional: true,
      whyItApplies: "You plan to hire, and employers withhold and pay taxes for each employee.",
      whoToCall: "an accountant or payroll service",
      whatToAsk: ["What do I need in place before my first employee starts?"],
      doneWhen: "Payroll is set up before your first employee’s first day.",
      dependsOn: ["ein"],
    });
  }
  if (goods) {
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
  if (food) {
    gap({
      key: "cottage-food",
      title: "Home food business (“cottage food”) rules",
      topic: "license_permit",
      level: "county",
      agency: "Your county health department",
      whyItApplies: "You make food to sell. Many states allow some foods made at home, with limits on what and where.",
      whoToCall: "your county health department",
      whatToAsk: [
        "Can I sell what I make from my home kitchen?",
        "Do I need a permit, registration or food-safety training first?",
        "What do my labels need to say?",
      ],
    });
  }
  gap({
    key: "business-license",
    title: "General business license",
    topic: "license_permit",
    level: "city",
    agency: "Your city or county clerk",
    whyItApplies:
      profile.premises === "home"
        ? "Many cities license home-based businesses too."
        : "Many cities license businesses that operate inside city limits.",
    whoToCall: "your city or county clerk’s office",
    whatToAsk: ["Do I need a general business license?", "What does it cost, and how often do I renew it?"],
  });
  if (profile.premises === "home") {
    gap({
      key: "home-business",
      title: "Approval for a home business",
      topic: "location_zoning",
      level: "city",
      agency: "Your city’s planning or zoning office",
      whyItApplies: "You’ll work from home, and zoning rules decide what a home business may do.",
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

function sentenceMatching(text: string, pattern: RegExp): string | null {
  const sentences = text.split(/\n|(?<=[.!?])\s+/);
  return sentences.find((sentence) => pattern.test(sentence) && sentence.length >= 20)?.trim() ?? null;
}
