// Steps for sending customer emails to the owner's SnapStart address, from each provider's own help pages.
// SnapStart never signs in to the owner's email; the owner makes every change.

// Read with a page fetch while building, not by the app's server, so each source is marked handChecked
const CHECKED = "2026-11-03";

export interface ForwardSource {
  title: string;
  url: string;
  checked: string;
  handChecked: true;
}

// One step; `icon` only for the forward-one-email steps
export type StepIcon = "open" | "forward" | "paste" | "send" | "back";

export interface OneEmailGuide {
  id: "gmail-app" | "iphone-mail" | "outlook-app";
  label: string;
  steps: { icon: StepIcon; text: string }[];
  source: ForwardSource;
  unstated?: string;
}

export interface AutoGuide {
  id: "gmail" | "outlook" | "yahoo" | "icloud" | "other";
  // Tab label
  label: string;
  // Where it must be done, only when the provider's page says so
  where?: string;
  steps: string[];
  // What the provider sends to the SnapStart address to verify it
  confirms?: string;
  // Paid plan the provider's page says forwarding needs
  needsPlan?: string;
  // Forwarding only emails with words like order, quote, booking
  filter?: { title: string; steps: string[]; source: ForwardSource; unstated?: string };
  sources: ForwardSource[];
  unstated?: string;
}

const source = (title: string, url: string): ForwardSource => ({ title, url, checked: CHECKED, handChecked: true });

const GMAIL_FORWARD_ONE = source("Forward an email (Gmail Help)", "https://support.google.com/mail/answer/15162918?hl=en");
const IPHONE_FORWARD_ONE = source(
  "Reply to and forward emails in Mail on iPhone (iPhone User Guide)",
  "https://support.apple.com/guide/iphone/reply-to-and-forward-emails-iph3caef30a/ios",
);
const OUTLOOK_APP_SWITCH = source(
  "How do I switch between reply all/reply/forward? (Outlook for iOS and Android)",
  "https://support.microsoft.com/en-US/Outlook/how-do-i-switch-between-reply-all-reply-forward-how-do-i-edit-recipients",
);
const GMAIL_AUTO = source("Automatically forward Gmail messages to another account (Gmail Help)", "https://support.google.com/mail/answer/10957?hl=en");
const GMAIL_FILTERS = source("Create rules to filter your emails (Gmail Help)", "https://support.google.com/mail/answer/6579?hl=en");
const GMAIL_SEARCH = source("Search operators you can use with Gmail (Gmail Help)", "https://support.google.com/mail/answer/7190?hl=en");
const OUTLOOK_AUTO = source(
  "Turn on or off automatic forwarding in Outlook.com (Microsoft Support)",
  "https://support.microsoft.com/en-us/outlook/turn-on-or-off-automatic-forwarding-in-outlook-com",
);
const OUTLOOK_RULES = source(
  "Inbox rules in Outlook.com (Microsoft Support)",
  "https://support.microsoft.com/office/use-inbox-rules-in-outlook-com-4b094371-a5d7-49bd-8b1b-4e4896a7cc5d",
);
const OUTLOOK_FORWARD_RULES = source(
  "Use rules to automatically forward messages (Microsoft Support)",
  "https://support.microsoft.com/en-us/office/use-rules-to-automatically-forward-messages-45aa9664-4911-4f96-9663-ece42816d746",
);
const YAHOO_AUTO = source("Enable automatic email forwarding in Yahoo Mail (Yahoo Help)", "https://help.yahoo.com/kb/SLN29133.html");
const YAHOO_AUTO_NEW = source("Enable automatic email forwarding in New Yahoo Mail (Yahoo Help)", "https://help.yahoo.com/kb/SLN36684.html");
const YAHOO_FILTERS = source("Use filters to organize Yahoo Mail (Yahoo Help)", "https://help.yahoo.com/kb/SLN28071.html");
const ICLOUD_AUTO = source(
  "Automatically forward email in Mail on iCloud.com (iCloud User Guide)",
  "https://support.apple.com/guide/icloud/automatically-forward-email-mm6b1a3960/icloud",
);
const ICLOUD_RULES = source(
  "Set up rules to filter email in Mail on iCloud.com (iCloud User Guide)",
  "https://support.apple.com/guide/icloud/mm6b1a3f8a/icloud",
);

const BACK = { icon: "back" as const, text: "Come back here and tap Read new emails." };

export const FORWARD_ONE: OneEmailGuide[] = [
  {
    id: "gmail-app",
    label: "Gmail app",
    steps: [
      { icon: "open", text: "Open the Gmail app and tap the customer’s email to open it." },
      { icon: "forward", text: "Tap Forward at the bottom of the email. In a long conversation, tap More (top right of that email), then Forward." },
      { icon: "paste", text: "In the To line, paste your SnapStart address." },
      { icon: "send", text: "Tap Send." },
      BACK,
    ],
    source: GMAIL_FORWARD_ONE,
  },
  {
    id: "iphone-mail",
    label: "iPhone Mail",
    steps: [
      { icon: "open", text: "Open the Mail app on your iPhone and tap the customer’s email." },
      { icon: "forward", text: "Tap the Reply button (the curved arrow), then tap Forward. If it asks about attachments, tap Include." },
      { icon: "paste", text: "In the To line, paste your SnapStart address." },
      { icon: "send", text: "Tap the Send button." },
      BACK,
    ],
    source: IPHONE_FORWARD_ONE,
    unstated: "Apple’s forwarding steps stop after entering the address; the Send button comes from the same page’s steps for replying.",
  },
  {
    id: "outlook-app",
    label: "Outlook app",
    steps: [
      { icon: "open", text: "Open the Outlook app and tap the customer’s email, then tap the reply box at the bottom." },
      { icon: "forward", text: "Tap the list of names in the reply box, then choose Forward." },
      { icon: "paste", text: "Paste your SnapStart address as the person to send it to." },
      { icon: "send", text: "Tap Send." },
      BACK,
    ],
    source: OUTLOOK_APP_SWITCH,
    unstated: "Microsoft’s page says to tap the recipients list in the reply box to switch to Forward. It doesn’t name the Send button.",
  },
];

export const FORWARD_AUTO: AutoGuide[] = [
  {
    id: "gmail",
    label: "Gmail (on a computer)",
    where: "Do this on a computer. Google’s steps are for Gmail in a web browser, not the phone app.",
    steps: [
      "Open Gmail on your computer and sign in to the email customers write to.",
      "Click the Settings gear (top right), then See all settings.",
      "Click the Forwarding and POP/IMAP tab.",
      "In the Forwarding section, click Add a forwarding address.",
      "Paste your SnapStart address, then click Next, then Proceed, then OK.",
      "Gmail sends a verification email to your SnapStart address. Wait for it to show up at the top of this page (refresh after a minute), then click its verification link.",
      "Go back to Gmail and refresh the page. Open the Forwarding and POP/IMAP tab again.",
      "In the Forwarding section, choose Forward a copy of incoming mail to, with your SnapStart address.",
      "Next to it, pick Keep Gmail’s copy in the Inbox, so you still see every email in Gmail.",
      "Scroll to the bottom and click Save Changes.",
    ],
    confirms: "Gmail emails a verification link to your SnapStart address. It shows up at the top of this page.",
    filter: {
      title: "Only forward emails about orders",
      steps: [
        "First do the steps above up to clicking the verification link, but don’t choose Forward a copy of incoming mail to.",
        "In the Gmail search box at the top, click Show search options.",
        "Where it asks for words, type: order OR quote OR booking OR invoice",
        "At the bottom of the search window, click Create filter.",
        "Check Forward it, and choose your SnapStart address.",
        "Click Create filter.",
      ],
      source: GMAIL_FILTERS,
      unstated: "Google’s filter page doesn’t name the search fields or the forward choice; Forward it comes from Google’s forwarding page, and OR from its search operators page. Filters only forward new emails.",
    },
    sources: [GMAIL_AUTO, GMAIL_FILTERS, GMAIL_SEARCH],
    unstated: "Google’s page says the verification email has a link. It doesn’t give the email’s subject line.",
  },
  {
    id: "outlook",
    label: "Outlook.com",
    steps: [
      "Sign in to Outlook.com.",
      "Open Settings, then Mail, then Forwarding.",
      "Turn on Enable forwarding.",
      "Paste your SnapStart address.",
      "Check Keep a copy of forwarded messages, so you still see every email in Outlook.",
      "Click Save.",
      "If Outlook asks you to turn on two-step verification or confirm it’s you, follow its steps.",
    ],
    filter: {
      title: "Only forward emails about orders",
      steps: [
        "In Outlook.com, open Settings, then Mail, then Rules.",
        "Click Add new rule and give it a name, like Orders to SnapStart.",
        "Click Add a condition and pick the one for words in the subject or body. Type order, quote, booking, invoice.",
        "Click Add an action, choose Forward to, and paste your SnapStart address.",
        "Click Save.",
      ],
      source: OUTLOOK_RULES,
      unstated: "Microsoft’s rules pages don’t list the condition names, so look for the one about words in the subject or body. Forward to is named on Microsoft’s forwarding rules page. Rules only work on new emails.",
    },
    sources: [OUTLOOK_AUTO, OUTLOOK_RULES, OUTLOOK_FORWARD_RULES],
    unstated: "Microsoft’s page doesn’t say whether Outlook.com sends a confirmation email to the forwarding address, or limit how many emails it forwards.",
  },
  {
    id: "yahoo",
    label: "Yahoo Mail",
    where: "Do this in a web browser on a computer.",
    needsPlan: "Yahoo says: “Upgrade to Yahoo Mail Plus to use the email forwarding feature in your Settings.”",
    steps: [
      "Open Yahoo Mail in your web browser.",
      "Click the Settings icon, then More Settings. (In the newer Yahoo Mail, click the More options icon, then Settings.)",
      "Click Mailboxes.",
      "Under Mailbox list, click your main mailbox.",
      "Under Forwarding (called Auto-forwarding in the newer Yahoo Mail), paste your SnapStart address.",
      "Click Verify.",
      "Yahoo sends instructions to your SnapStart address. They show up at the top of this page. Follow them to finish.",
    ],
    confirms: "Yahoo sends instructions to your SnapStart address to confirm it. They show up at the top of this page.",
    sources: [YAHOO_AUTO, YAHOO_AUTO_NEW, YAHOO_FILTERS],
    unstated: "Yahoo’s pages don’t say what the confirmation email looks like, or whether the forwarded emails stay in your Yahoo inbox. Yahoo says forwarding isn’t in every country. Yahoo’s filter page only mentions moving emails to a folder or the trash, not forwarding, so forward emails one at a time if you only want some.",
  },
  {
    id: "icloud",
    label: "iCloud Mail",
    where: "Do this at icloud.com/mail in a web browser.",
    steps: [
      "Go to icloud.com/mail and sign in with your Apple Account.",
      "Click the Settings button at the top of the Mailboxes list, then choose Settings.",
      "Click Mail Forwarding in the sidebar.",
      "Check Forward my email to, and paste your SnapStart address.",
      "Leave Delete messages after forwarding unchecked, so you still see every email in iCloud.",
    ],
    filter: {
      title: "Only forward emails about orders",
      steps: [
        "At icloud.com/mail, click the Settings button at the top of the Mailboxes list, then choose Settings.",
        "Click Rules in the sidebar, then the Add button in the top-right corner.",
        "Give the rule a name, like Orders to SnapStart.",
        "Under Message, use the menu and text box to pick emails with a word like order.",
        "Under Action, choose to forward, and paste your SnapStart address.",
        "Click Add.",
      ],
      source: ICLOUD_RULES,
      unstated: "Apple’s rules page doesn’t name the menu choices or say whether one rule can match several words. It says new rules can take up to 15 minutes to start working, and each forwarding rule takes one address.",
    },
    sources: [ICLOUD_AUTO, ICLOUD_RULES],
    unstated: "Apple’s page doesn’t mention a Save button or say whether iCloud sends a confirmation email to the forwarding address.",
  },
  {
    id: "other",
    label: "Other email",
    steps: [
      "Open your email’s settings on a computer and look for Forwarding.",
      "Paste your SnapStart address as the address to forward to.",
      "Keep a copy in your own inbox, so you still see every email.",
      "Save your changes.",
      "If your email sends a code or link to confirm, it shows up at the top of this page.",
    ],
    sources: [],
  },
];
