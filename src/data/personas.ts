import type { BusinessProfile } from "@/lib/domain";

export interface DemoProduct {
  id: string;
  name: string;
  materials: string;
  priceCents: number;
  unitCostCents: number;
  quantity: number;
}

export interface DemoBusiness {
  id: string;
  path: string;
  profile: BusinessProfile;
  products: DemoProduct[];
}

// Three demo paths: home food, multi-owner crafts, retail storefront.
// Locations stay empty until the demo states are chosen; all figures are placeholders.
export const DEMO_BUSINESSES: DemoBusiness[] = [
  {
    id: "demo-bakery",
    path: "Home food business",
    profile: {
      name: "Home bakery",
      description: "Cakes, cookies, and bread baked at home, sold to neighbors and at weekend markets.",
      location: { state: null, county: null, city: null },
      owners: { count: 1, notes: "" },
      offerings: [
        { name: "Custom cakes", kind: "product", notes: "Made to order" },
        { name: "Cookies and bread", kind: "product", notes: "Weekly batches" },
      ],
      channels: ["in_person", "markets", "social_media"],
      premises: "home",
      startupBudgetUsd: 1500,
      hiringPlans: "Maybe a part-time helper for weekend markets.",
    },
    products: [
      { id: "lemon-loaf", name: "Lemon loaf", materials: "Flour, butter, sugar, eggs, lemons", priceCents: 1400, unitCostCents: 450, quantity: 12 },
      { id: "sourdough", name: "Sourdough boule", materials: "Flour, water, salt, starter", priceCents: 1000, unitCostCents: 250, quantity: 8 },
    ],
  },
  {
    id: "demo-woodworking",
    path: "Family craft business with two owners",
    profile: {
      name: "Family woodworking shop",
      description: "Handmade cutting boards, serving trays, and bowls from a home workshop.",
      location: { state: null, county: null, city: null },
      owners: { count: 2, notes: "Two brothers, equal partners" },
      offerings: [
        { name: "Cutting boards", kind: "product", notes: "" },
        { name: "Serving trays and bowls", kind: "product", notes: "" },
      ],
      channels: ["marketplace", "markets", "own_website"],
      premises: "home",
      startupBudgetUsd: 3000,
      hiringPlans: "None yet.",
    },
    products: [
      { id: "walnut-board", name: "Walnut cutting board", materials: "Black walnut, mineral oil finish", priceCents: 8500, unitCostCents: 3000, quantity: 6 },
      { id: "maple-tray", name: "Maple serving tray", materials: "Hard maple, beeswax finish", priceCents: 6000, unitCostCents: 2000, quantity: 4 },
    ],
  },
  {
    id: "demo-boutique",
    path: "Retail storefront",
    profile: {
      name: "Clothing boutique",
      description: "A small shop selling curated clothing and accessories bought from wholesalers.",
      location: { state: null, county: null, city: null },
      owners: { count: 1, notes: "" },
      offerings: [
        { name: "Clothing", kind: "product", notes: "Bought wholesale for resale" },
        { name: "Accessories", kind: "product", notes: "" },
      ],
      channels: ["storefront", "social_media", "own_website"],
      premises: "rented_space",
      startupBudgetUsd: 25000,
      hiringPlans: "One part-time sales associate within the first year.",
    },
    products: [
      { id: "linen-dress", name: "Linen wrap dress", materials: "100% linen", priceCents: 7800, unitCostCents: 3400, quantity: 10 },
      { id: "canvas-tote", name: "Canvas tote", materials: "Cotton canvas", priceCents: 3200, unitCostCents: 1100, quantity: 20 },
    ],
  },
];
