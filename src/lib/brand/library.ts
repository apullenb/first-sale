// The Brand Library's groups, and what an owner may add to it

export const LIBRARY_GROUPS = ["logos", "brand_images", "product_photos", "other"] as const;
export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];

export const LIBRARY_GROUP_TEXT: Record<LibraryGroup, { title: string; help: string }> = {
  logos: { title: "Logos", help: "Your chosen or uploaded logo and its versions." },
  brand_images: { title: "Brand images", help: "Your website header, social covers and link preview, made from your logo in your brand’s style, and brand pictures you added." },
  product_photos: { title: "Product photos", help: "Your product photos and the edits you approved." },
  other: { title: "Other pictures", help: "Your own pictures, such as your storefront, your team or behind the scenes." },
};

// Where brand images are made and kept
export const BRAND_IMAGES_HREF = "/brand-library#group-brand_images";

export const libraryFileUrl = (fileId: string, view = true) => `/brand-library/files/${fileId}${view ? "?view=1" : ""}`;

// Shorter sides than this are too small to be useful anywhere
export const MIN_LIBRARY_SIDE = 32;
// A logo this small can't be redrawn into versions well
export const MIN_LOGO_SIDE = 100;
export const SMALL_LOGO_SIDE = 500;
// Larger than any camera or design export; guards the browser and the database
export const MAX_PICTURE_SIDE = 12_000;
// Total pixels: logos are decoded whole to make the kit, and phones refuse canvases much past 16 million
export const MAX_LOGO_PIXELS = 16_000_000;
export const MAX_PICTURE_PIXELS = 50_000_000;
export const MAX_LOGO_WORDS = 120;
export const MAX_PICTURE_NAME = 80;
