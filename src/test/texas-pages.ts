import { textPdf } from "./pdf";

// Lines copied from official Texas, Travis County and Austin pages as the server read them on 2026-10-27 (Form 401-A on 2026-10-28), for research tests.
// Tests serve these instead of fetching the live pages; the .pdf ones come back as small PDFs.

export const TEXAS_PAGES: Record<string, string[]> = {
  "https://www.sos.texas.gov/corp/forms/205_boc.pdf": [
    "This space reserved for office use.",
    "Certificate of Formation",
    "Limited Liability Company",
    "Form 205",
    "(Revised 09/26)",
    "Secretary of State",
    "P.O. Box 13697",
    "Austin, TX 78711-3697",
    "Instructions",
    "Filing Fee: $300",
    "Article 1 – Entity Name and Type",
    "The filing entity being formed is a limited liability company. The name of the entity is:",
    "The name must contain the words “limited liability company,” “limited company,” or an abbreviation of one of these phrases.",
    "A. This document becomes effective when the document is filed by the secretary of state.",
    "The undersigned affirms that the person designated as registered agent has consented to the",
    "appointment. The undersigned also affirms that, to the best knowledge of the undersigned, the name",
  ],
  "https://www.sos.texas.gov/corp/forms/401-a-boc.pdf": [
    "Form 401-A",
    "(Revised 12/09)",
    "Acceptance of Appointment",
    "and",
    "Consent to Serve as Registered Agent",
    "§5.201(b) Business Organizations Code",
    "I acknowledge, accept and consent to my designation or appointment as registered agent in Texas for",
  ],
  "https://www.sos.texas.gov/corp/instructions/401-a.shtml": [
    "Form 401-A—General Information",
    "Acceptance of Appointment and Consent to Serve as Registered Agent",
    "Execution of Consent: If the person named as registered agent is an individual, the individual designated must sign the consent.",
    "Filing Not Required: The signed consent of the registered agent should be sent to and retained by the represented entity.",
  ],
  "https://www.sos.texas.gov/corp/forms/503_boc.pdf": [
    "This space reserved for office use.",
    "Assumed Name Certificate",
    "Form 503",
    "(Revised 09/26)",
    "Secretary of State",
    "P.O. Box 13697",
    "Austin, TX 78711-3697",
    "Instructions",
    "Filing Fee: $25",
    "Assumed Name",
    "1. The assumed name under which the business or professional service is, or is to be, conducted or",
    "rendered is:",
    "7a. The period during which the assumed name will be used is 10 years from the date of filing",
    "with the secretary of state.",
  ],
  "https://comptroller.texas.gov/taxes/sales/faq/permit.php": [
    "You must obtain a Texas sales and use tax permit if you are an individual, partnership, corporation or other legal entity engaged in business in Texas and you:",
    "Sell tangible personal property in Texas;",
    "You can apply for a sales tax permit using our Texas Online Sales Tax Registration Application System, or print AP-201, Texas Application for Sales and Use Tax Permit (PDF) from the Texas Sales and Use Tax Forms webpage and mail it to the Comptroller’s office at:",
    "Comptroller of Public Accounts",
    "111 E. 17th St.",
    "Austin, TX 78774-0100",
    "There is no fee for the permit, but you may be required to post a security bond. For more information on security bonds, contact a Comptroller field office.",
  ],
  "https://comptroller.texas.gov/taxes/permit/": [
    "Allow 2-3 weeks to receive your permit.",
  ],
  "https://comptroller.texas.gov/taxes/franchise/": [
    "The Texas franchise tax is a privilege tax imposed on each taxable entity formed or organized in Texas or doing business in Texas. For general information, see the Franchise Tax Overview.",
    "The annual franchise tax report is due May 15. If May 15 falls on a weekend or holiday, the due date will be the next business day.",
  ],
  "https://comptroller.texas.gov/taxes/publications/96-280.php": [
    "Bakery items sold by a business that qualifies as a bakery are not taxable. A bakery is a retail location where more than 50 percent of sales consist of bakery items sold from a display case or counter and consumed off the premises.",
    "Bakery items sold by a business that does not qualify as a bakery are taxable when sold with eating utensils (plates, knives, forks, spoons) or when heated.",
  ],
  "https://www.dshs.texas.gov/retail-food-establishments/permits-retail-food-establishments/texas-cottage-food-production": [
    "Instead of providing a physical home address on the label, operators may register on the DSHS Online Licensing Registry and place their registration number on the label.",
    "Cottage food production operations (CFPO) that sell time and temperature control for safety (TCS) foods must register on the DSHS Online Licensing Registry.",
    "The CFPO definition has been updated to include nonprofit organizations and increases the annual gross income threshold to $150,000.",
    "CFPOs may donate cottage foods unless the foods are TCS. TCS foods are not eligible for donation. Local public health entities may NOT regulate the production of food at a cottage food production operation; NOR require a cottage operation to:",
    "obtain any type of license or permit; OR",
    "\"THIS PRODUCT WAS PRODUCED IN A PRIVATE RESIDENCE THAT IS NOT SUBJECT TO GOVERNMENTAL LICENSING OR INSPECTION.\"",
    "Registration will allow CFPOs to label cottage foods with a unique identification number provided by DSHS instead of their home address.",
    "A cottage food production operation is exempt from the requirements of a food service establishment and does not have to comply with the Texas Food Establishment Rules. Health departments do not have regulatory authority to conduct inspections of a cottage food production operation or require any payment of fee to produce, sell, or provide samples directly to a consumer or cottage food vendor.",
    "An individual who operates a cottage food production operation must successfully complete a basic food safety education or training program for food handlers accredited under Health and Safety Code, Chapter 438(D) .",
    "After the operator accepts payment, the operator must provide their address or unique identification number on the label of the food.",
    "An individual who operates a cottage food production operation must have successfully completed an accredited basic food safety education or training program for food handlers.",
  ],
  "https://countyclerk.traviscountytx.gov/departments/recording/dbas/": [
    "Note: As of September 1, 2019, the Travis County Clerk’s Recording Division will no longer record/file Incorporated Assumed Names. That form will be registered with the Secretary of State’s Office only.",
    "Register an Assumed Name (DBA) in Travis County",
    "Submit an application online. All owners must be present with valid government issued identification for recording. Our office will accept cash, personal checks or credit card for payment of fee.",
    "Send completed notarized form for recording (assume name pdf form). Must send cashier's check, money order, or check to:",
    "Recording Division",
    "Travis County Clerk",
    "P.O. Box 149325",
    "Austin, TX 78714",
    "Filing fee is $23.00 for business name and one owner. Additional owners are $.50 each filed on same statement. If completing the process in the office, an additional $2.00 applies for each acknowledgement;",
  ],
  "https://www.austintexas.gov/development-services/small-business-permitting": [
    "A home-based business is a business that operates from a residential property, by the owner or tenant of the property, and is used for the purpose of manufacturing, providing, or selling a lawful good or providing a lawful service.",
    "The City of Austin cannot prohibit or require permits for home-based businesses that do not exceed occupancy limits, generate significant traffic, or create visible or noise disturbances.",
    "Home-based businesses do not need to rezone their property or install fire sprinkler systems if they operate in a single-family or multi-family residential structure with not more than two residential units.",
    "Homeowners' associations can enforce their own rules.",
  ],
};

export async function texasPage(url: string): Promise<Response | undefined> {
  const lines = TEXAS_PAGES[url];
  if (!lines) return undefined;
  if (url.endsWith(".pdf")) return new Response(await textPdf([lines]), { headers: { "Content-Type": "application/pdf" } });
  const body = lines.map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("");
  return new Response(`<html><body><main>${body}</main></body></html>`, { headers: { "Content-Type": "text/html" } });
}
