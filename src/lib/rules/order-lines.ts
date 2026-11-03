import { z } from "zod";
import { parseDollars } from "@/lib/website/site/design";
import { findVariant } from "./inventory";
import { type ItemOptions, variantLabel } from "./products";

// Order lines: saved items (priced and counted by inventory.ts) or custom lines the owner prices

export const LINE_LIMITS = { lines: 30, description: 160, quantity: 1_000_000 } as const;
// Largest order total, line total or payment: $1,000,000
export const MAX_LINE_CENTS = 100_000_000;

export const lineInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("item"),
    productId: z.string().min(1).max(60),
    values: z.array(z.string().max(100)).max(5),
    quantity: z.number().int("Type how many as a whole number.").min(1, "Type how many as a whole number.").max(LINE_LIMITS.quantity),
  }),
  z.object({
    kind: z.literal("custom"),
    description: z.string().trim().min(1, "Describe each custom line.").max(LINE_LIMITS.description),
    quantity: z.number().int("Type how many as a whole number.").min(1, "Type how many as a whole number.").max(LINE_LIMITS.quantity),
    unitPriceCents: z.number().int().min(0).max(MAX_LINE_CENTS).nullable(),
  }),
]);
export type LineInput = z.infer<typeof lineInputSchema>;
export type ItemLineInput = Extract<LineInput, { kind: "item" }>;
export type CustomLineInput = Extract<LineInput, { kind: "custom" }>;

export interface PricedItem {
  id: string;
  name: string;
  priceCents: number | null;
  options: ItemOptions;
}

// The option's own price, else the item's; same rule placeOrder uses
export function itemUnitPrice(item: PricedItem, values: readonly string[]): number | null {
  if (!item.options.variants.length) return item.priceCents;
  const variant = findVariant(item.options, values);
  return variant ? (variant.priceCents ?? item.priceCents) : null;
}

export function lineTotalCents(quantity: number, unitPriceCents: number | null): number | null {
  return unitPriceCents === null ? null : quantity * unitPriceCents;
}

export interface PricedLine {
  quantity: number;
  unitPriceCents: number | null;
}

// Subtotal of priced lines; total only when every line has a price
export function linesTotals(lines: readonly PricedLine[]) {
  const subtotalCents = lines.reduce((sum, line) => sum + (lineTotalCents(line.quantity, line.unitPriceCents) ?? 0), 0);
  const unpriced = lines.filter((line) => line.unitPriceCents === null).length;
  return { subtotalCents, unpriced, totalCents: lines.length && !unpriced ? subtotalCents : null };
}

// A line being typed in a form: text as typed
export type DraftLine =
  | { key: string; kind: "item"; productId: string; values: string[]; quantity: string }
  | { key: string; kind: "custom"; description: string; quantity: string; price: string };

export interface CheckedDraft {
  lines: LineInput[];
  rows: { key: string; unitPriceCents: number | null; totalCents: number | null; error: string | null }[];
  subtotalCents: number;
  totalCents: number | null;
  unpriced: number;
  error: string | null;
}

const wholeQuantity = (text: string) => (/^\d{1,7}$/.test(text.trim()) && Number(text) >= 1 && Number(text) <= LINE_LIMITS.quantity ? Number(text) : null);

// Live totals for the order form, and the lines to send once nothing is wrong
export function checkDraft(draft: readonly DraftLine[], items: readonly PricedItem[]): CheckedDraft {
  const lines: LineInput[] = [];
  const rows: CheckedDraft["rows"] = [];
  for (const row of draft) {
    const quantity = wholeQuantity(row.quantity);
    let unitPriceCents: number | null = null;
    let error: string | null = quantity === null ? "Type how many as a whole number." : null;
    if (row.kind === "item") {
      const item = items.find((entry) => entry.id === row.productId);
      if (!item) error = "That item isn’t in your products any more.";
      else if (item.options.variants.length && !findVariant(item.options, row.values)) error ??= "Choose an option.";
      else unitPriceCents = itemUnitPrice(item, row.values);
      if (!error && quantity !== null) lines.push({ kind: "item", productId: row.productId, values: row.values, quantity });
    } else {
      const description = row.description.trim();
      if (!description) error ??= "Describe this line.";
      if (row.price.trim()) {
        unitPriceCents = parseDollars(row.price, MAX_LINE_CENTS);
        if (unitPriceCents === null) error ??= "Type the price as dollars and cents, or leave it empty.";
      }
      if (!error && quantity !== null)
        lines.push({ kind: "custom", description: description.slice(0, LINE_LIMITS.description), quantity, unitPriceCents });
    }
    const totalCents = quantity === null ? null : lineTotalCents(quantity, unitPriceCents);
    if (totalCents !== null && totalCents > MAX_LINE_CENTS) error ??= "That line is over $1,000,000. Split it up.";
    rows.push({ key: row.key, unitPriceCents, totalCents, error });
  }
  const totals = linesTotals(rows.map((row, index) => ({ quantity: wholeQuantity(draft[index].quantity) ?? 0, unitPriceCents: row.unitPriceCents })));
  const firstError = rows.find((row) => row.error)?.error ?? null;
  const error = !draft.length
    ? "Add at least one item or custom line."
    : firstError ?? (totals.subtotalCents > MAX_LINE_CENTS ? "This order is over $1,000,000. Split it up." : null);
  return { lines, rows, ...totals, error };
}

// "2 dozen", "1 (serves about 20)", "150": a whole count and what's left of the wording
export function splitQuantity(text: string): { quantity: number; rest: string } | null {
  const match = /^\s*(\d{1,7})\b\s*(.*)$/.exec(text);
  if (!match) return null;
  const quantity = Number(match[1]);
  return quantity >= 1 && quantity <= LINE_LIMITS.quantity ? { quantity, rest: match[2].trim() } : null;
}

// A custom line from a customer's wording; null when no whole count is given
export function customLineFrom(name: string, quantityText: string): CustomLineInput | null {
  const split = splitQuantity(quantityText);
  const base = name.trim();
  if (!split || !base) return null;
  const description = split.rest ? `${base} (${split.rest.replace(/^\((.*)\)$/, "$1")})` : base;
  return { kind: "custom", description: description.slice(0, LINE_LIMITS.description), quantity: split.quantity, unitPriceCents: null };
}

// Saved lines back into form rows
export function draftOf(
  lines: readonly { productId: string | null; name: string; values: string[]; quantity: number; unitPriceCents: number | null }[],
  prefix = "saved",
): DraftLine[] {
  return lines.map((line, index) =>
    line.productId
      ? { key: `${prefix}-${index}`, kind: "item", productId: line.productId, values: line.values, quantity: String(line.quantity) }
      : {
          key: `${prefix}-${index}`,
          kind: "custom",
          description: line.name,
          quantity: String(line.quantity),
          price: line.unitPriceCents === null ? "" : (line.unitPriceCents / 100).toFixed(2),
        },
  );
}

// Imported items: a saved item only on an exact name match without options, else a custom line to price
export function importedDraft(
  imported: readonly { name: string; quantity: number }[],
  items: readonly (PricedItem & { kind?: string })[],
): DraftLine[] {
  return imported.map((line, index) => {
    const matches = items.filter((item) => item.name.trim().toLowerCase() === line.name.trim().toLowerCase() && !item.options.variants.length);
    return matches.length === 1
      ? { key: `imported-${index}`, kind: "item", productId: matches[0].id, values: [], quantity: String(line.quantity) }
      : { key: `imported-${index}`, kind: "custom", description: line.name, quantity: String(line.quantity), price: "" };
  });
}

export function lineLabel(name: string, values: readonly string[]): string {
  return values.length ? `${name} (${variantLabel(values)})` : name;
}

// "2 × Chocolate chip cookies (dozen) +1 more"
export function itemsSummary(lines: readonly { name: string; values: readonly string[]; quantity: number }[], fallback: string): string {
  if (!lines.length) return fallback;
  const [first] = lines;
  const head = `${first.quantity} × ${lineLabel(first.name, first.values)}`;
  return lines.length > 1 ? `${head} +${lines.length - 1} more` : head;
}
