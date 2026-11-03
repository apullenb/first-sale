import { z } from "zod";
import { displayDetail, looksLikeIdNumber } from "@/lib/details";
import type { BusinessProfile, BusinessStructure, PlanTopic } from "@/lib/domain";
import type { Fact } from "./companion";
import type { CheckedFact } from "./form-catalog";
import { unprintable } from "./pdf-text";
import type { PdfSpec } from "./pdf-writer";
import type { PlanSection } from "./types";

// The owners' agreement for an LLC (Texas calls it a company agreement) or a partnership.
// Fixed wording filled from the owner's answers, never model output. Not filed: every owner signs and keeps it.

export type AgreementStructure = "llc" | "partnership";
export const DECISION_RULES = ["majority", "everyone"] as const;
export type DecisionRule = (typeof DECISION_RULES)[number];
export const DECISION_LABELS: Record<DecisionRule, string> = {
  majority: "Owners who together own more than half decide",
  everyone: "Every owner must agree",
};

export const MAX_CONTRIBUTION = 200;
export const MAX_MANAGER = 120;

const CHECKED = "2026-10-28";
const SBA_BANK = { sourceTitle: "SBA: Open a business bank account", sourceUrl: "https://www.sba.gov/business-guide/launch-your-business/open-business-bank-account" };
// The statutes site only shows text in a browser, so these were read by hand
const TX_LLC_LAW = { sourceUrl: "https://statutes.capitol.texas.gov/Docs/BO/htm/BO.101.htm", byHand: true as const };
const TX_PARTNERSHIP_LAW = { sourceUrl: "https://statutes.capitol.texas.gov/Docs/BO/htm/BO.152.htm", byHand: true as const };

// Why to have one, in the official words, shown on the agreement page
export function agreementReasons(structure: AgreementStructure, texas: boolean): CheckedFact[] {
  const reasons: CheckedFact[] = [
    {
      ...SBA_BANK,
      text: "Banks commonly ask for your ownership agreement when you open a business bank account.",
      quote: "Ownership agreements",
      checkedOn: CHECKED,
    },
  ];
  if (structure === "llc") {
    reasons.push({
      ...SBA_BANK,
      text: "The SBA recommends one even where the state doesn’t require it.",
      quote: "It’s widely recommended to create one to protect yourself and your business, even if your state doesn’t mandate it.",
      checkedOn: CHECKED,
    });
  }
  if (!texas) return reasons;
  if (structure === "llc") {
    reasons.push(
      {
        ...TX_LLC_LAW,
        sourceTitle: "Texas Business Organizations Code, Sec. 101.201",
        text: "Without one, Texas splits an LLC’s profits and losses by the agreed value of what each member put in.",
        quote: "The profits and losses of a limited liability company shall be allocated to each member of the company on the basis of the agreed value of the contributions made by each member",
        checkedOn: CHECKED,
      },
      {
        ...TX_LLC_LAW,
        sourceTitle: "Texas Business Organizations Code, Sec. 101.501",
        text: "Texas law has the LLC keep its written agreement with its records at its principal office.",
        quote: "if the company agreement is in writing, a copy of the company agreement, including any amendments to or restatements of the company agreement",
        checkedOn: CHECKED,
      },
    );
  } else {
    reasons.push({
      ...TX_PARTNERSHIP_LAW,
      sourceTitle: "Texas Business Organizations Code, Sec. 152.202",
      text: "Without one, Texas splits a partnership’s profits equally, whatever each partner put in.",
      quote: "Each partner is entitled to be credited with an equal share of the partnership's profits",
      checkedOn: CHECKED,
    });
  }
  return reasons;
}

export interface AgreementBasis {
  structure: AgreementStructure;
  name: string;
  stateName: string;
  texas: boolean;
  owners: string[];
  // LLCs only
  managed: "members" | "manager" | null;
  purpose: string | null;
  address: string | null;
}

export type AgreementReadiness =
  | { kind: "ready"; basis: AgreementBasis; used: Record<string, string> }
  | { kind: "missing"; structure: AgreementStructure; missing: string[] }
  | { kind: "none"; why: string };

export function agreementStructure(structure: BusinessStructure | null): AgreementStructure | null {
  return structure === "llc" || structure === "partnership" ? structure : null;
}

export function agreementName(structure: AgreementStructure, texas: boolean): string {
  if (structure === "partnership") return "Partnership agreement";
  return texas ? "Company agreement" : "Operating agreement";
}

export function ownerNames(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

// What the agreement needs from saved answers and details, and the facts it rests on
export function agreementReadiness(profile: BusinessProfile, facts: ReadonlyMap<string, Fact>, structure: BusinessStructure | null): AgreementReadiness {
  if (!structure) return { kind: "none", why: "Record your business structure first. The agreement depends on it." };
  if (structure === "sole_proprietorship") return { kind: "none", why: "A sole proprietorship has one owner, so there’s no owners’ agreement to sign." };
  if (structure === "corporation") return { kind: "none", why: "A corporation adopts bylaws instead. SnapStart doesn’t prepare bylaws yet." };

  const value = (id: string) => facts.get(id)?.value ?? null;
  const owners = ownerNames(value("detail.owner_names") ?? undefined);
  const count = profile.owners.count;
  const missing: string[] = [];
  if (!value("profile.name")) missing.push("Your business name, in your answers about the business.");
  if (structure === "partnership" && count < 2) missing.push(`A partnership has at least two owners. Your answers say ${count}.`);
  if (!owners.length) missing.push("Owners’ full legal names, in your business details.");
  else if (owners.length !== count) missing.push(`Owners’ names: your business details list ${owners.length}, but your answers say ${count} ${count === 1 ? "owner" : "owners"}.`);
  else if (new Set(owners.map((name) => name.toLowerCase())).size !== owners.length) missing.push("Owners’ names: list each owner once, in your business details.");
  const management = value("detail.management");
  if (structure === "llc" && !management) missing.push("Who runs the LLC, in your business details.");
  if (missing.length) return { kind: "missing", structure, missing };

  const ids = ["profile.name", "profile.state", "profile.owner_count", "derived.structure", "detail.owner_names", "detail.business_purpose", "detail.principal_address"];
  if (structure === "llc") ids.push("detail.management");
  const stateName = value("profile.state") ?? profile.location.state;
  return {
    kind: "ready",
    basis: {
      structure,
      name: value("profile.name")!,
      stateName,
      texas: profile.location.state === "TX",
      owners,
      managed: structure === "llc" ? (management === displayDetail("management", "manager_managed") ? "manager" : "members") : null,
      purpose: value("detail.business_purpose"),
      address: value("detail.principal_address"),
    },
    // A fact missing now is kept as "", so it appearing later flags the agreement too
    used: Object.fromEntries(ids.map((id) => [id, value(id) ?? ""])),
  };
}

// The plan step that shows the agreement: the structure's own formation step, else the structure decision
export function agreementStepKey(steps: readonly { key: string; topic: PlanTopic; forStructures: readonly BusinessStructure[] }[], structure: AgreementStructure): string | null {
  const structureSteps = steps.filter((step) => step.topic === "structure");
  return (structureSteps.find((step) => step.forStructures.includes(structure)) ?? structureSteps.find((step) => !step.forStructures.length) ?? null)?.key ?? null;
}

// --- The owner's choices

export const choicesInputSchema = z.object({
  // The owners the page showed, so shares can't land on the wrong person after a change elsewhere
  owners: z.array(z.string().max(300)).max(10),
  members: z.array(z.object({ percent: z.string().max(10), contribution: z.string().max(MAX_CONTRIBUTION) })).max(10),
  decisions: z.enum(DECISION_RULES).nullable(),
  manager: z.string().max(MAX_MANAGER),
  // The draft the page showed (draftStamp), so another tab's newer one isn't replaced unseen
  basedOn: z.string().max(80),
});
export type ChoicesInput = z.infer<typeof choicesInputSchema>;

export interface AgreementMember {
  name: string;
  // Hundredths of a percent, so shares add up exactly
  basisPoints: number;
  contribution: string;
}

export interface AgreementChoices {
  members: AgreementMember[];
  decisions: DecisionRule | null;
  manager: string | null;
}

export function checkChoices(basis: AgreementBasis, input: ChoicesInput): { ok: true; choices: AgreementChoices } | { ok: false; message: string } {
  const single = basis.owners.length === 1;
  if (input.owners.join("\n") !== basis.owners.join("\n") || input.members.length !== basis.owners.length) {
    return { ok: false, message: "Your owners changed. Reload the page and try again." };
  }
  const members: AgreementMember[] = [];
  for (const [index, name] of basis.owners.entries()) {
    const typed = input.members[index];
    const contribution = typed.contribution.replace(/[\s.]+$/, "").trim();
    if (looksLikeIdNumber(contribution)) return { ok: false, message: "Leave Social Security and tax ID numbers out of the agreement." };
    if (single) {
      members.push({ name, basisPoints: 10_000, contribution });
      continue;
    }
    const percent = typed.percent.trim().replace(/\s*%$/, "");
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(percent) || Number(percent) > 100) return { ok: false, message: `Enter what ${name} owns as a percent, like 50 or 33.33.` };
    if (Number(percent) === 0) return { ok: false, message: `${name}’s share needs to be more than 0%.` };
    members.push({ name, basisPoints: Math.round(Number(percent) * 100), contribution });
  }
  const total = members.reduce((sum, member) => sum + member.basisPoints, 0);
  if (total !== 10_000) return { ok: false, message: `The owners’ shares add up to ${percentText(total)}. They need to add up to 100%.` };

  if (!single && !input.decisions) return { ok: false, message: "Choose how the owners make decisions." };
  const manager = input.manager.trim();
  if (basis.managed === "manager" && !manager) return { ok: false, message: "Enter the name of the person who manages the LLC." };
  if (looksLikeIdNumber(manager)) return { ok: false, message: "Leave Social Security and tax ID numbers out of the agreement." };
  const choices = { members, decisions: single ? null : input.decisions, manager: basis.managed === "manager" ? manager : null };

  // A signed document can't have names with letters swapped for "?"
  const letters = unprintable([basis.name, ...basis.owners, basis.purpose ?? "", basis.address ?? "", choices.manager ?? "", ...members.map((member) => member.contribution)].join(" "));
  if (letters.length) {
    return { ok: false, message: `SnapStart’s PDFs can’t print ${letters.join(" ")} yet, so it can’t make this agreement without changing a name or detail. Ask a lawyer to prepare it for now.` };
  }
  return { ok: true, choices };
}

// Changes when the draft is prepared again or approved
export function draftStamp(draft: { inputs: Record<string, string>; approvedAt: string | null } | null): string {
  return draft ? `${draft.inputs.prepared_at ?? ""}|${draft.approvedAt ?? ""}` : "";
}

// Saved with the draft, so the page can show the answers again
export function choicesToInputs(choices: AgreementChoices, preparedAt: string): Record<string, string> {
  return {
    prepared_at: preparedAt,
    decisions: choices.decisions ?? "",
    manager: choices.manager ?? "",
    ...Object.fromEntries(choices.members.flatMap((member, index) => [[`member.${index}.percent`, percentNumber(member.basisPoints)], [`member.${index}.contribution`, member.contribution]])),
  };
}

// The owner's saved answers, for the owners named when it was prepared
export function inputsToChoices(inputs: Record<string, string>, owners: string[], basedOn = ""): ChoicesInput {
  const decisions = inputs.decisions;
  return {
    owners,
    members: owners.map((_, index) => ({ percent: inputs[`member.${index}.percent`] ?? "", contribution: inputs[`member.${index}.contribution`] ?? "" })),
    decisions: (DECISION_RULES as readonly string[]).includes(decisions) ? (decisions as DecisionRule) : null,
    manager: inputs.manager ?? "",
    basedOn,
  };
}

function percentNumber(basisPoints: number): string {
  return String(basisPoints / 100);
}

export function percentText(basisPoints: number): string {
  return `${percentNumber(basisPoints)}%`;
}

// --- The agreement

export interface BuiltAgreement {
  title: string;
  sections: PlanSection[];
  // Members or partners, what each owns and puts in; listed as Schedule A when there are several
  schedule: AgreementMember[];
  signers: string[];
  owner: "member" | "partner";
}

export function buildAgreement(basis: AgreementBasis, choices: AgreementChoices): BuiltAgreement {
  const llc = basis.structure === "llc";
  const single = choices.members.length === 1;
  const who = llc ? "member" : "partner";
  const whos = `${who}s`;
  const entity = llc ? "the Company" : "the Partnership";
  const Entity = llc ? "The Company" : "The Partnership";
  const formation = basis.texas ? "certificate of formation" : "formation document";
  const everyone = single ? `the ${who}` : `every ${who}`;
  const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);
  const section = (key: string, heading: string, ...parts: (string | false | null)[]): PlanSection => ({
    key,
    heading,
    body: parts.filter(Boolean).join(" "),
    flags: [],
  });

  const lawful = basis.purpose ? `${Entity} may carry on any lawful business. Its main business is: ${sentence(basis.purpose)}` : `${Entity} may carry on any lawful business.`;
  const office = basis.address ? `Its principal office is at ${basis.address.split("\n").map((line) => line.trim()).filter(Boolean).join(", ")}.` : null;
  const opening = llc
    ? section(
        "company",
        "The Company",
        basis.texas
          ? `${basis.name} (the “Company”) is a Texas limited liability company, formed by filing a certificate of formation with the Texas Secretary of State. This is the Company’s company agreement under the Texas Business Organizations Code. Texas law governs it and covers anything it doesn’t.`
          : `${basis.name} (the “Company”) is a limited liability company formed under ${basis.stateName} law. This is the Company’s operating agreement. ${basis.stateName} law governs it and covers anything it doesn’t.`,
        lawful,
        office,
        `This agreement takes effect when the Company’s ${formation} takes effect, or when ${everyone} has signed it, if that’s later.`,
      )
    : section(
        "partnership",
        "The Partnership",
        `The partners who sign below agree to run ${basis.name} (the “Partnership”) together as a general partnership, to make a profit. This is the Partnership’s partnership agreement${basis.texas ? " under the Texas Business Organizations Code" : ""}. ${basis.stateName} law governs it and covers anything it doesn’t.`,
        lawful,
        office,
        "This agreement takes effect when every partner has signed it.",
      );

  const [first] = choices.members;
  const ownership = single
    ? section("members", "The member", `${first.name} is the Company’s only member and owns 100% of it.`, first.contribution && `${first.name}’s starting contribution: ${sentence(first.contribution)}`)
    : section(
        "members",
        llc ? "Members and ownership" : "Partners and ownership",
        `${Entity}’s ${whos}, what each owns, and what each is putting in are listed in Schedule A at the end of this agreement. Schedule A is part of this agreement. When ownership changes, Schedule A is updated in writing and signed by every ${who}.`,
        `No ${who} has to put in more money or property unless every ${who} agrees.`,
      );

  const signs = "can act and sign for";
  const banking = "including opening and using its bank accounts";
  const runs = llc
    ? choices.manager
      ? section(
          "management",
          "Who runs the Company",
          `The Company is managed by a manager, ${choices.manager}. The manager runs the Company day to day and ${signs} it, ${banking}.`,
          single ? "The member can replace the manager at any time, in writing." : "The members can replace the manager at any time, by a decision made as described under “Decisions.”",
        )
      : single
        ? section("management", "Who runs the Company", `The Company is managed by its member. The member ${signs} the Company, ${banking}.`)
        : section(
            "management",
            "Who runs the Company",
            `The Company is managed by its members. Each member ${signs} the Company in its everyday business, ${banking}.`,
            "Anything outside everyday business is decided as described under “Decisions.”",
          )
    : section(
        "management",
        "Running the business",
        `Each partner ${signs} the Partnership in its everyday business, ${banking}.`,
        "Anything outside everyday business is decided as described under “Decisions.”",
      );

  const major = llc
    ? `adding a new member; a member selling or giving away any part of what they own; selling all or nearly all of what the Company owns; merging or converting the Company; changing this agreement or the Company’s ${formation}; and ending the Company.`
    : "adding a new partner; a partner selling or giving away any part of what they own; selling all or nearly all of what the Partnership owns; changing this agreement; and ending the Partnership.";
  const decisions = single
    ? null
    : section(
        "decisions",
        "Decisions",
        choices.decisions === "everyone"
          ? `The ${whos} make decisions together. A decision passes only when every ${who} agrees.`
          : `The ${whos} make decisions by vote. Each ${who}’s vote counts in proportion to what they own, as listed in Schedule A. A decision passes when ${whos} who together own more than half of ${entity} agree.`,
        `These always need every ${who}’s written agreement: ${major}`,
      );

  const money = section(
    "money",
    "Money",
    `${Entity} keeps its money in its own bank accounts, separate from ${single ? "the member’s" : `any ${who}’s`} personal money.`,
    single
      ? "The member decides when the Company pays out profits."
      : `Profits and losses are shared in proportion to what each ${who} owns. ${Entity} pays out profits when the ${whos} decide to, in proportion to what each ${who} owns.`,
    llc && "The Company won’t make a payout to a member as an owner if, right after it, the Company’s total debts would be more than the fair value of everything it owns.",
  );

  const debts = llc
    ? section("debts", "Debts", `This agreement doesn’t make any member${choices.manager ? " or the manager" : ""} personally responsible for the Company’s debts.`)
    : section(
        "debts",
        "Debts",
        "Each partner can be personally responsible for the Partnership’s debts. This agreement doesn’t change that for anyone the Partnership owes. Between the partners, losses are shared as described under “Money.”",
      );

  const taxes = section("taxes", "Taxes", `${Entity} is taxed the way federal tax law treats it by default, unless ${single ? "the member chooses" : `the ${whos} choose`} another treatment and file${single ? "s" : ""} for it with the IRS.`);

  const records = section(
    "records",
    "Records",
    llc && basis.texas
      ? "The Company keeps at its principal office: a current list of its members and what each owns; its certificate of formation and any changes to it; this agreement and any changes to it; and its federal, state and local tax returns for the last six years."
      : `${Entity} keeps a current list of its ${whos} and what each owns, ${llc ? "its formation document, " : ""}this agreement and any changes to ${llc ? "them" : "it"}, and its tax returns.`,
  );

  const changes = section("changes", "Changing this agreement", `This agreement can be changed only in writing signed by ${everyone}.`);

  return {
    title: `${llc ? (basis.texas ? "Company Agreement" : "Operating Agreement") : "Partnership Agreement"} of ${basis.name}`,
    sections: [opening, ownership, runs, decisions, money, debts, taxes, records, changes].filter((each) => each !== null),
    schedule: choices.members,
    signers: choices.members.map((member) => member.name),
    owner: who,
  };
}

// What a starter agreement leaves for a lawyer
export function notCovered(structure: AgreementStructure, owners: number): string[] {
  const who = structure === "llc" ? "member" : "partner";
  if (owners === 1) return ["Who takes over the business if you die or can’t run it."];
  return [
    `What happens when a ${who} wants to leave, dies or can’t work, and how their share is valued and bought.`,
    `What happens if the ${who}s can’t agree on a decision.`,
    `Whether a ${who} can run a competing business.`,
    "Whether anyone is paid for their work, apart from sharing profits.",
  ];
}

export function agreementPdf(built: BuiltAgreement, preparedOn: string, approvedOn: string): PdfSpec {
  const multiple = built.schedule.length > 1;
  return {
    title: built.title,
    subtitle: `Prepared ${preparedOn} · Approved ${approvedOn}`,
    notice: `Prepared by SnapStart from your answers. It’s a starting point, not legal advice: have a lawyer review it${multiple ? ", especially with more than one owner" : ""}. It isn’t filed with the state: ${multiple ? `every ${built.owner} signs it` : `the ${built.owner} signs it`}, and the business keeps it with its records.`,
    blocks: [
      ...built.sections.map((section) => ({ heading: section.heading, paragraphs: [section.body] })),
      ...(multiple
        ? [
            {
              heading: "Schedule A: Owners",
              entries: built.schedule.map((member) => ({
                label: member.name,
                value: `Owns ${percentText(member.basisPoints)}`,
                note: `Puts in: ${member.contribution || "nothing recorded yet"}`,
              })),
            },
          ]
        : []),
      {
        heading: "Signatures",
        paragraphs: [multiple ? `Every ${built.owner} signs and dates below.` : `The ${built.owner} signs and dates below.`],
        entries: built.signers.map((name) => ({ label: name, value: "Signature: ____________________________    Date: ______________" })),
      },
    ],
    footer: "Prepared with SnapStart",
  };
}
