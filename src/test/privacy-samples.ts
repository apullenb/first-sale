import type { SensitiveKind } from "@/lib/privacy/sensitive";

// Two sample documents for the privacy check (docs/VALIDATION.md). Every number in them is made up.
// Each line says what should happen to it: kept as is, or its number removed as a given kind.

export interface SampleLine {
  text: string;
  // The value on the line that must survive or be removed
  value: string;
  expect: "kept" | SensitiveKind;
  why: string;
}

export interface PrivacySample {
  id: string;
  title: string;
  lines: SampleLine[];
}

const header = (text: string): SampleLine => ({ text, value: text, expect: "kept", why: "Heading" });

export const SSN_LETTER: PrivacySample = {
  id: "1-ssn-letter",
  title: "Tax letter with a made-up Social Security number",
  lines: [
    header("SAMPLE NOTICE - NOT A REAL DOCUMENT. EVERY NUMBER IS MADE UP."),
    header("Notice of taxpayer account"),
    { text: "Taxpayer: Jordan Example, Rise & Crumb", value: "Jordan Example, Rise & Crumb", expect: "kept", why: "Names are needed to match the document to the business" },
    { text: "Address: 1200 Barton Springs Rd, Austin, TX 78704-1234", value: "78704-1234", expect: "kept", why: "ZIP+4 is five digits, then four" },
    { text: "Date of this notice: 11/04/2026", value: "11/04/2026", expect: "kept", why: "A date" },
    { text: "Social Security number: 123-45-6789", value: "123-45-6789", expect: "ssn", why: "Formatted 3-2-4 in the SSA's issued ranges" },
    { text: "Phone: (512) 555-0143", value: "(512) 555-0143", expect: "kept", why: "Phone numbers are 3-3-4" },
    { text: "Amount due: $0.00 by 12/01/2026", value: "$0.00 by 12/01/2026", expect: "kept", why: "Money and dates" },
    { text: "Refund bank routing number: 021000021", value: "021000021", expect: "routing", why: "Labeled, and passes the ABA checksum" },
    { text: "Account number: 000123456789", value: "000123456789", expect: "account", why: "Labeled bank account number" },
    header("Keep this notice for your records."),
  ],
};

export const LOOKALIKES: PrivacySample = {
  id: "2-lookalikes",
  title: "Vendor application full of numbers that only look sensitive",
  lines: [
    header("SAMPLE FORM - NOT A REAL DOCUMENT. EVERY NUMBER IS MADE UP."),
    header("City vendor permit application"),
    { text: "Business phone: 512-555-0123", value: "512-555-0123", expect: "kept", why: "Phone, 3-3-4" },
    { text: "Mailing ZIP code: 78704-1234", value: "78704-1234", expect: "kept", why: "ZIP+4, 5-4" },
    { text: "Permit number: 2026-001234", value: "2026-001234", expect: "kept", why: "Year and serial, 4-6" },
    { text: "Order number: 123456789", value: "123456789", expect: "kept", why: "Nine digits, but no SSN or tax ID label" },
    { text: "Invoice 021000021", value: "021000021", expect: "kept", why: "Passes the ABA checksum, but isn't labeled as a routing number" },
    { text: "Gift card reference: 4111 1111 1111 1112", value: "4111 1111 1111 1112", expect: "kept", why: "Card-shaped, but fails the Luhn check" },
    { text: "Tracking number: 9400 1000 0000 0000 0000 00", value: "9400 1000 0000 0000 0000 00", expect: "kept", why: "22 digits, longer than any card" },
    { text: "Social Security number: ___-__-____", value: "___-__-____", expect: "kept", why: "A blank to fill in" },
    { text: "Example only: 000-00-0000", value: "000-00-0000", expect: "kept", why: "The SSA never issues area 000" },
    { text: "Case 07-1234567", value: "07-1234567", expect: "kept", why: "EIN-shaped, but the IRS never assigns prefix 07" },
    { text: "Zoning: City Code section 25-2-901", value: "25-2-901", expect: "kept", why: "A code section" },
    { text: "Texas taxpayer number: 32012345678", value: "32012345678", expect: "kept", why: "Eleven digits: not an SSN or EIN" },
    { text: "Application fee: $25.00, due 2026-12-01", value: "$25.00, due 2026-12-01", expect: "kept", why: "Money and an ISO date" },
    { text: "Booth size: 10 x 10 feet, 2 tables, 120 volt outlet", value: "10 x 10 feet, 2 tables, 120 volt", expect: "kept", why: "Measurements" },
    header("Sign and date below."),
  ],
};

export const PRIVACY_SAMPLES = [SSN_LETTER, LOOKALIKES] as const;
