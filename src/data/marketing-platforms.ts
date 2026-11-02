// Places a small business can show up, with setup steps written from each company's own help page.
// `checked` is the date the steps were compared with that page; null means its page couldn't be read, so the steps are general.

export const MARKETING_PLATFORMS = [
  "instagram",
  "facebook",
  "google_business",
  "tiktok",
  "pinterest",
  "youtube",
  "nextdoor",
  "yelp",
  "linkedin",
  "email_list",
] as const;
export type MarketingPlatformId = (typeof MARKETING_PLATFORMS)[number];

// The intake question whose answer sets how much help a step gets
export const SKILL_AREAS = ["social", "seo", "content"] as const;
export type SkillArea = (typeof SKILL_AREAS)[number];

export interface MarketingLink {
  label: string;
  url: string;
}

export interface MarketingPlatform {
  id: MarketingPlatformId;
  name: string;
  // One plain line for the intake checkbox
  goodFor: string;
  area: SkillArea;
  // Other names the plan might use, for the "never suggest" check
  aliases: string[];
  // "Take me there": to sign up, or to an account the owner already has; null when there's no one place to go
  start: MarketingLink | null;
  home: MarketingLink | null;
  // Step titles, when "Set up {name}" doesn't read well
  setupTitle?: string;
  tidyTitle?: string;
  help: MarketingLink;
  // Exact clicks, for owners new to this
  walkthrough: string[];
  // For owners who know their way around
  checklist: string[];
  // When the owner already has the account
  tidy: string[];
  checked: string | null;
}

const FTC_EMAIL = "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business";

export const PLATFORM_DATA: Record<MarketingPlatformId, MarketingPlatform> = {
  instagram: {
    id: "instagram",
    name: "Instagram",
    goodFor: "Photos and short videos. Great for food, crafts and clothing.",
    area: "social",
    aliases: ["insta", "IG"],
    start: { label: "Open Instagram sign-up", url: "https://www.instagram.com/accounts/emailsignup/" },
    home: { label: "Open Instagram", url: "https://www.instagram.com/" },
    help: { label: "Instagram’s guide to business accounts", url: "https://www.facebook.com/help/instagram/502981923235522" },
    walkthrough: [
      "Install the Instagram app on your phone and sign up with your business email. Use your business name as the username if it’s free.",
      "Tap your profile picture at the bottom right.",
      "Tap the More icon (three lines) at the top to open Settings and activity.",
      "Under For professionals, tap Account type and tools.",
      "Tap Switch to professional account, pick the category closest to your business, then tap Switch to professional account again.",
      "Choose Business, then tap Next.",
      "Add your business email and phone and tap Next, or tap Don’t use my contact info.",
      "If it offers to connect another account, connect it or tap Skip.",
      "Back on your profile, tap Edit profile. Add your profile picture, a one-line bio that says what you sell and where, and your website or shop link.",
    ],
    checklist: ["Create the account with your business email", "Switch to a Business account (Account type and tools)", "Add your profile picture, bio and link"],
    tidy: [
      "Check it’s a Business account: Settings and activity, then Account type and tools",
      "Use your logo’s profile-picture version",
      "Bio: what you sell, where, and how to buy",
      "Add your website or shop link",
    ],
    checked: "2026-10-28",
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    goodFor: "A business page where neighbors and regulars find your hours, news and reviews.",
    area: "social",
    aliases: ["FB"],
    start: { label: "Open Facebook’s Create a Page", url: "https://www.facebook.com/pages/create" },
    home: { label: "Open Facebook", url: "https://www.facebook.com/" },
    help: { label: "Facebook’s guide to creating a Page", url: "https://www.facebook.com/help/104002523024878" },
    walkthrough: [
      "Log in to Facebook on a computer. You need a personal Facebook account to make a Page.",
      "Click Pages on the left, then click Create page.",
      "Select Public page, click Next, then click Get started.",
      "Enter your business name as the Page name and pick the closest category.",
      "Add a short bio if you like, then click Create Page.",
      "Add your contact info, location and hours, then click Next.",
      "Add your profile picture and cover photo, then click Next.",
      "Connect WhatsApp or click Skip. Invite friends to follow your Page, then click Next.",
      "Choose your notification settings and click Done.",
    ],
    checklist: ["Create a Public page (Pages, then Create page)", "Add contact info, hours, profile picture and cover", "Invite friends to follow"],
    tidy: ["Check the name, category, hours and contact info", "Use your logo and cover picture", "Point the action button at your shop or contact details"],
    checked: "2026-10-28",
  },
  google_business: {
    id: "google_business",
    name: "Google Business Profile",
    goodFor: "Shows up when people search Google or Maps for what you sell nearby.",
    area: "seo",
    aliases: ["Google Maps", "Google My Business", "Google review"],
    start: { label: "Open Google’s profile setup", url: "https://business.google.com/create" },
    home: { label: "Open your Business Profile", url: "https://business.google.com/" },
    setupTitle: "Set up your Google Business Profile",
    tidyTitle: "Get your Google Business Profile ready for customers",
    help: { label: "Google’s guide to adding your business", url: "https://support.google.com/business/answer/10514137" },
    walkthrough: [
      "On a computer, sign in to your Google account, or create one with your business email.",
      "Go to Google’s profile setup page (the link below).",
      "Type your business name, or pick it if Google suggests it, then search for your category and click Next.",
      "If customers can visit a place that’s staffed during business hours, click Yes and enter the address. If not, such as when you work from home, click No.",
      "Enter the areas you serve: up to 20 cities or ZIP codes.",
      "Enter your phone number and website, then click Next, then Finish.",
      "Choose how to verify your business. Click Verify now, or Verify later if you need more time.",
    ],
    checklist: ["Create the profile at business.google.com/create", "Set category, service area or address, phone and website", "Verify it"],
    tidy: ["Check hours, phone, website and category", "Add photos of what you sell", "Ask your first happy customers for a review"],
    checked: "2026-10-28",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    goodFor: "Short, casual videos. Good for showing how you make things.",
    area: "social",
    aliases: [],
    start: { label: "Open TikTok sign-up", url: "https://www.tiktok.com/signup" },
    home: { label: "Open TikTok", url: "https://www.tiktok.com/" },
    help: { label: "TikTok’s help center", url: "https://support.tiktok.com/en" },
    walkthrough: [
      "Install the TikTok app and tap Sign up. Use your business email.",
      "Tap Profile at the bottom right, then the menu (three lines) at the top right.",
      "Tap Settings and privacy, then Account.",
      "Tap Switch to Business Account and pick the category closest to your business.",
      "Back on your profile, tap Edit profile. Add your logo, a short bio and your website or shop link.",
    ],
    checklist: ["Create the account with your business email", "Switch to a Business Account (Settings and privacy, then Account)", "Add logo, bio and link"],
    tidy: ["Check it’s a Business Account", "Use your logo’s profile-picture version", "Bio: what you sell and how to buy", "Add your website or shop link"],
    checked: null,
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    goodFor: "People save ideas here. Good for handmade goods, recipes, decor and clothing.",
    area: "social",
    aliases: [],
    start: { label: "Open Pinterest", url: "https://www.pinterest.com/" },
    home: { label: "Open Pinterest", url: "https://www.pinterest.com/" },
    help: { label: "Pinterest’s guide to business accounts", url: "https://help.pinterest.com/en/business/article/get-a-business-account" },
    walkthrough: [
      "On a computer, go to pinterest.com. If you’re logged in to a personal account, log out first.",
      "Click Sign up at the top right, then click Create a business account.",
      "Enter your business email, make a password and enter your age, then click Create account.",
      "Fill in your profile, then click Next.",
      "Describe your business, then click Next.",
      "Say whether you want to run ads (you can skip ads for now), then click Next.",
      "Pick where to start, or click the X to go to your new account.",
    ],
    checklist: ["Create a business account (Sign up, then Create a business account)", "Fill in profile and business details", "Make a board for each kind of thing you sell"],
    tidy: [
      "Check it’s a business account. To convert: Settings, then Account management, then Convert account",
      "Add your logo, description and website",
      "Make a board for each kind of thing you sell",
    ],
    checked: "2026-10-28",
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    goodFor: "Longer videos, like how-tos and behind the scenes.",
    area: "social",
    aliases: ["YouTuber"],
    start: { label: "Open YouTube settings", url: "https://www.youtube.com/account" },
    home: { label: "Open YouTube Studio", url: "https://studio.youtube.com/" },
    help: { label: "YouTube’s guide to creating a channel", url: "https://support.google.com/youtube/answer/1646861" },
    walkthrough: [
      "Sign in to YouTube on a computer with your Google account.",
      "Click your profile picture, then click Settings.",
      "Under Account, click Add or manage channel(s).",
      "Click Create a new channel, so the channel uses your business name.",
      "Choose a profile picture and enter your business name and a handle.",
      "Click Create channel.",
      "Add your banner and a short description of what you sell.",
    ],
    checklist: ["Create a channel with your business name (Settings, then Add or manage channel(s))", "Add logo, banner and description"],
    tidy: ["Check the channel uses your business name", "Add your logo, banner and a description", "Add your website or shop link"],
    checked: "2026-10-28",
  },
  nextdoor: {
    id: "nextdoor",
    name: "Nextdoor",
    goodFor: "Neighbors recommend local businesses. Good for home services and food.",
    area: "social",
    aliases: [],
    start: { label: "Open Nextdoor for business", url: "https://business.nextdoor.com/local" },
    home: { label: "Open Nextdoor for business", url: "https://business.nextdoor.com/local" },
    help: { label: "Nextdoor’s guide to Business Pages", url: "https://business.nextdoor.com/en-us/getting-started/business-page" },
    walkthrough: [
      "Go to Nextdoor for business (the link below) and select Claim Your Free Business Page.",
      "Search for your business with its name and town. If it’s there, claim it.",
      "If it isn’t there, scroll to the bottom and click Not here? to create your page.",
      "Log in, or make an account. To keep the business apart from your personal account, select Sign Up under the green login button.",
      "Fill in what you sell, the area you serve, your contact details and your logo.",
    ],
    checklist: ["Claim or create your free Business Page at business.nextdoor.com/local", "Add details, service area and logo"],
    tidy: ["Check your details and service area", "Use your logo", "Ask happy customers to recommend you"],
    checked: "2026-10-28",
  },
  yelp: {
    id: "yelp",
    name: "Yelp",
    goodFor: "Reviews people check before visiting or hiring a local business.",
    area: "seo",
    aliases: [],
    start: { label: "Open Yelp for Business", url: "https://biz.yelp.com/claim" },
    home: { label: "Open Yelp for Business", url: "https://biz.yelp.com/" },
    help: { label: "Yelp’s Business Page guide", url: "https://business.yelp.com/products/business-page/" },
    walkthrough: [
      "Go to Yelp for Business (the link below). Creating and claiming a page is free.",
      "Enter your business name to start. If it’s listed, claim it. If not, add it.",
      "Make your Yelp for Business login and check your details.",
      "Wait for Yelp to approve it. Yelp says that usually takes about a day.",
      "Log in every few months. Yelp may show a page as unclaimed if the owner hasn’t logged in for 90 days.",
    ],
    checklist: ["Claim or add your free page at biz.yelp.com/claim", "Log in every few months so it stays claimed"],
    tidy: ["Check hours, photos and contact details", "Log in every few months so it stays claimed"],
    checked: "2026-10-28",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    goodFor: "For selling to other businesses, and for services.",
    area: "social",
    aliases: [],
    start: { label: "Open LinkedIn", url: "https://www.linkedin.com/" },
    home: { label: "Open LinkedIn", url: "https://www.linkedin.com/" },
    help: { label: "LinkedIn’s guide to Pages", url: "https://www.linkedin.com/help/linkedin/answer/a543852" },
    walkthrough: [
      "Log in to LinkedIn on a computer. You need a personal LinkedIn account.",
      "Click For Business at the top right of your home page.",
      "Scroll down and click Create a Company Page.",
      "Choose Company.",
      "Fill in your business name, website and industry, and add your logo and a tagline.",
      "Tick the box that says you can act for the business, then click Create page.",
    ],
    checklist: ["Create a Company Page (For Business, then Create a Company Page)", "Add logo, tagline and website"],
    tidy: ["Check your logo, tagline and website", "Add a short About section"],
    checked: "2026-10-28",
  },
  email_list: {
    id: "email_list",
    name: "Email list",
    goodFor: "Your own list of customers to tell about new items and events.",
    area: "social",
    aliases: ["newsletter", "email newsletter", "mailing list"],
    start: null,
    home: null,
    setupTitle: "Start your email list",
    tidyTitle: "Get your email list ready",
    help: { label: "The FTC’s email law guide for businesses", url: FTC_EMAIL },
    walkthrough: [
      "Pick an email tool. Many website builders include one, so customers stay in one place.",
      "Make a sign-up form, and add it to your website and your social profiles.",
      "Ask in person too: keep a sign-up sheet or a QR code where you sell. Only add people who said yes.",
      "Write a short welcome email: who you are, what you sell and how to order.",
      "Every marketing email must include your postal address (a registered P.O. box counts) and a clear way to opt out. That’s US law; see the FTC’s guide.",
      "Send an email when you have news, like new items or where you’ll be next.",
    ],
    checklist: ["Pick an email tool and make a sign-up form", "Add the form to your site and profiles", "Write a welcome email with your postal address and an opt-out"],
    tidy: ["Add a sign-up form to your site and profiles", "Check each email has your postal address and an opt-out"],
    // No one tool's screens to follow; the legal step is from the FTC's guide
    checked: "2026-10-28",
  },
};
