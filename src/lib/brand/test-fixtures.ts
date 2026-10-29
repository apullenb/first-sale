import type { BrandBrief, ConceptReply } from "./types";

// Shared test data for the brand tests

export function testBrief(overrides: Partial<BrandBrief> = {}): BrandBrief {
  return {
    name: "Rise Bakery",
    tagline: "",
    sells: "Sourdough bread and pastries",
    customers: "Neighbors and shoppers at the Saturday market",
    vibes: ["farmhouse", "Southern porch", "cozy"],
    leanings: { era: "old", tone: "playful", energy: null, finish: "handmade" },
    colors: ["forest greens", "cream and neutrals"],
    likedColors: "",
    avoidColors: "pink",
    symbolIdea: "a wheat stalk",
    avoid: "cupcakes",
    logoKinds: [],
    logoLikes: "",
    story: "Rise Bakery is a porch swing on an old wooden back porch. A customer could expect the owner to come out with sweet tea while they shop.",
    storyByOwner: false,
    storyApproved: true,
    ...overrides,
  };
}

export function testConcept(overrides: Partial<ConceptReply> = {}): ConceptReply {
  return {
    kind: "illustrative",
    title: "Morning Rise",
    idea: "A wheat stalk whose grains rise like a sunrise over a loaf.",
    symbol: "a wheat stalk curving over a half-circle sun",
    typography: "warm rounded serif, lowercase",
    palette: [
      { hex: "#1F3A2E", name: "Forest" },
      { hex: "#E9DCC4", name: "Cream" },
    ],
    rationale: "It says fresh, early and baked by hand.",
    ...overrides,
  };
}
