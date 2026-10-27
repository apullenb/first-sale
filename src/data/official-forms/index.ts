import { addressPart, addressPiece, type AutofillContext, fact, type Filled, tick } from "@/lib/documents/autofill";
import type { CheckedFact, OfficialForm } from "@/lib/documents/form-catalog";

// Official forms and applications for the demo place (Austin, Travis County, Texas) and federal ones for everyone.
// Each quote was read on the official page on the day shown. Re-check before changing anything here.

const CHECKED = "2026-10-27";

const IRS_EIN = { sourceTitle: "IRS: Get an employer identification number", sourceUrl: "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number" };
const SS4_HELP = { sourceTitle: "IRS: Instructions for Form SS-4 (Rev. December 2025)", sourceUrl: "https://www.irs.gov/pub/irs-pdf/iss4.pdf" };
const TX_205 = { sourceTitle: "Texas Secretary of State: Form 205 (Revised 09/26)", sourceUrl: "https://www.sos.texas.gov/corp/forms/205_boc.pdf" };
const TX_503 = { sourceTitle: "Texas Secretary of State: Form 503 (Revised 09/26)", sourceUrl: "https://www.sos.texas.gov/corp/forms/503_boc.pdf" };
const SOS_FORMS = { sourceTitle: "Texas Secretary of State: Business forms", sourceUrl: "https://www.sos.texas.gov/corp/forms_boc.shtml" };
const TRAVIS_DBA = { sourceTitle: "Travis County Clerk: Assumed names (DBAs)", sourceUrl: "https://countyclerk.traviscountytx.gov/departments/recording/dbas/" };
const TRAVIS_FORM = {
  sourceTitle: "Travis County Clerk: Assumed name certificate for unincorporated persons",
  sourceUrl: "https://countyclerk.traviscountytx.gov/wp-content/uploads/recording/DBAunincorporatedDLM.pdf",
};
const CPA_FAQ = { sourceTitle: "Texas Comptroller: Obtaining a sales tax permit", sourceUrl: "https://comptroller.texas.gov/taxes/sales/faq/permit.php" };
const CPA_PERMIT = { sourceTitle: "Texas Comptroller: Sales tax permit application", sourceUrl: "https://comptroller.texas.gov/taxes/permit/" };
const AP201 = { sourceTitle: "Texas Comptroller: Form AP-201 (Rev.7-26/31)", sourceUrl: "https://comptroller.texas.gov/forms/ap-201.pdf" };

const checked = (source: { sourceTitle: string; sourceUrl: string }, text: string, quote: string): CheckedFact => ({
  ...source,
  text,
  quote,
  checkedOn: CHECKED,
});

const SS4 = "topmostSubform[0].Page1[0].";
const TITLES = { sole_proprietorship: "Owner", partnership: "Partner", llc: "Member", corporation: "President" } as const;

// `from`: the facts that made this an owner-only blank, so changing them flags the draft
const owner = (why: string, from: string[] = []): Filled => ({ owner: why, from });

function oneOwner(ctx: AutofillContext, then: () => Filled, many: string): Filled {
  if (ctx.profile.owners.count !== 1) return owner(many, ["profile.owner_count"]);
  const filled = then();
  return "missing" in filled ? filled : { ...filled, from: [...(filled.from ?? []), "profile.owner_count"] };
}

// The LLC's management choice, a saved business detail
function managed(ctx: AutofillContext, which: "member_managed" | "manager_managed"): Filled {
  const chosen = ctx.facts.get("detail.management");
  if (!chosen) return { missing: "Add who runs the LLC (its members or a manager) to your business details." };
  const yes = chosen.value === (which === "member_managed" ? "The owners (member-managed)" : "A chosen manager (manager-managed)");
  return { value: yes ? "Yes" : "No", from: ["detail.management"], sure: true };
}

const purpose = (ctx: AutofillContext): Filled =>
  ctx.facts.has("detail.business_purpose") ? fact(ctx, "detail.business_purpose") : fact(ctx, "profile.first_items", { sure: false, missing: "Add a one-sentence description of what the business does." });

const mailingOrStreet = (ctx: AutofillContext) => (ctx.facts.has("detail.mailing_address") ? "detail.mailing_address" : "detail.principal_address");
const separateStreet = (ctx: AutofillContext) =>
  ctx.facts.has("detail.mailing_address") &&
  ctx.facts.has("detail.principal_address") &&
  ctx.facts.get("detail.mailing_address")!.value.trim() !== ctx.facts.get("detail.principal_address")!.value.trim();

export const OFFICIAL_FORMS: OfficialForm[] = [
  {
    key: "irs-ss4",
    title: "Form SS-4: Application for Employer Identification Number (EIN)",
    formNumber: "SS-4",
    revision: "Rev. December 2025",
    agency: "Internal Revenue Service (IRS)",
    level: "federal",
    state: null,
    domain: "irs.gov",
    pdfUrl: "https://www.irs.gov/pub/irs-pdf/fss4.pdf",
    // Linked from the IRS page above; it refuses automated requests, so only the owner opens it
    onlineUrl: "https://sa.www4.irs.gov/modiein/individual/index.jsp",
    selfDownload: null,
    handChecked: ["https://sa.www4.irs.gov/modiein/individual/index.jsp"],
    pageUrl: IRS_EIN.sourceUrl,
    pageTitle: IRS_EIN.sourceTitle,
    mustContain: ["Form SS-4", "(Rev. December 2025)", "Application for Employer Identification Number"],
    fits: { topics: ["tax_registration", "employer"], pattern: /\bein\b|employer identification/i },
    fee: { ...checked(IRS_EIN, "Free. The IRS never charges for an EIN.", "You never have to pay a fee for an EIN."), cents: 0 },
    renewal: null,
    deadline: null,
    before: [
      checked(
        IRS_EIN,
        "If you’re forming an LLC or corporation, file that with the state first.",
        "If you are creating a corporation or LLC, form your entity through the secretary of state before you apply for an EIN.",
      ),
      checked(IRS_EIN, "Only one EIN application per responsible party per day.", "You can apply for only 1 EIN per responsible party per day."),
    ],
    submit: [
      {
        kind: "online",
        how: "Apply online with the IRS’s own tool. Finish in one sitting: it times out after 15 minutes without activity, so have your answers ready.",
        url: "https://sa.www4.irs.gov/modiein/individual/index.jsp",
        timing: checked(IRS_EIN, "If it’s approved, you get your EIN right away online.", "If it’s approved, we’ll issue your EIN immediately online."),
      },
      {
        kind: "fax",
        how: "Fax the signed form to the IRS at 855-641-6935 (for businesses in the 50 states and DC).",
        timing: checked(SS4_HELP, "Usually within 4 business days.", "Under the Fax-TIN program, you can receive your EIN by fax generally within 4 business days."),
      },
      {
        kind: "mail",
        how: "Mail the signed form at least 4 to 5 weeks before you need the EIN.",
        address: ["Internal Revenue Service", "Attn: EIN Operation", "Cincinnati, OH 45999"],
        timing: checked(SS4_HELP, "About 4 weeks.", "You will receive your EIN in the mail in approximately 4 weeks."),
      },
    ],
    signature: checked(SS4_HELP, "A paper form must be signed and dated by you.", "Sign and date the application and mail it to the appropriate address."),
    afterward: [checked(IRS_EIN, "Print or save the confirmation letter.", "Print your EIN confirmation letter for your records.")],
    receipt: "The EIN confirmation letter (online), or the EIN the IRS faxes or mails back",
    fields: [
      { fieldId: `${SS4}PgHeader[0].f1_1[0]`, line: "Top of page 1", label: "EIN box, for the IRS to fill in", answer: () => owner("Leave this blank. The IRS fills in your EIN.") },
      {
        fieldId: `${SS4}f1_2[0]`,
        line: "Line 1",
        label: "Legal name of the business, or your own name for a sole proprietorship",
        answer: (ctx) => {
          if (!ctx.structure) return { missing: "Decide your business structure first: it decides whose name goes here." };
          if (ctx.structure === "sole_proprietorship") {
            return oneOwner(
              ctx,
              () => fact(ctx, "detail.owner_names", { note: "Your own legal name, as on your Social Security card.", also: ["derived.structure"] }),
              "A sole proprietorship has one owner.",
            );
          }
          if (ctx.structure === "partnership") {
            return fact(ctx, "profile.name", { sure: false, note: "Use the partnership’s exact legal name, as in your partnership agreement.", also: ["derived.structure"] });
          }
          return owner("Use the exact legal name on your filed articles, including “LLC” or “Inc.” if it has one.", ["derived.structure"]);
        },
      },
      {
        fieldId: `${SS4}f1_3[0]`,
        line: "Line 2",
        label: "Trade name, if different from line 1",
        answer: (ctx) => {
          if (ctx.structure !== "sole_proprietorship") return owner("Only if you sell under a name different from line 1.", ["derived.structure"]);
          if (ctx.profile.nameIsLegalName === "yes") return owner("Leave this blank: you said you sell under your own name.", ["derived.name_is_legal_name", "derived.structure"]);
          return fact(ctx, "profile.name", {
            missing: "Add your business name, or leave this blank if you sell under your own name.",
            also: ["derived.structure", "derived.name_is_legal_name"],
          });
        },
      },
      { fieldId: `${SS4}Line4ReadOrder[0].f1_5[0]`, line: "Line 4a", label: "Mailing address", answer: (ctx) => addressPart(ctx, mailingOrStreet(ctx), "street") },
      { fieldId: `${SS4}Line4ReadOrder[0].f1_6[0]`, line: "Line 4b", label: "City, state and ZIP code", answer: (ctx) => addressPart(ctx, mailingOrStreet(ctx), "rest") },
      {
        fieldId: `${SS4}f1_7[0]`,
        line: "Line 5a",
        label: "Street address, if different from the mailing address",
        answer: (ctx) => (separateStreet(ctx) ? addressPart(ctx, "detail.principal_address", "street") : owner("Leave blank if it’s the same as your mailing address. No P.O. boxes here.", ["detail.mailing_address", "detail.principal_address"])),
      },
      {
        fieldId: `${SS4}f1_8[0]`,
        line: "Line 5b",
        label: "City, state and ZIP code of the street address",
        answer: (ctx) => (separateStreet(ctx) ? addressPart(ctx, "detail.principal_address", "rest") : owner("Leave blank if line 5a is blank.", ["detail.mailing_address", "detail.principal_address"])),
      },
      {
        fieldId: `${SS4}f1_9[0]`,
        line: "Line 6",
        label: "County and state where the business is",
        answer: (ctx) => fact(ctx, "derived.county_state", { missing: "Add your county to your answers." }),
      },
      {
        fieldId: `${SS4}f1_10[0]`,
        line: "Line 7a",
        label: "Name of the responsible party (the owner in control)",
        answer: (ctx) => oneOwner(ctx, () => fact(ctx, "detail.owner_names"), "Pick one owner who controls the business. Their name goes here, and their SSN on line 7b."),
      },
      {
        fieldId: `${SS4}f1_11[0]`,
        line: "Line 7b",
        label: "Responsible party’s SSN, ITIN or EIN",
        answer: () => owner("Enter it yourself on the form or the online application. First Sale never asks for it or stores it."),
      },
      { fieldId: `${SS4}c1_1[0]`, kind: "checkbox", line: "Line 8a", label: "Is this for an LLC? Yes", answer: (ctx) => tick(ctx, ["llc"]) },
      { fieldId: `${SS4}c1_1[1]`, kind: "checkbox", line: "Line 8a", label: "Is this for an LLC? No", answer: (ctx) => tick(ctx, ["sole_proprietorship", "partnership", "corporation"]) },
      {
        fieldId: `${SS4}f1_12[0]`,
        line: "Line 8b",
        label: "Number of LLC members",
        answer: (ctx) => (ctx.structure === "llc" ? fact(ctx, "profile.owner_count", { also: ["derived.structure"] }) : owner("Only for an LLC.", ["derived.structure"])),
      },
      {
        fieldId: `${SS4}c1_2[0]`,
        kind: "checkbox",
        line: "Line 8c",
        label: "Was the LLC organized in the United States? Yes",
        answer: (ctx) => (ctx.structure === "llc" ? { value: "Yes", from: ["derived.structure"], sure: true } : owner("Only for an LLC.", ["derived.structure"])),
      },
      {
        fieldId: `${SS4}c1_3[0]`,
        kind: "checkbox",
        line: "Line 9a",
        label: "Type of entity: Sole proprietor",
        answer: (ctx) => (ctx.structure === "llc" ? owner("For an LLC, the instructions say which box to check.", ["derived.structure"]) : tick(ctx, ["sole_proprietorship"])),
      },
      {
        fieldId: `${SS4}c1_3[2]`,
        kind: "checkbox",
        line: "Line 9a",
        label: "Type of entity: Partnership",
        answer: (ctx) => (ctx.structure === "llc" ? owner("For an LLC, the instructions say which box to check.", ["derived.structure"]) : tick(ctx, ["partnership"])),
      },
      {
        fieldId: `${SS4}c1_4[0]`,
        kind: "checkbox",
        line: "Line 10",
        label: "Reason for applying: Started new business",
        answer: (ctx) =>
          ctx.profile.stage === "registered"
            ? owner("You said you’re already registered. Pick the reason that fits.", ["derived.stage"])
            : { value: "Yes", from: ["derived.stage"], sure: false, note: "Most new businesses pick this reason. Check that it fits." },
      },
      { fieldId: `${SS4}f1_31[0]`, line: "Line 11", label: "Date the business started", answer: (ctx) => fact(ctx, "detail.start_date") },
      { fieldId: `${SS4}f1_38[0]`, line: "Line 17", label: "Main products or services", answer: purpose },
      {
        fieldId: `${SS4}f1_44[0]`,
        line: "Applicant",
        label: "Name and title of the person signing",
        answer: (ctx) =>
          oneOwner(
            ctx,
            () => {
              const name = ctx.facts.get("detail.owner_names");
              if (!name) return { missing: "Add your owners’ full legal names to your business details." };
              if (!ctx.structure) return { missing: "Decide your business structure first: it decides your title." };
              return { value: `${name.value}, ${TITLES[ctx.structure]}`, from: ["detail.owner_names", "derived.structure"], sure: false };
            },
            "The owner who signs writes their own name and title.",
          ),
      },
      { fieldId: `${SS4}f1_45[0]`, line: "Applicant", label: "Applicant’s phone number", answer: (ctx) => fact(ctx, "detail.business_phone", { sure: false }) },
    ],
    checkedOn: CHECKED,
    notes: [],
  },
  {
    key: "tx-llc-205",
    title: "Texas Form 205: Certificate of Formation, Limited Liability Company",
    formNumber: "205",
    revision: "Revised 09/26",
    agency: "Texas Secretary of State",
    level: "state",
    state: "TX",
    forStructures: ["llc"],
    domain: "texas.gov",
    pdfUrl: TX_205.sourceUrl,
    onlineUrl: "https://www.sos.texas.gov/corp/sosda/index.shtml",
    selfDownload: null,
    pageUrl: SOS_FORMS.sourceUrl,
    pageTitle: SOS_FORMS.sourceTitle,
    mustContain: ["Certificate of Formation", "Limited Liability Company", "Form 205", "(Revised 09/26)"],
    fits: { topics: ["structure", "name_registration", "other"], pattern: /\bllc\b|limited liability|certificate of formation|articles/i },
    fee: { ...checked(TX_205, "$300 to file the certificate.", "Filing Fee: $300"), cents: 30000 },
    renewal: null,
    deadline: null,
    before: [],
    submit: [
      {
        kind: "online",
        how: "File online with the Secretary of State’s SOSPortal, or mail the signed form to the address printed on it.",
        url: "https://www.sos.texas.gov/corp/sosda/index.shtml",
        address: ["Secretary of State", "P.O. Box 13697", "Austin, TX 78711-3697"],
      },
    ],
    signature: checked(
      TX_205,
      "You sign as the organizer, and you confirm your registered agent has agreed to serve.",
      "The undersigned affirms that the person designated as registered agent has consented to the appointment.",
    ),
    afterward: [checked(TX_205, "It takes effect when the Secretary of State files it, unless you choose a later date.", "A. This document becomes effective when the document is filed by the secretary of state.")],
    receipt: "The Secretary of State’s filed certificate",
    fields: [
      {
        fieldId: "The name of the entity is:",
        line: "Article 1",
        label: "Name of the LLC",
        answer: (ctx) => fact(ctx, "profile.name", { sure: false, note: "The name must include “limited liability company”, “limited company” or an abbreviation, like LLC.", also: ["derived.structure"] }),
      },
      { kind: "checkbox", fieldId: "company", line: "Article 3", label: "The LLC has managers", answer: (ctx) => managed(ctx, "manager_managed") },
      { kind: "checkbox", fieldId: "company2", line: "Article 3", label: "The LLC doesn’t have managers (run by its members)", answer: (ctx) => managed(ctx, "member_managed") },
      { fieldId: "Initial Mailing Address", line: "Mailing address", label: "Mailing address for franchise tax letters", answer: (ctx) => addressPart(ctx, mailingOrStreet(ctx), "street") },
      { fieldId: "City of Initial Mailing Address", line: "Mailing address", label: "City", answer: (ctx) => addressPiece(ctx, mailingOrStreet(ctx), "city") },
      { fieldId: "State of Initial Mailing Address", line: "Mailing address", label: "State", answer: (ctx) => addressPiece(ctx, mailingOrStreet(ctx), "state") },
      { fieldId: "Zip Code of Initial Mailing Address", line: "Mailing address", label: "ZIP code", answer: (ctx) => addressPiece(ctx, mailingOrStreet(ctx), "zip") },
      { fieldId: "Country of Initial Mailing Address", line: "Mailing address", label: "Country", answer: () => ({ value: "United States", from: [], sure: true }) },
    ],
    checkedOn: CHECKED,
    notes: ["Your registered agent, the people who run the LLC, and the organizer are left for you: each needs a full name as it appears on their ID."],
  },
  {
    key: "tx-assumed-name-503",
    title: "Texas Form 503: Assumed Name Certificate (for an LLC or corporation)",
    formNumber: "503",
    revision: "Revised 09/26",
    agency: "Texas Secretary of State",
    level: "state",
    state: "TX",
    forStructures: ["llc", "corporation"],
    whoFor: "For an LLC or corporation selling under another name",
    domain: "texas.gov",
    pdfUrl: TX_503.sourceUrl,
    onlineUrl: "https://www.sos.texas.gov/corp/sosda/index.shtml",
    selfDownload: null,
    pageUrl: SOS_FORMS.sourceUrl,
    pageTitle: SOS_FORMS.sourceTitle,
    mustContain: ["Assumed Name Certificate", "Form 503", "(Revised 09/26)"],
    fits: { topics: ["name_registration"], pattern: /./ },
    fee: { ...checked(TX_503, "$25 to file.", "Filing Fee: $25"), cents: 2500 },
    renewal: null,
    deadline: null,
    before: [
      checked(
        TRAVIS_DBA,
        "An incorporated business files its assumed name with the Secretary of State only, not the county.",
        "Note: As of September 1, 2019, the Travis County Clerk’s Recording Division will no longer record/file Incorporated Assumed Names. That form will be registered with the Secretary of State’s Office only.",
      ),
    ],
    submit: [
      {
        kind: "online",
        how: "File online with the Secretary of State’s SOSPortal, or mail the signed form to the address printed on it.",
        url: "https://www.sos.texas.gov/corp/sosda/index.shtml",
        address: ["Secretary of State", "P.O. Box 13697", "Austin, TX 78711-3697"],
      },
    ],
    signature: null,
    afterward: [checked(TX_503, "It can last up to 10 years from filing.", "7a. The period during which the assumed name will be used is 10 years from the date of filing with the secretary of state.")],
    receipt: "The Secretary of State’s filed certificate",
    fields: [
      {
        fieldId: "1. The assumed name under which the business or professional service is, or is to be, conducted or rendered is:",
        line: "Item 1",
        label: "The name you’ll sell under",
        answer: (ctx) => fact(ctx, "profile.name", { missing: "Pick a business name first." }),
      },
      {
        fieldId: "2.  The legal name of the entity filing the assumed name is:",
        line: "Item 2",
        label: "Your LLC’s or corporation’s legal name",
        answer: () => owner("Use the exact name on your filed certificate of formation."),
      },
      { kind: "checkbox", fieldId: "limited-liability-company", line: "Item 3", label: "Type of entity: Limited liability company", answer: (ctx) => tick(ctx, ["llc"]) },
      { kind: "checkbox", fieldId: "for-profit-corporation", line: "Item 3", label: "Type of entity: For-profit corporation", answer: (ctx) => tick(ctx, ["corporation"]) },
      {
        fieldId: "5.  The state, country, or other jurisdiction of formation of the entity is:",
        line: "Item 5",
        label: "State where the LLC or corporation was formed",
        answer: (ctx) =>
          ctx.structure === "llc" || ctx.structure === "corporation"
            ? { value: ctx.place.stateName, from: ["derived.structure"], sure: false, note: "Change this if you formed it in another state." }
            : owner("Only for an LLC or corporation."),
      },
      { fieldId: "Street Address of the entity in its jurisdiction of formation is:", line: "Item 6", label: "Principal office street address", answer: (ctx) => addressPart(ctx, "detail.principal_address", "street") },
      { fieldId: "City of the entity in its jurisdiction of formation is:", line: "Item 6", label: "City", answer: (ctx) => addressPiece(ctx, "detail.principal_address", "city") },
      { fieldId: "State of the entity in its jurisdiction of formation is:", line: "Item 6", label: "State", answer: (ctx) => addressPiece(ctx, "detail.principal_address", "state") },
      { fieldId: "Zip or Postal Code of the entity in its jurisdiction of formation is:", line: "Item 6", label: "ZIP code", answer: (ctx) => addressPiece(ctx, "detail.principal_address", "zip") },
      { fieldId: "Country of the entity in its jurisdiction of formation is:", line: "Item 6", label: "Country", answer: () => ({ value: "United States", from: [], sure: true }) },
    ],
    checkedOn: CHECKED,
    notes: ["How long you’ll use the name, and in which counties, are your choices on the form."],
  },
  {
    key: "tx-travis-assumed-name",
    title: "Travis County assumed name certificate (for a sole proprietor or partnership)",
    formNumber: null,
    revision: null,
    agency: "Travis County Clerk",
    level: "county",
    state: "TX",
    county: "Travis",
    forStructures: ["sole_proprietorship", "partnership"],
    whoFor: "For a sole proprietor or partnership selling under another name",
    domain: "traviscountytx.gov",
    pdfUrl: TRAVIS_FORM.sourceUrl,
    onlineUrl: null,
    selfDownload: null,
    pageUrl: TRAVIS_DBA.sourceUrl,
    pageTitle: TRAVIS_DBA.sourceTitle,
    mustContain: ["ASSUMED NAME CERTIFICATE FOR CERTAIN UNINCORPORATED PERSONS", "Travis County Clerk"],
    fits: { topics: ["name_registration"], pattern: /./ },
    fee: {
      ...checked(
        TRAVIS_DBA,
        "$23 for the name and one owner, plus 50¢ for each other owner on the same certificate.",
        "Filing fee is $23.00 for business name and one owner. Additional owners are $.50 each filed on same statement.",
      ),
      cents: 2300,
    },
    renewal: null,
    deadline: null,
    before: [],
    submit: [
      {
        kind: "in_person",
        how: "File in person at the Travis County Clerk’s Recording Division. All owners come with ID.",
        url: TRAVIS_DBA.sourceUrl,
        timing: checked(TRAVIS_DBA, "Everyone named comes with ID.", "All owners must be present with valid government issued identification for recording."),
      },
      {
        kind: "mail",
        how: "Or mail the notarized certificate with a cashier’s check, money order or check.",
        address: ["Recording Division", "Travis County Clerk", "P.O. Box 149325", "Austin, TX 78714"],
      },
    ],
    signature: checked(TRAVIS_DBA, "Each owner signs in front of a notary or the clerk.", "Send completed notarized form for recording (assume name pdf form)."),
    afterward: [],
    receipt: "The recorded certificate from the Travis County Clerk",
    fields: [
      { fieldId: "Assumed Name", line: "Assumed name", label: "The name you’ll sell under", answer: (ctx) => fact(ctx, "profile.name", { missing: "Pick a business name first." }) },
      { fieldId: "Business Address", line: "Physical address", label: "Business street address", answer: (ctx) => addressPart(ctx, "detail.principal_address", "street") },
      { fieldId: "City", line: "Physical address", label: "City", answer: (ctx) => addressPiece(ctx, "detail.principal_address", "city") },
      { fieldId: "State", line: "Physical address", label: "State", answer: (ctx) => addressPiece(ctx, "detail.principal_address", "state") },
      { fieldId: "Zip Code", line: "Physical address", label: "ZIP code", answer: (ctx) => addressPiece(ctx, "detail.principal_address", "zip") },
      {
        fieldId: "Name_2",
        line: "Owners",
        label: "Owner’s full name",
        answer: (ctx) =>
          ctx.structure === "sole_proprietorship"
            ? oneOwner(ctx, () => fact(ctx, "detail.owner_names", { also: ["derived.structure"] }), "A sole proprietorship has one owner.")
            : owner("Each partner’s full name goes on its own line."),
      },
    ],
    checkedOn: CHECKED,
    notes: ["Home addresses for each owner, and which kind of registrant you are, are left for you to fill in."],
  },
  {
    key: "tx-sales-tax-permit",
    title: "Texas Form AP-201: Texas Application for Sales and Use Tax Permit",
    formNumber: "AP-201",
    revision: "Rev.7-26/31",
    agency: "Texas Comptroller of Public Accounts",
    level: "state",
    state: "TX",
    domain: "texas.gov",
    pdfUrl: AP201.sourceUrl,
    // The page holding the "Apply for Permit via eSystems" button; eSystems itself isn't on a .gov site
    onlineUrl: CPA_PERMIT.sourceUrl,
    selfDownload: null,
    pageUrl: CPA_FAQ.sourceUrl,
    pageTitle: CPA_FAQ.sourceTitle,
    mustContain: ["AP-201", "(Rev.7-26/31)", "Texas Application"],
    fits: { topics: ["tax_registration", "license_permit"], pattern: /sales (and use )?tax/i },
    fee: { ...checked(CPA_FAQ, "Free, though the Comptroller may ask for a security bond.", "There is no fee for the permit, but you may be required to post a security bond."), cents: 0 },
    renewal: null,
    deadline: null,
    before: [],
    submit: [
      {
        kind: "online",
        how: "Apply online through the Comptroller’s eSystems, from the official permit page.",
        url: CPA_PERMIT.sourceUrl,
        timing: checked(CPA_PERMIT, "2 to 3 weeks.", "Allow 2-3 weeks to receive your permit."),
      },
      { kind: "mail", how: "Or mail the signed AP-201 to the Comptroller.", address: ["Comptroller of Public Accounts", "111 E. 17th St.", "Austin, TX 78774-0100"] },
    ],
    signature: null,
    afterward: [],
    receipt: "Your sales and use tax permit",
    // AP-201's 231 blanks aren't mapped by hand, so the paper form is drafted by matching
    fields: [],
    guide: [
      { fieldId: "legal_name", line: "Legal name", label: "Owner’s or business’s legal name", answer: (ctx) => (ctx.structure === "sole_proprietorship" ? fact(ctx, "detail.owner_names", { also: ["derived.structure"] }) : owner("Your partnership’s or company’s legal name.")) },
      { fieldId: "dba", line: "Business name", label: "Name you sell under", answer: (ctx) => fact(ctx, "profile.name", { missing: "Pick a business name first." }) },
      { fieldId: "location", line: "Business location", label: "Where you’ll make sales", answer: (ctx) => fact(ctx, "detail.principal_address", { sure: false, note: "List each place of business; markets and events may be added later." }) },
      { fieldId: "county", line: "County", label: "County", answer: (ctx) => fact(ctx, "derived.county_state", { missing: "Add your county to your answers." }) },
      { fieldId: "what", line: "What you sell", label: "What you’ll sell", answer: purpose },
      { fieldId: "start", line: "First sale", label: "When you’ll make your first sale", answer: (ctx) => fact(ctx, "detail.start_date") },
      { fieldId: "tax_id", line: "Tax ID", label: "Your SSN or EIN", answer: () => owner("Enter this yourself on the application. First Sale never stores it.") },
    ],
    checkedOn: CHECKED,
    notes: [
      "First Sale hasn’t matched the paper form’s blanks to your details by hand yet. Use “Draft answers” on the form, and check each one.",
      "The online answers are prepared from what the Comptroller says the application needs. The application may ask for more.",
    ],
  },
];

export function officialForm(key: string): OfficialForm | null {
  return OFFICIAL_FORMS.find((form) => form.key === key) ?? null;
}
