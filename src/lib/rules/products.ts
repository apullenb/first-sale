import { z } from "zod";
import { dollars, parseDollars } from "@/lib/website/site/design";

// Plain rules for the owner's product list: what a product needs, and money only as the owner typed it

export const PRODUCT_LIMITS = { products: 100, name: 80, description: 300, quantity: 1_000_000 } as const;

// Which picture a product shows: a product photo's original, an approved edit, or a Brand Library picture
export const productPhotoRefSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("original"), photoId: z.string().min(1).max(60) }),
  z.object({ source: z.literal("version"), photoId: z.string().min(1).max(60), versionId: z.string().min(1).max(60) }),
  z.object({ source: z.literal("library"), fileId: z.string().min(1).max(60) }),
]);
export type ProductPhotoRef = z.infer<typeof productPhotoRefSchema>;

export interface ProductValues {
  name: string;
  description: string;
  priceCents: number;
  unitCostCents: number | null;
  quantity: number | null;
  photo: ProductPhotoRef | null;
}

// What the form sends: text as typed
export interface ProductForm {
  name: string;
  description: string;
  price: string;
  unitCost: string;
  quantity: string;
  photo: ProductPhotoRef | null;
}

export type ProductCheck = { ok: true; value: ProductValues } | { ok: false; field: keyof ProductForm; message: string };

const tidy = (text: string, max: number) =>
  text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export function checkProduct(form: ProductForm): ProductCheck {
  const name = tidy(form.name, PRODUCT_LIMITS.name);
  if (!name) return { ok: false, field: "name", message: "Give the product a name." };
  const priceCents = parseDollars(form.price);
  if (priceCents === null) return { ok: false, field: "price", message: "Type the price as dollars and cents, such as 12 or 12.50." };
  let unitCostCents: number | null = null;
  if (form.unitCost.trim()) {
    unitCostCents = parseDollars(form.unitCost);
    if (unitCostCents === null) return { ok: false, field: "unitCost", message: "Type what one costs you as dollars and cents, or leave it empty." };
  }
  let quantity: number | null = null;
  if (form.quantity.trim()) {
    const text = form.quantity.trim().replace(/,/g, "");
    if (!/^\d{1,7}$/.test(text) || Number(text) > PRODUCT_LIMITS.quantity) return { ok: false, field: "quantity", message: "Type how many you have as a whole number, or leave it empty." };
    quantity = Number(text);
  }
  return { ok: true, value: { name, description: tidy(form.description, PRODUCT_LIMITS.description), priceCents, unitCostCents, quantity, photo: form.photo } };
}

// What's left from each sale before the owner's time and other costs; null without a unit cost
export function marginOf(priceCents: number, unitCostCents: number | null): { cents: number; percent: number | null } | null {
  if (unitCostCents === null) return null;
  const cents = priceCents - unitCostCents;
  return { cents, percent: priceCents > 0 ? Math.round((cents / priceCents) * 100) : null };
}

// Back into the form's text, so editing shows what was saved
export function formOf(product: ProductValues): ProductForm {
  const money = (cents: number) => (cents / 100).toFixed(cents % 100 ? 2 : 0);
  return {
    name: product.name,
    description: product.description,
    price: money(product.priceCents),
    unitCost: product.unitCostCents === null ? "" : money(product.unitCostCents),
    quantity: product.quantity === null ? "" : String(product.quantity),
    photo: product.photo,
  };
}

export { dollars };
