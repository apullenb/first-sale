import type { PlatformInfo } from "@/lib/website/platforms";
import type { PlatformId } from "@/lib/website/types";

// Prices, fees and help links read on each vendor's own pages on 2026-10-27.
// Recheck these pages before changing anything here: prices change often.

const CHECKED = "2026-10-27";

const PHOTOS = { label: "Make store-ready photos", href: "/photos" };
const BRAND = { label: "Make your logo and brand images", href: "/brand" };
const TAX_STEP = { label: "See the sales tax step in your plan", href: "/checklist" };
const ADDRESS = { label: "Pick your web address", href: "/website#step-address" };
const WORDS = { label: "Copy your words from step 3", href: "/website#step-words" };

export const PLATFORM_ORDER: PlatformId[] = ["square", "wix", "shopify"];

export const PLATFORM_DATA: Record<PlatformId, PlatformInfo> = {
  square: {
    id: "square",
    name: "Square",
    oneLine: "A free online store that shares one item list with Square’s card reader, so market and online sales stay in step.",
    bestFor: "selling in person or at markets, and starting with no monthly bill",
    canSell: true,
    startPlan: { name: "Square Free", price: "$0 a month", monthlyUsd: 0, adds: "A full online store with pickup, local delivery and shipping." },
    otherPlans: [
      { name: "Square Plus", price: "$49 a month per location", monthlyUsd: 49, adds: "Your own web address, no Square banner, abandoned-cart emails and reviews." },
      { name: "Square Premium", price: "$149 a month per location", monthlyUsd: 149, adds: "Live shipping rates, advanced reports and 24/7 phone support." },
    ],
    cardFee: { label: "3.3% + 30¢ per online card payment on Square Free (2.9% + 30¢ on Plus)", percent: 0.033, fixedCents: 30 },
    domain: {
      label: "A free yourname.square.site address. Your own .com needs Square Plus; Square sells web addresses starting at $19.95.",
      firstYearUsd: null,
    },
    includes: [
      "Hosting and a secure (https) site",
      "Unlimited items with photos and options",
      "Pickup, local delivery and shipping, with discounted shipping labels",
      "Apple Pay, Google Pay and Cash App Pay at checkout, plus Afterpay (6% + 30¢ per Afterpay sale)",
      "One item list and stock count shared with Square’s in-person checkout",
      "Tap to Pay on your phone, with no extra hardware",
      "Facebook and Instagram connections",
    ],
    notIncluded: [
      { item: "Your own web address", cost: "Square Plus ($49 a month) plus a web address from $19.95", why: "The Free plan uses a square.site address.", inApp: ADDRESS },
      { item: "A business email address", cost: "Set up through Google Workspace, which charges for it", why: "An address like you@yourname.com isn’t part of the site.", inApp: null },
      { item: "Card fees and postage", cost: "3.3% + 30¢ per online sale on Free, plus postage", why: "Taken from each sale; postage is paid per package.", inApp: null },
      { item: "Sales tax setup", cost: "Your time", why: "You enter the tax rates that apply to you.", inApp: TAX_STEP },
      { item: "Product photos and a logo", cost: "Your own", why: "Your store needs pictures of what you sell and your logo.", inApp: PHOTOS },
      { item: "Privacy and return policies", cost: "Your own", why: "Square’s terms require you to post a privacy policy.", inApp: null },
    ],
    pros: [
      "A real online store for $0 a month, with pickup, local delivery and shipping",
      "The same items and stock count at your market table and online",
      "Hosting, a secure site and unlimited items are included",
      "Take cards in person with just your phone",
    ],
    cons: [
      "Your own web address and removing the Square banner need Plus at $49 a month",
      "The Free plan’s online card fee is higher: 3.3% + 30¢",
      "Abandoned-cart emails and reviews need Plus",
      "Square’s plans page shows monthly prices only, per location",
    ],
    signupUrl: "https://squareup.com/us/en/online-store",
    sources: [
      { label: "Square plans", url: "https://squareup.com/us/en/online-store/plans" },
      { label: "Square fees", url: "https://squareup.com/us/en/payments/our-fees" },
      { label: "Square domains", url: "https://squareup.com/us/en/online-store/domains" },
    ],
    checkedOn: CHECKED,
    setupSteps: [
      {
        key: "square-account",
        title: "Create your Square account and start your site",
        detail: "Sign up, then follow Square’s guide to set up your website.",
        help: { label: "Square’s website setup guide", url: "https://squareup.com/help/us/en/article/6852-get-started-with-square-online-store" },
        inApp: null,
      },
      {
        key: "square-design",
        title: "Choose a style and add your pages",
        detail: "Pick a look, then add your home, about and contact pages. Use your logo and brand colors.",
        help: { label: "Choose a theme", url: "https://squareup.com/help/us/en/article/7820-choose-themes-for-your-square-online-site" },
        inApp: BRAND,
      },
      {
        key: "square-words",
        title: "Paste in your words",
        detail: "Copy each piece of your approved words into the matching page.",
        help: { label: "Create pages and menus", url: "https://squareup.com/help/us/en/article/6867-create-pages-and-navigation-in-square-online-store" },
        inApp: WORDS,
      },
      {
        key: "square-items",
        title: "Add what you sell, with photos and prices",
        detail: "Create each item, turn on online selling for it, and add photos.",
        help: { label: "Create and edit items", url: "https://squareup.com/help/us/en/article/8335-create-and-edit-items" },
        inApp: PHOTOS,
      },
      {
        key: "square-payments",
        title: "Set up payments and checkout",
        detail: "Choose how customers pay and what your checkout asks for.",
        help: { label: "Checkout options", url: "https://squareup.com/help/us/en/article/6859-checkout-options-with-square-online-store" },
        inApp: null,
      },
      {
        key: "square-fulfillment",
        title: "Set up pickup, delivery or shipping",
        detail: "Turn on the ways customers can get their orders, with times and prices.",
        help: { label: "Pickup options", url: "https://squareup.com/help/us/en/article/6866-in-store-and-curbside-pickup-with-square-online-store" },
        inApp: null,
      },
      {
        key: "square-tax",
        title: "Set up sales tax",
        detail: "Enter the tax rates that apply to what you sell.",
        help: { label: "Tax settings", url: "https://squareup.com/help/us/en/article/5061-create-and-manage-your-tax-settings" },
        inApp: TAX_STEP,
      },
      {
        key: "square-domain",
        title: "Use your web address",
        detail: "On Square Free, your site uses a square.site address. With Square Plus, buy or connect your own.",
        help: { label: "Connect a domain", url: "https://squareup.com/help/us/en/article/6916-connect-your-domain-with-square-online-store" },
        inApp: ADDRESS,
      },
      {
        key: "square-publish",
        title: "Publish your site",
        detail: "Preview it on your phone, then publish.",
        help: { label: "Publish your site", url: "https://squareup.com/help/us/en/article/6940-how-do-i-un-publish-my-site" },
        inApp: null,
      },
    ],
  },

  wix: {
    id: "wix",
    name: "Wix",
    oneLine: "A do-it-yourself builder with lots of designs. Taking payments starts on its Core plan.",
    bestFor: "a good-looking site for services, or a small store, when design matters to you",
    canSell: true,
    startPlan: {
      name: "Wix Core",
      price: "$29 a month when billed yearly (paid upfront); monthly billing is also offered",
      monthlyUsd: 29,
      adds: "Online payments, your own web address and no Wix ads. Most yearly plans include a free web address for the first year.",
    },
    otherPlans: [
      { name: "Wix Light", price: "$17 a month, billed yearly", monthlyUsd: 17, adds: "Your own web address and no ads, but it can’t take payments." },
      { name: "Wix Business", price: "$39 a month, billed yearly", monthlyUsd: 39, adds: "Automatic sales tax (up to 100 sales a month) and more store features." },
      { name: "Wix Free", price: "$0", monthlyUsd: 0, adds: "To try designs. Shows a Wix ad, uses a Wix address, and can’t take payments." },
    ],
    cardFee: { label: "2.9% + 30¢ per online card payment with Wix Payments (American Express: 3.7% + 30¢)", percent: 0.029, fixedCents: 30 },
    domain: {
      label: "Most yearly plans include a free web address for the first year (new buyers only). Wix’s own pages give different .com renewal prices: $13.35 and $21.35 a year.",
      firstYearUsd: 0,
    },
    includes: [
      "Hosting and a secure (https) site",
      "Lots of designs to start from",
      "Online store and checkout on Core and up",
      "50 GB of storage on Core",
      "A 14-day money-back guarantee on plans",
    ],
    notIncluded: [
      { item: "Your web address after the first year", cost: "About $13–$22 a year for a .com (Wix’s own pages differ)", why: "The free web address is for the first year only.", inApp: ADDRESS },
      { item: "A business email address", cost: "Through Google Workspace, which charges for it", why: "An address like you@yourname.com isn’t part of the site.", inApp: null },
      { item: "Card fees and postage", cost: "2.9% + 30¢ per online sale, plus postage", why: "Taken from each sale; postage is paid per package.", inApp: null },
      { item: "Automatic sales tax", cost: "Needs Wix Business ($39 a month, billed yearly)", why: "On Core, you set up tax rates yourself.", inApp: TAX_STEP },
      { item: "Some apps", cost: "Some charge a monthly fee", why: "Extra features from Wix’s app market can cost more.", inApp: null },
      { item: "Product photos and a logo", cost: "Your own", why: "Your site needs pictures of what you sell and your logo.", inApp: PHOTOS },
    ],
    pros: [
      "A free plan lets you design and try it before paying",
      "Lots of designs, and plenty of control over how it looks",
      "Most yearly plans include a free web address for the first year",
      "Online card fee of 2.9% + 30¢ (more for American Express)",
    ],
    cons: [
      "Taking payments needs Core: $29 a month when you pay for a year upfront",
      "Once you start editing a design, you can’t switch to another one",
      "Automatic sales tax needs the $39 Business plan",
      "The free plan shows a Wix ad and can’t take payments",
    ],
    signupUrl: "https://www.wix.com/plans",
    sources: [
      { label: "Wix plans", url: "https://www.wix.com/plans" },
      { label: "Wix Payments fees", url: "https://support.wix.com/en/article/wix-payments-processing-fees-7668440" },
      { label: "Choosing a Wix plan", url: "https://support.wix.com/en/article/choosing-a-premium-plan" },
    ],
    checkedOn: CHECKED,
    setupSteps: [
      {
        key: "wix-account",
        title: "Create your Wix account and start your site",
        detail: "Sign up, then follow Wix’s step-by-step guide.",
        help: { label: "Wix’s step-by-step guide", url: "https://support.wix.com/en/article/step-by-step-guide-to-creating-your-wix-site-and-online-business" },
        inApp: null,
      },
      {
        key: "wix-design",
        title: "Pick a design and add your pages",
        detail: "Choose carefully: you can’t switch designs after you start editing. Use your logo and brand colors.",
        help: { label: "About Wix designs", url: "https://support.wix.com/en/article/editing-a-wix-template" },
        inApp: BRAND,
      },
      {
        key: "wix-words",
        title: "Paste in your words",
        detail: "Copy each piece of your approved words into the matching page.",
        help: { label: "Add a page", url: "https://support.wix.com/en/article/wix-editor-adding-a-page-to-your-site" },
        inApp: WORDS,
      },
      {
        key: "wix-items",
        title: "Add what you sell, with photos and prices",
        detail: "Add each product to your Wix store.",
        help: { label: "Add a product", url: "https://support.wix.com/en/article/wix-stores-adding-a-physical-product" },
        inApp: PHOTOS,
      },
      {
        key: "wix-payments",
        title: "Choose a plan that takes payments, and set up Wix Payments",
        detail: "Payments need Core or higher. Then create your Wix Payments account.",
        help: { label: "Set up Wix Payments", url: "https://support.wix.com/en/article/creating-a-wix-payments-account" },
        inApp: null,
      },
      {
        key: "wix-fulfillment",
        title: "Set up pickup, delivery or shipping",
        detail: "Choose how customers get their orders, with times and prices.",
        help: { label: "Shipping, delivery and pickup", url: "https://support.wix.com/en/article/wix-stores-about-shipping-delivery-and-pickup" },
        inApp: null,
      },
      {
        key: "wix-tax",
        title: "Set up sales tax",
        detail: "On Core, enter your tax rates yourself. Automatic tax comes with Wix Business.",
        help: { label: "Set up tax yourself", url: "https://support.wix.com/en/article/setting-up-tax-calculation-using-the-manual-method" },
        inApp: TAX_STEP,
      },
      {
        key: "wix-domain",
        title: "Get your web address",
        detail: "Claim your free first-year web address within 60 days of buying a yearly plan, or connect one you own.",
        help: { label: "Buy a domain from Wix", url: "https://support.wix.com/en/article/purchasing-a-domain-from-wix" },
        inApp: ADDRESS,
      },
      {
        key: "wix-publish",
        title: "Publish your site",
        detail: "Preview it on your phone, then publish.",
        help: { label: "Publish your site", url: "https://support.wix.com/en/article/wix-editor-publishing-your-site" },
        inApp: null,
      },
    ],
  },

  shopify: {
    id: "shopify",
    name: "Shopify",
    oneLine: "A full online store from the first plan, with strong shipping and sales tax tools, for a monthly fee.",
    bestFor: "selling mostly online and shipping orders",
    canSell: true,
    startPlan: {
      name: "Shopify Basic",
      price: "$29 a month billed yearly, or $39 billed monthly",
      monthlyUsd: 29,
      adds: "A full store with automatic sales tax, abandoned-checkout emails and discounted shipping labels. New stores can try it for 3 days free, then $1 a month for 3 months.",
    },
    otherPlans: [{ name: "Shopify Grow", price: "$79 a month billed yearly, or $105 monthly", monthlyUsd: 79, adds: "Lower card fees and staff accounts." }],
    cardFee: { label: "2.9% + 30¢ per online card payment with Shopify Payments (premium cards and American Express: 3.5% + 30¢ on Basic)", percent: 0.029, fixedCents: 30 },
    domain: {
      label: "A free yourstore.myshopify.com address. Shopify says its web addresses typically start at $9 a year, depending on the ending (.com may cost more); renewals may cost more.",
      firstYearUsd: 9,
    },
    includes: [
      "Hosting and a secure (https) site",
      "Unlimited products, plus designs to start from",
      "Automatic sales tax calculation",
      "Abandoned-checkout emails, discounts and gift cards",
      "Shipping labels with discounts",
      "Casual in-person selling on every paid plan, with Tap to Pay on iPhone or Android",
    ],
    notIncluded: [
      { item: "Your own web address", cost: "From about $9 a year, depending on the ending", why: "Your store starts on a myshopify.com address.", inApp: ADDRESS },
      { item: "A business email address", cost: "Forwarding is free; a full inbox needs Google Workspace or Microsoft 365", why: "Shopify forwards email but doesn’t host inboxes.", inApp: null },
      { item: "A card reader, if you want one", cost: "Sold separately", why: "Tap to Pay on your phone works for in-person sales; a reader is optional.", inApp: null },
      { item: "Paid designs and apps", cost: "Optional; prices vary", why: "Free designs work, but many add-ons cost extra.", inApp: null },
      { item: "Sales tax registration", cost: "Your time", why: "Shopify works out tax, but registering with your state is up to you.", inApp: TAX_STEP },
      { item: "Product photos and a logo", cost: "Your own", why: "Your store needs pictures of what you sell and your logo.", inApp: PHOTOS },
    ],
    pros: [
      "The cheapest plan is already a full store",
      "Automatic sales tax and discounted shipping labels",
      "3 days free, then $1 a month for 3 months, for new stores",
      "Online card fee of 2.9% + 30¢ (more for premium cards and American Express)",
    ],
    cons: [
      "No free plan for a website",
      "$39 a month if you pay monthly, and your web address, paid designs and apps cost extra",
      "An extra 2% fee per sale if you use another payment company",
      "No staff accounts on Basic, so only you can sign in",
    ],
    signupUrl: "https://www.shopify.com/pricing",
    sources: [
      { label: "Shopify pricing", url: "https://www.shopify.com/pricing" },
      { label: "Shopify domains", url: "https://www.shopify.com/domains" },
    ],
    checkedOn: CHECKED,
    setupSteps: [
      {
        key: "shopify-account",
        title: "Start your Shopify store",
        detail: "Sign up for the free trial, then follow Shopify’s getting-started steps.",
        help: { label: "Getting started", url: "https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/setup-getting-started" },
        inApp: null,
      },
      {
        key: "shopify-design",
        title: "Pick a design",
        detail: "Choose a free design to start, then add your logo and brand colors.",
        help: { label: "Add and preview designs", url: "https://help.shopify.com/en/manual/online-store/themes/adding-themes" },
        inApp: BRAND,
      },
      {
        key: "shopify-words",
        title: "Add your pages and paste in your words",
        detail: "Create your about and contact pages, and copy in your approved words.",
        help: { label: "Create pages", url: "https://help.shopify.com/en/manual/online-store/add-edit-pages" },
        inApp: WORDS,
      },
      {
        key: "shopify-items",
        title: "Add what you sell, with photos and prices",
        detail: "Add each product with photos, a description and a price.",
        help: { label: "Add products", url: "https://help.shopify.com/en/manual/products/add-update-products" },
        inApp: PHOTOS,
      },
      {
        key: "shopify-payments",
        title: "Set up Shopify Payments",
        detail: "Using another payment company adds a 2% fee per sale on Basic.",
        help: { label: "Set up Shopify Payments", url: "https://help.shopify.com/en/manual/payments/shopify-payments/setting-up-shopify-payments" },
        inApp: null,
      },
      {
        key: "shopify-fulfillment",
        title: "Set up shipping, pickup or local delivery",
        detail: "Choose how customers get their orders, and set your shipping rates.",
        help: { label: "Shipping and delivery", url: "https://help.shopify.com/en/manual/fulfillment/setup" },
        inApp: null,
      },
      {
        key: "shopify-tax",
        title: "Check your sales tax settings",
        detail: "Shopify works out the tax, but you register with your state yourself.",
        help: { label: "US taxes", url: "https://help.shopify.com/en/manual/taxes/us" },
        inApp: TAX_STEP,
      },
      {
        key: "shopify-domain",
        title: "Buy or connect your web address",
        detail: "Buy one through Shopify, or connect one you already own.",
        help: { label: "Add a domain", url: "https://help.shopify.com/en/manual/domains/add-a-domain" },
        inApp: ADDRESS,
      },
      {
        key: "shopify-publish",
        title: "Launch your store",
        detail: "Remove the password page so customers can visit.",
        help: { label: "Launch your store", url: "https://help.shopify.com/en/manual/online-store/themes/password-page" },
        inApp: null,
      },
    ],
  },
};
