// Three demo owners, typed into the app by the tests. US only; nothing here is seeded.

export interface Scenario {
  key: "groomer" | "candles" | "tacos";
  ownerName: string;
  businessName: string;
  kind: string;
  sells: string[];
  specialty?: string;
  place: { state: string; county: string; city: string };
  // Extra owners besides the person signing up (0 for a sole owner)
  otherOwners: number;
  // Intake question title (or its start) -> the options to pick
  answers: Record<string, string[]>;
  launchDate: string | null;
  // Business details saved on /business
  details: { ownerNames: string; email: string; phone: string; purpose: string };
  brand: { words: string[]; colors: string[] };
  products: { name: string; description: string; price: string; cost?: string; stock?: string }[];
  social: string[];
}

export const groomer: Scenario = {
  key: "groomer",
  ownerName: "Dana Whitfield",
  businessName: "Sudsy Paws Mobile Grooming",
  kind: "Home and pet services",
  sells: ["Pet sitting or walking"],
  specialty: "Mobile dog grooming from a van",
  place: { state: "Ohio", county: "Franklin", city: "Columbus" },
  otherOwners: 0,
  answers: {
    "Where are you now?": ["Just an idea so far"],
    "Is your address inside the city limits": ["Yes"],
    "Might someone join as a co-owner later?": ["No"],
    "Is “Sudsy Paws Mobile Grooming” just your own legal name": ["No"],
    "How will you sell?": ["In person", "Social media"],
    "Will you ship orders?": ["No"],
    "Does your kind of work usually need a personal license": ["No"],
    "Where will you do the work?": ["At customers’ places or online"],
    "Will customers come to your home": ["No"],
    "About how much can you spend getting started?": ["$5,000–$25,000"],
    "About how much do you hope to sell in your first year?": ["$25,000–$100,000"],
    "Will the business sign a lease, take out a loan, or buy on credit?": ["Yes"],
    "Will anyone work for you": ["Not for now"],
    "Have you run a business before?": ["No, this is my first"],
    "What are your current goals for your business?": ["Make it my full-time work"],
  },
  launchDate: "2027-04-01",
  details: {
    ownerNames: "Dana Whitfield",
    email: "hello@sudsypaws.example",
    phone: "614-555-0142",
    purpose: "Mobile dog grooming at the customer's home",
  },
  brand: { words: ["cheerful", "playful", "warm"], colors: ["cool blues"] },
  products: [
    { name: "Full groom", description: "Bath, haircut, nails and ears", price: "85", cost: "12" },
    { name: "Bath and brush", description: "Bath, blow-dry and brush-out", price: "55" },
  ],
  social: ["Facebook", "Instagram"],
};

export const candles: Scenario = {
  key: "candles",
  ownerName: "Maya Okafor",
  businessName: "Ember & Oak Candle Co",
  kind: "Crafts and art",
  sells: ["Candles"],
  specialty: "Hand-poured soy candles",
  place: { state: "Colorado", county: "Denver", city: "Denver" },
  otherOwners: 1,
  answers: {
    "Where are you now?": ["Already selling a little"],
    "Which of these do you already have?": ["A sales tax permit"],
    "Is your address inside the city limits": ["Yes"],
    "Who are the other owners?": ["Friends or business partners"],
    "Is “Ember & Oak Candle Co” just your own legal name": ["No"],
    "How will you sell?": ["Markets and events", "Your own website", "Social media"],
    "How will customers get what they buy?": ["I ship to other states"],
    "Will you ship orders?": ["Yes"],
    "Will any items be made mainly for children 12 and under?": ["No"],
    "Will any items touch food": ["No"],
    "Where will you make things and keep your stock?": ["At home"],
    "Will customers come to your home": ["No"],
    "About how much can you spend getting started?": ["$1,000–$5,000"],
    "About how much do you hope to sell in your first year?": ["$5,000–$25,000"],
    "Will the business sign a lease, take out a loan, or buy on credit?": ["No"],
    "Will anyone work for you": ["Not for now"],
    "Have you run a business before?": ["A little, like a side business"],
    "What are your current goals for your business?": ["Extra income on the side", "Grow it bigger, with a team or a shop"],
  },
  launchDate: "2027-02-14",
  details: {
    ownerNames: "Maya Okafor, Theo Lindqvist",
    email: "hello@emberandoak.example",
    phone: "303-555-0188",
    purpose: "Handmade soy candles sold online and at markets",
  },
  brand: { words: ["cozy", "earthy", "natural and organic", "rustic"], colors: ["earthy browns", "cream and neutrals"] },
  products: [
    { name: "Cedar & Smoke candle", description: "8 oz hand-poured soy candle", price: "24", cost: "7.50", stock: "40" },
    { name: "Wildflower tin", description: "4 oz travel tin", price: "12", cost: "3.25", stock: "60" },
  ],
  social: ["Instagram"],
};

export const tacos: Scenario = {
  key: "tacos",
  ownerName: "Luis Carrillo",
  businessName: "Sonoran Sol Tacos",
  kind: "Meals and catering",
  sells: ["Food truck or cart"],
  specialty: "Street tacos and aguas frescas",
  place: { state: "Arizona", county: "Maricopa", city: "Phoenix" },
  otherOwners: 0,
  answers: {
    "Where are you now?": ["Just an idea so far"],
    "Is your address inside the city limits": ["Not sure"],
    "Might someone join as a co-owner later?": ["Not sure"],
    "Is “Sonoran Sol Tacos” just your own legal name": ["No"],
    "How will you sell?": ["In person", "Markets and events"],
    "How will customers get what they buy?": ["Not sure yet"],
    "Will you ship orders?": ["No"],
    "Does any of it need to be kept cold": ["Not sure"],
    "Where will you make your food?": ["Not sure yet"],
    "Will customers come to your home": ["Not sure"],
    "About how much can you spend getting started?": ["Not sure yet"],
    "About how much do you hope to sell in your first year?": ["Not sure yet"],
    "Will the business sign a lease, take out a loan, or buy on credit?": ["Not sure"],
    "Will anyone work for you": ["Within the first year"],
    "What kind of help?": ["Not sure yet"],
    "Have you run a business before?": ["No, this is my first"],
    "What are your current goals for your business?": ["I just want to test my idea with little risk for now"],
  },
  launchDate: null,
  details: {
    ownerNames: "Luis Carrillo",
    email: "hola@sonoransol.example",
    phone: "602-555-0119",
    purpose: "Street tacos served from a food truck",
  },
  brand: { words: ["bold", "desert", "bright and colorful"], colors: ["warm reds and oranges", "sunny yellows"] },
  products: [{ name: "Carne asada taco", description: "Corn tortilla, salsa verde", price: "4.50" }],
  social: ["Instagram", "TikTok"],
};

export const SCENARIOS = [groomer, candles, tacos] as const;
