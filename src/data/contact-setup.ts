// Setting up a business email address and phone number with Google's own free-to-start tools.
// Every fact quotes or closely follows Google's pages below, with the date checked. The owner signs up themselves;
// SnapStart never creates accounts or collects passwords.

// Read with a page fetch while building, not by the app's server, so each source is marked handChecked
const CHECKED = "2026-11-01";

export interface ContactSource {
  title: string;
  url: string;
  checked: string;
  handChecked: true;
}

export interface ContactFact {
  // What the quote answers, like "Cost"
  label: string;
  // Google's words
  quote: string;
  source: ContactSource;
}

export interface ContactGuide {
  title: string;
  // Where the owner signs up, on Google's own site
  signUp: { label: string; url: string };
  steps: string[];
  stepsSource: ContactSource;
  facts: ContactFact[];
  // What the pages above don't say, so the owner checks it while signing up
  unstated: string;
}

const ACCOUNT_HELP: ContactSource = {
  title: "Create a Google Account (Google Account Help)",
  url: "https://support.google.com/accounts/answer/27441?hl=en",
  checked: CHECKED,
  handChecked: true,
};

const VOICE_SETUP: ContactSource = {
  title: "Set up Google Voice, on a computer (Google Voice Help)",
  url: "https://support.google.com/voice/answer/115061?hl=en&co=GENIE.Platform%3DDesktop",
  checked: CHECKED,
  handChecked: true,
};

const VOICE_PLANS: ContactSource = {
  title: "Google Voice plans (Google Workspace)",
  url: "https://workspace.google.com/products/voice/",
  checked: CHECKED,
  handChecked: true,
};

const VOICE_TEXTS: ContactSource = {
  title: "Send & get text messages (Google Voice Help)",
  url: "https://support.google.com/voice/answer/115116?hl=en",
  checked: CHECKED,
  handChecked: true,
};

export const GMAIL_GUIDE: ContactGuide = {
  title: "Create a business Gmail address",
  signUp: { label: "Google Account sign-in page", url: "https://accounts.google.com/" },
  steps: [
    "Go to the Google Account sign-in page.",
    "Click Create account.",
    "Choose the type of account, then follow the on-screen instructions.",
    "When Google suggests Gmail addresses, pick or make one with your business name, so customers recognize it.",
    "Add and verify a phone number if you’d like. Google lists this step as optional.",
  ],
  stepsSource: ACCOUNT_HELP,
  facts: [
    { label: "Good to know", quote: "Your Gmail and Google Accounts are separate.", source: ACCOUNT_HELP },
    { label: "Phone number", quote: "Optional: Add and verify a phone number for your account.", source: ACCOUNT_HELP },
  ],
  unstated: "The Google help page above doesn’t state a price or an age requirement for a Google Account. Google asks for your birthday while you sign up; check what it shows you there.",
};

export const VOICE_GUIDE: ContactGuide = {
  title: "Get a Google Voice phone number",
  signUp: { label: "voice.google.com", url: "https://voice.google.com/" },
  steps: [
    "Go to voice.google.com.",
    "Sign in to your Google Account.",
    "Review the Terms of Service and Privacy Policy, then click Continue.",
    "Search for available numbers by city or area code.",
    "Next to the number you want, click Select.",
    "Follow the on-screen instructions.",
  ],
  stepsSource: VOICE_SETUP,
  facts: [
    { label: "Cost of the Basic plan", quote: "$0/ month", source: VOICE_PLANS },
    { label: "What you need", quote: "Existing mobile number required", source: VOICE_PLANS },
    { label: "Where", quote: "Available in the US", source: VOICE_PLANS },
    { label: "Choosing a number", quote: "If you're in the US, you can choose your own number.", source: VOICE_SETUP },
    { label: "Toll-free numbers", quote: "Google Voice doesn’t offer 1–800 numbers.", source: VOICE_SETUP },
    { label: "Texting", quote: "Google Voice messaging is intended only for 1:1, personal conversations.", source: VOICE_TEXTS },
  ],
  unstated: "The Google pages above don’t state an age requirement. Google also sells paid Voice plans; the Basic plan is the one listed at no monthly cost.",
};
