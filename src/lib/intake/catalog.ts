import type { BusinessCategory, OFFERING_KINDS } from "@/lib/domain";

// Business kinds and clickable examples for intake. Example flags only pre-select answers the owner confirms.

type OfferingKind = (typeof OFFERING_KINDS)[number];
export type ExampleFlag = "cold" | "kids" | "food_contact" | "secondhand";

export interface CategoryExample {
  id: string;
  label: string;
  flags?: readonly ExampleFlag[];
}

export interface Category {
  id: BusinessCategory;
  label: string;
  group: CategoryGroup;
  // A few words of examples under the label
  hint: string;
  kind: OfferingKind | null;
  icon: CategoryIcon;
  examples: readonly CategoryExample[];
}

export const CATEGORY_GROUPS = ["Food", "Things you make", "A shop", "Services"] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number] | "Other";
export type CategoryIcon = "cake" | "jar" | "pot" | "saw" | "brush" | "shirt" | "bag" | "scissors" | "home" | "book" | "camera" | "spark";

export const CATEGORIES: readonly Category[] = [
  {
    id: "baked_goods",
    label: "Baked goods and sweets",
    group: "Food",
    hint: "Cookies, bread, cakes, candy",
    kind: "food",
    icon: "cake",
    examples: [
      { id: "cookies", label: "Cookies" },
      { id: "breads", label: "Bread and rolls" },
      { id: "cakes", label: "Cakes and cupcakes" },
      { id: "pies", label: "Fruit pies" },
      { id: "brownies", label: "Brownies and bars" },
      { id: "candy", label: "Candy and fudge" },
      { id: "cheesecake", label: "Cheesecake", flags: ["cold"] },
      { id: "cream_pies", label: "Cream or custard pies", flags: ["cold"] },
      { id: "decorated", label: "Custom decorated orders" },
    ],
  },
  {
    id: "packaged_food",
    label: "Jams, sauces and snacks",
    group: "Food",
    hint: "Jam, salsa, granola, honey",
    kind: "food",
    icon: "jar",
    examples: [
      { id: "jam", label: "Jams and jellies" },
      { id: "salsa", label: "Salsa and hot sauce" },
      { id: "pickles", label: "Pickles and canned vegetables" },
      { id: "granola", label: "Granola and snack mixes" },
      { id: "dry_mixes", label: "Spice blends and dry mixes" },
      { id: "honey", label: "Honey" },
      { id: "dog_treats", label: "Pet treats" },
    ],
  },
  {
    id: "prepared_food",
    label: "Meals and catering",
    group: "Food",
    hint: "Plates, catering, food truck",
    kind: "food",
    icon: "pot",
    examples: [
      { id: "meals", label: "Ready-to-eat meals", flags: ["cold"] },
      { id: "catering", label: "Catering for events", flags: ["cold"] },
      { id: "tamales", label: "Tamales, empanadas and similar", flags: ["cold"] },
      { id: "food_truck", label: "Food truck or cart" },
      { id: "drinks", label: "Coffee, juice or other drinks" },
    ],
  },
  {
    id: "woodworking",
    label: "Woodwork",
    group: "Things you make",
    hint: "Cutting boards, bowls, furniture",
    kind: "handmade",
    icon: "saw",
    examples: [
      { id: "cutting_boards", label: "Cutting boards", flags: ["food_contact"] },
      { id: "bowls_utensils", label: "Bowls, spoons and utensils", flags: ["food_contact"] },
      { id: "home_decor", label: "Home decor and signs" },
      { id: "shelves_storage", label: "Shelves and storage" },
      { id: "furniture", label: "Furniture" },
      { id: "toys", label: "Toys or baby items", flags: ["kids"] },
      { id: "custom_orders", label: "Custom orders" },
    ],
  },
  {
    id: "crafts",
    label: "Crafts and art",
    group: "Things you make",
    hint: "Candles, pottery, jewelry, prints",
    kind: "handmade",
    icon: "brush",
    examples: [
      { id: "candles", label: "Candles" },
      { id: "pottery", label: "Pottery and mugs", flags: ["food_contact"] },
      { id: "jewelry", label: "Jewelry" },
      { id: "art_prints", label: "Paintings and prints" },
      { id: "sewn_knit", label: "Sewn or knitted goods" },
      { id: "soap_lotion", label: "Soap, lotion or body care" },
      { id: "baby_items", label: "Baby and kids’ items", flags: ["kids"] },
    ],
  },
  {
    id: "clothing_boutique",
    label: "Clothing boutique",
    group: "A shop",
    hint: "Clothes, shoes, accessories",
    kind: "resale",
    icon: "shirt",
    examples: [
      { id: "womens", label: "Women’s clothing" },
      { id: "mens", label: "Men’s clothing" },
      { id: "kids_clothing", label: "Kids’ clothing", flags: ["kids"] },
      { id: "accessories", label: "Bags and accessories" },
      { id: "shoes", label: "Shoes" },
      { id: "jewelry_resale", label: "Jewelry" },
      { id: "vintage", label: "Vintage or secondhand clothing", flags: ["secondhand"] },
    ],
  },
  {
    id: "resale_shop",
    label: "Another kind of shop",
    group: "A shop",
    hint: "Gifts, home goods, vintage",
    kind: "resale",
    icon: "bag",
    examples: [
      { id: "gifts", label: "Gifts" },
      { id: "home_goods", label: "Home goods" },
      { id: "books", label: "Books" },
      { id: "antiques", label: "Antiques and vintage", flags: ["secondhand"] },
      { id: "beauty_products", label: "Beauty products" },
      { id: "toys_resale", label: "Toys and games", flags: ["kids"] },
    ],
  },
  {
    id: "personal_care",
    label: "Beauty and personal care",
    group: "Services",
    hint: "Hair, nails, lashes, massage",
    kind: "services",
    icon: "scissors",
    examples: [
      { id: "hair", label: "Hair" },
      { id: "nails", label: "Nails" },
      { id: "lashes_brows", label: "Lashes and brows" },
      { id: "makeup", label: "Makeup" },
      { id: "massage", label: "Massage" },
    ],
  },
  {
    id: "home_services",
    label: "Home and pet services",
    group: "Services",
    hint: "Cleaning, repairs, lawn, pets",
    kind: "services",
    icon: "home",
    examples: [
      { id: "cleaning", label: "Cleaning" },
      { id: "handyman", label: "Repairs and handyman work" },
      { id: "lawn", label: "Lawn and garden" },
      { id: "pet_care", label: "Pet sitting or walking" },
      { id: "moving", label: "Moving and hauling" },
    ],
  },
  {
    id: "lessons_care",
    label: "Lessons and care",
    group: "Services",
    hint: "Tutoring, music, fitness, childcare",
    kind: "services",
    icon: "book",
    examples: [
      { id: "tutoring", label: "Tutoring" },
      { id: "music", label: "Music lessons" },
      { id: "fitness", label: "Fitness training" },
      { id: "childcare", label: "Childcare", flags: ["kids"] },
      { id: "classes", label: "Craft or cooking classes" },
    ],
  },
  {
    id: "creative_services",
    label: "Creative and office services",
    group: "Services",
    hint: "Photos, design, bookkeeping",
    kind: "services",
    icon: "camera",
    examples: [
      { id: "photography", label: "Photography" },
      { id: "design", label: "Graphic or web design" },
      { id: "writing", label: "Writing and editing" },
      { id: "bookkeeping", label: "Bookkeeping" },
      { id: "events", label: "Event planning" },
    ],
  },
  {
    id: "other",
    label: "Something else",
    group: "Other",
    hint: "Tell us in a few words",
    kind: null,
    icon: "spark",
    examples: [],
  },
];

export function categoryFor(id: BusinessCategory | "" | null): Category | null {
  return CATEGORIES.find((category) => category.id === id) ?? null;
}

export function examplesFor(id: BusinessCategory | "" | null, tags: readonly string[]): CategoryExample[] {
  const examples = categoryFor(id)?.examples ?? [];
  return examples.filter((example) => tags.includes(example.id));
}

// True when any picked example carries the flag
export function hasFlag(id: BusinessCategory | "" | null, tags: readonly string[], flag: ExampleFlag): boolean {
  return examplesFor(id, tags).some((example) => example.flags?.includes(flag));
}

// Owner-facing list of what they picked, for "what you'll sell first"
export function examplesText(id: BusinessCategory | "" | null, tags: readonly string[]): string {
  return examplesFor(id, tags)
    .map((example) => example.label)
    .join(", ");
}
