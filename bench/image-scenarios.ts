import type { BrandBrief } from "@/lib/brand/types";
import type { PhotoCategory, PhotoCrop, PhotoLook } from "@/lib/photos/types";

// Businesses for the image-quality run: each goes through every kind of picture the app makes

export interface ImageScenario {
  id: string;
  label: string;
  // Story and approval are filled in by the run, as the owner would
  brief: Omit<BrandBrief, "story" | "storyByOwner" | "storyApproved">;
  // Typed by the owner under the chosen logo
  logoChange: string;
  // Typed by the owner under one brand image
  imageEdit: { kind: "website_hero" | "facebook_cover" | "youtube_banner" | "link_preview"; change: string };
  photo: {
    // Live: the test photo drawn by the image model from this prompt
    prompt: string;
    // Practice mode: a jar drawn in code with this label
    label: string;
    jarColor: string;
    // Used when no model can see the photo, as the owner would pick
    category: PhotoCategory;
    forSale: string[];
    // For the check's question, if it asks one
    answer: string;
    look: PhotoLook;
    crop: PhotoCrop;
  };
}

const PHONE_PHOTO = "A realistic, slightly imperfect phone photo taken by a small business owner, natural window light, a little cluttered background, no text overlays.";

export const IMAGE_SCENARIOS: ImageScenario[] = [
  {
    id: "dog-grooming",
    label: "Mobile dog-grooming van, Columbus, Ohio (service)",
    brief: {
      name: "Wagging Wheels Grooming",
      tagline: "",
      sells: "Mobile dog grooming from a van that parks in your driveway: baths, haircuts and nail trims, around Columbus, Ohio.",
      customers: "Busy dog owners in Columbus neighborhoods, and older dogs who get nervous at a salon",
      vibes: ["cheerful", "playful", "wholesome", "bright and colorful"],
      leanings: { era: "modern", tone: "playful", energy: null, finish: "polished" },
      colors: ["cool blues", "sunny yellows"],
      likedColors: "",
      avoidColors: "",
      symbolIdea: "a small van with a happy dog looking out the window",
      avoid: "",
      logoKinds: [],
      logoLikes: "",
    },
    logoChange: "Make the lettering bolder",
    imageEdit: { kind: "facebook_cover", change: "Make it brighter, with more blue sky" },
    photo: {
      prompt: `A bottle of oatmeal dog shampoo with a plain label on a grooming table inside a van. ${PHONE_PHOTO}`,
      label: "SHAMPOO",
      jarColor: "#457B9D",
      category: "other",
      forSale: ["dog shampoo bottle"],
      answer: "The shampoo bottle is what we sell.",
      look: "studio",
      crop: "square",
    },
  },
  {
    id: "soy-candles",
    label: "Handmade soy candles, Denver, Colorado (products, two owners)",
    brief: {
      name: "Two Pines Candle Co.",
      tagline: "",
      sells: "Hand-poured soy candles in amber glass jars, with scents inspired by the Colorado mountains, made by two friends in Denver.",
      customers: "Gift shoppers and people who love a cozy home",
      vibes: ["cozy", "calm", "natural and organic", "minimal"],
      leanings: { era: null, tone: null, energy: "quiet", finish: "handmade" },
      colors: ["cream and neutrals", "sage and olive"],
      likedColors: "",
      avoidColors: "",
      symbolIdea: "two pine trees side by side, like candle flames",
      avoid: "",
      logoKinds: [],
      logoLikes: "",
    },
    logoChange: "Make the lettering bolder",
    imageEdit: { kind: "website_hero", change: "Make it warmer, like early evening light" },
    photo: {
      prompt: `A hand-poured soy candle in an amber glass jar with a small kraft paper label, sitting on a wooden kitchen counter. ${PHONE_PHOTO}`,
      label: "TWO PINES",
      jarColor: "#B8732E",
      category: "handmade",
      forSale: ["candle"],
      answer: "One candle in an amber jar.",
      look: "lifestyle",
      crop: "portrait",
    },
  },
  {
    id: "taco-truck",
    label: "Taco food truck, Phoenix, Arizona",
    brief: {
      name: "Sol y Salsa Tacos",
      tagline: "",
      sells: "Street tacos (carne asada, al pastor and grilled veggie) and house salsas from a food truck around Phoenix, Arizona.",
      customers: "Lunch crowds near offices and late-night eaters downtown",
      vibes: ["bold", "playful", "desert", "bright and colorful"],
      leanings: { era: null, tone: "playful", energy: "loud", finish: null },
      colors: ["warm reds and oranges", "sunny yellows"],
      likedColors: "",
      avoidColors: "",
      symbolIdea: "a desert sun over a taco",
      avoid: "",
      logoKinds: [],
      logoLikes: "",
    },
    logoChange: "Make the lettering bolder",
    imageEdit: { kind: "facebook_cover", change: "Make the colors warmer, like a desert sunset" },
    photo: {
      prompt: `Three street tacos with cilantro and onion on a paper plate on a metal food-truck counter, a lime wedge on the side. ${PHONE_PHOTO}`,
      label: "SALSA",
      jarColor: "#B23A2E",
      category: "food",
      forSale: ["tacos"],
      answer: "The three tacos on the plate.",
      look: "studio",
      crop: "landscape",
    },
  },
];
