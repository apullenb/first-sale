import type { BusinessProfile, RequirementDraft } from "@/lib/domain";

// Offline stand-in for the research model: fixed rules over the profile, quoting the pages it was given.
// Real research comes from the configured model.
export function mockResearch(profile: BusinessProfile, sources: ReadonlyMap<string, string>): RequirementDraft[] {
  const sells = (channel: BusinessProfile["channels"][number]) => profile.channels.includes(channel);
  const food = profile.offeringKinds.includes("food");
  const goods = profile.offeringKinds.some((kind) => kind !== "services");
  const hiring = profile.hiringPlans === "first_year" || profile.hiringPlans === "right_away";
  const list: RequirementDraft[] = [];

  const sourced = (
    ids: string[],
    pattern: RegExp,
    draft: Omit<RequirementDraft, "sourceIds" | "evidence" | "feeUsd" | "deadline"> & { feeUsd?: number },
  ) => {
    const cited = ids.filter((id) => sources.has(id));
    if (cited.length === 0) return;
    const evidence = cited.map((id) => sentenceMatching(sources.get(id)!, pattern)).find(Boolean) ?? null;
    list.push({ ...draft, sourceIds: cited, evidence, feeUsd: draft.feeUsd ?? null, deadline: null });
  };
  const gap = (draft: Omit<RequirementDraft, "sourceIds" | "evidence" | "feeUsd" | "deadline" | "needsProfessional">) =>
    list.push({ ...draft, sourceIds: [], evidence: null, feeUsd: null, deadline: null, needsProfessional: false });

  sourced(["irs-ein", "sba-tax-ids"], /\bfree\b/i, {
    title: "Employer Identification Number (EIN)",
    level: "federal",
    feeUsd: 0,
    needsProfessional: false,
    whyItApplies:
      hiring || profile.owners.count > 1
        ? "You plan to hire or have more than one owner, so you’ll need one."
        : "Banks often ask for one, and you’ll need it before you hire.",
    whoToCall: "the IRS",
    whatToAsk: ["Do I need an EIN if I’m the only owner and have no employees?"],
  });
  sourced(["sba-business-structure", "irs-business-structures"], /before you register/i, {
    title: "Choose a business structure",
    level: "federal",
    needsProfessional: profile.owners.count > 1,
    whyItApplies: "Your structure decides your taxes, your paperwork and whether your personal savings are protected.",
    whoToCall: "a small business counselor (SBA or SCORE)",
    whatToAsk: ["Which structure fits a business like mine?", "What does each one cost to set up and keep up?"],
  });
  sourced(["sba-licenses-permits"], /federal license or permit/i, {
    title: "Check whether anything you do needs a federal license",
    level: "federal",
    needsProfessional: false,
    whyItApplies: "A few activities are regulated by federal agencies. Most small makers and shops aren’t on the list.",
    whoToCall: "the federal agency that regulates your activity",
    whatToAsk: ["Does my product or activity need a federal license or permit?"],
  });
  if (hiring) {
    sourced(["sba-hire-employees"], /payroll/i, {
      title: "Set up payroll before your first hire",
      level: "federal",
      needsProfessional: true,
      whyItApplies: "You plan to hire, and employers withhold and pay taxes for each employee.",
      whoToCall: "an accountant or payroll service",
      whatToAsk: ["What do I need in place before my first employee starts?"],
    });
  }
  if (profile.name) {
    sourced(["sba-business-name"], /register/i, {
      title: "Register your business name",
      level: "state",
      needsProfessional: false,
      whyItApplies: `You plan to sell as “${profile.name}”. If that isn’t your own legal name, it usually has to be registered.`,
      whoToCall: "your state’s business filing office (often the Secretary of State) or your county clerk",
      whatToAsk: [
        `Do I need to register “${profile.name}” as a “doing business as” (DBA) name?`,
        "Is there a fee, and does it need renewing?",
      ],
    });
  }
  if (goods) {
    gap({
      title: "Sales tax permit",
      level: "state",
      whyItApplies: food
        ? "You sell goods directly to customers. Some states don’t tax certain foods, so ask what you charge tax on."
        : "You sell goods directly to customers, so you’ll likely collect sales tax and send it to the state.",
      whoToCall: "your state’s department of revenue",
      whatToAsk: ["Do I need a sales tax permit for what I sell?", "Which of my products are taxed, and at what rate?"],
    });
  }
  if (food) {
    gap({
      title: "Home food business (“cottage food”) rules",
      level: "county",
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
    title: "General business license",
    level: "city",
    whyItApplies:
      profile.premises === "home"
        ? "Many cities license home-based businesses too."
        : "Many cities license businesses that operate inside city limits.",
    whoToCall: "your city or county clerk’s office",
    whatToAsk: ["Do I need a general business license?", "What does it cost, and how often do I renew it?"],
  });
  if (profile.premises === "home") {
    gap({
      title: "Approval for a home business",
      level: "city",
      whyItApplies: "You’ll work from home, and zoning rules decide what a home business may do.",
      whoToCall: "your city’s planning or zoning office",
      whatToAsk: ["Is a home-based business allowed at my address?", "Can customers pick up orders at my home?"],
    });
  }
  if (sells("markets")) {
    gap({
      title: "Market or event vendor permit",
      level: "county",
      whyItApplies: "You sell at markets and events, which can need their own permit.",
      whoToCall: "the market organizer first, then your city or county",
      whatToAsk: food
        ? ["Do I need a temporary food permit to sell at this market?", "Does the market need proof of insurance?"]
        : ["Do I need a vendor or temporary sales permit?", "Does the market need proof of insurance?"],
    });
  }
  if (sells("storefront") || profile.premises === "rented_space") {
    gap({
      title: "Certificate of occupancy for your space",
      level: "city",
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
