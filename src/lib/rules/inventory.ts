import { type ItemOptions, stockOf, tracksVariantStock, type Variant, variantKey, variantLabel } from "./products";

export interface OrderLine {
  productId: string;
  quantity: number;
}

export interface StockMovement {
  productId: string;
  delta: number;
}

export type OrderIssue =
  | { kind: "empty_order" }
  | { kind: "invalid_quantity"; productId: string; quantity: number }
  | { kind: "unknown_product"; productId: string }
  | { kind: "insufficient_stock"; productId: string; requested: number; available: number };

export type ApplyOrderResult =
  | { status: "confirmed"; stock: Record<string, number>; movements: StockMovement[] }
  | { status: "needs_review"; issues: OrderIssue[] };

// All or nothing: stock changes only when every line can be filled.
export function applyOrder(
  stock: Readonly<Record<string, number>>,
  lines: readonly OrderLine[],
): ApplyOrderResult {
  if (lines.length === 0) return { status: "needs_review", issues: [{ kind: "empty_order" }] };

  const issues: OrderIssue[] = [];
  const requested = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      issues.push({ kind: "invalid_quantity", productId: line.productId, quantity: line.quantity });
      continue;
    }
    requested.set(line.productId, (requested.get(line.productId) ?? 0) + line.quantity);
  }

  for (const [productId, quantity] of requested) {
    if (!Object.hasOwn(stock, productId)) {
      issues.push({ kind: "unknown_product", productId });
    } else if (stock[productId] < quantity) {
      issues.push({ kind: "insufficient_stock", productId, requested: quantity, available: stock[productId] });
    }
  }

  if (issues.length > 0) return { status: "needs_review", issues };

  const next = { ...stock };
  const movements: StockMovement[] = [];
  for (const [productId, quantity] of requested) {
    next[productId] -= quantity;
    movements.push({ productId, delta: -quantity });
  }
  return { status: "confirmed", stock: next, movements };
}

// Orders by option: each line names one item and, for items with options, one exact combination

export interface OrderItem {
  id: string;
  priceCents: number | null;
  quantity: number | null;
  options: ItemOptions;
}

export interface RequestedLine {
  productId: string;
  // One value per option group, in group order; empty for items without options
  values: string[];
  quantity: number;
}

export interface PlacedLine {
  productId: string;
  values: string[];
  quantity: number;
  // The option's own price, else the item's; null when no dollar price is set
  unitPriceCents: number | null;
  totalCents: number | null;
}

// Empty values: the item's own count
export interface OptionMovement {
  productId: string;
  values: string[];
  delta: number;
}

export interface ItemStock {
  productId: string;
  quantity: number | null;
  options: ItemOptions;
}

export type PlaceOrderIssue =
  | { kind: "empty_order" }
  | { kind: "invalid_quantity"; productId: string; values: string[]; quantity: number }
  | { kind: "unknown_product"; productId: string }
  | { kind: "choose_option"; productId: string }
  | { kind: "unknown_option"; productId: string; values: string[] }
  | { kind: "insufficient_stock"; productId: string; values: string[]; requested: number; available: number };

export type PlaceOrderResult =
  | { status: "confirmed"; lines: PlacedLine[]; totalCents: number | null; stock: ItemStock[]; movements: OptionMovement[] }
  | { status: "needs_review"; issues: PlaceOrderIssue[] };

type Source = { productId: string; values: string[] };

const keyOf = (productId: string, values: readonly string[]) => (values.length ? `${productId}\u0000${variantKey(values)}` : productId);

export function findVariant(options: ItemOptions, values: readonly string[]): Variant | undefined {
  const key = variantKey(values);
  return options.variants.find((variant) => variantKey(variant.values) === key);
}

// Where a line's stock is counted: the option's own count, else the item's, else not counted
function stockSource(item: OrderItem, variant: Variant | undefined): Source | null {
  if (variant && variant.quantity !== null) return { productId: item.id, values: variant.values };
  if (variant && tracksVariantStock(item.options)) return null;
  return item.quantity === null ? null : { productId: item.id, values: [] };
}

// Moves stock by each movement's delta; the item's total follows its options
function moved(items: ReadonlyMap<string, OrderItem>, movements: readonly OptionMovement[]): ItemStock[] {
  const next = new Map<string, ItemStock>();
  for (const movement of movements) {
    const item = items.get(movement.productId);
    if (!item) continue;
    const current = next.get(item.id) ?? { productId: item.id, quantity: item.quantity, options: { groups: item.options.groups, variants: item.options.variants.map((variant) => ({ ...variant })) } };
    if (movement.values.length) {
      const variant = findVariant(current.options, movement.values);
      if (variant && variant.quantity !== null) variant.quantity += movement.delta;
    } else if (current.quantity !== null) {
      current.quantity += movement.delta;
    }
    next.set(item.id, current);
  }
  return [...next.values()].map((stock) => ({ ...stock, quantity: stockOf(stock.quantity, stock.options) }));
}

// Prices each line from its option and takes stock from that option only; all or nothing
export function placeOrder(items: readonly OrderItem[], requested: readonly RequestedLine[]): PlaceOrderResult {
  if (requested.length === 0) return { status: "needs_review", issues: [{ kind: "empty_order" }] };
  const byId = new Map(items.map((item) => [item.id, item]));
  const issues: PlaceOrderIssue[] = [];
  const merged = new Map<string, { item: OrderItem; variant: Variant | undefined; quantity: number }>();

  for (const line of requested) {
    const item = byId.get(line.productId);
    if (!item) {
      issues.push({ kind: "unknown_product", productId: line.productId });
      continue;
    }
    let variant: Variant | undefined;
    if (item.options.variants.length) {
      if (!line.values.length) {
        issues.push({ kind: "choose_option", productId: item.id });
        continue;
      }
      variant = findVariant(item.options, line.values);
      if (!variant) {
        issues.push({ kind: "unknown_option", productId: item.id, values: line.values });
        continue;
      }
    } else if (line.values.length) {
      issues.push({ kind: "unknown_option", productId: item.id, values: line.values });
      continue;
    }
    const values = variant?.values ?? [];
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      issues.push({ kind: "invalid_quantity", productId: item.id, values, quantity: line.quantity });
      continue;
    }
    const key = keyOf(item.id, values);
    merged.set(key, { item, variant, quantity: (merged.get(key)?.quantity ?? 0) + line.quantity });
  }
  if (issues.length) return { status: "needs_review", issues };

  // Counted stock goes through applyOrder, keyed by where it's counted
  const stock: Record<string, number> = {};
  const sources = new Map<string, Source>();
  const counted: OrderLine[] = [];
  for (const { item, variant, quantity } of merged.values()) {
    const source = stockSource(item, variant);
    if (!source) continue;
    const key = keyOf(source.productId, source.values);
    stock[key] = source.values.length ? (variant?.quantity ?? 0) : (item.quantity ?? 0);
    sources.set(key, source);
    counted.push({ productId: key, quantity });
  }
  let movements: OptionMovement[] = [];
  if (counted.length) {
    const applied = applyOrder(stock, counted);
    if (applied.status === "needs_review") {
      return {
        status: "needs_review",
        issues: applied.issues.flatMap((issue) => {
          if (issue.kind !== "insufficient_stock") return [];
          const source = sources.get(issue.productId)!;
          return [{ kind: "insufficient_stock" as const, ...source, requested: issue.requested, available: issue.available }];
        }),
      };
    }
    movements = applied.movements.map((movement) => ({ ...sources.get(movement.productId)!, delta: movement.delta }));
  }

  const lines = [...merged.values()].map(({ item, variant, quantity }) => {
    const unitPriceCents = variant?.priceCents ?? item.priceCents;
    return { productId: item.id, values: variant?.values ?? [], quantity, unitPriceCents, totalCents: unitPriceCents === null ? null : unitPriceCents * quantity };
  });
  return { status: "confirmed", lines, totalCents: orderTotalCents(lines), stock: moved(byId, movements), movements };
}

// Gives back what an order took, to the same option; options since removed or no longer counted are listed, not guessed
export function restoreStock(items: readonly OrderItem[], taken: readonly OptionMovement[]): { stock: ItemStock[]; movements: OptionMovement[]; skipped: OptionMovement[] } {
  const byId = new Map(items.map((item) => [item.id, item]));
  const movements: OptionMovement[] = [];
  const skipped: OptionMovement[] = [];
  for (const movement of taken) {
    if (movement.delta >= 0) continue;
    const item = byId.get(movement.productId);
    const counted = !item
      ? false
      : movement.values.length
        ? (findVariant(item.options, movement.values)?.quantity ?? null) !== null
        : item.quantity !== null && !tracksVariantStock(item.options);
    if (counted) movements.push({ productId: movement.productId, values: movement.values, delta: -movement.delta });
    else skipped.push(movement);
  }
  return { stock: moved(byId, movements), movements, skipped };
}

// Movements added up per item and option; zero sums dropped
export function sumMovements(movements: readonly OptionMovement[]): OptionMovement[] {
  const sums = new Map<string, OptionMovement>();
  for (const movement of movements) {
    const key = keyOf(movement.productId, movement.values);
    const found = sums.get(key);
    if (found) found.delta += movement.delta;
    else sums.set(key, { productId: movement.productId, values: movement.values, delta: movement.delta });
  }
  return [...sums.values()].filter((movement) => movement.delta !== 0);
}

// What an order still holds, after any edits gave some back
export function netTaken(movements: readonly OptionMovement[]): OptionMovement[] {
  return sumMovements(movements).filter((movement) => movement.delta < 0);
}

// What the owner reads when an order can't be saved
export function orderIssueText(issue: PlaceOrderIssue, nameOf: (productId: string) => string): string {
  if (issue.kind === "empty_order") return "Add at least one item to the order.";
  const name = nameOf(issue.productId);
  const label = "values" in issue && issue.values.length ? `${name} (${variantLabel(issue.values)})` : name;
  switch (issue.kind) {
    case "unknown_product":
      return "One of those items isn’t in your products any more. Reload and try again.";
    case "choose_option":
      return `Choose which option of ${name} was ordered.`;
    case "unknown_option":
      return `${label} isn’t one of its options any more. Reload and choose again.`;
    case "invalid_quantity":
      return `Type how many ${label} as a whole number.`;
    case "insufficient_stock":
      return `Only ${issue.available} ${label} in stock, and the order asks for ${issue.requested}.`;
  }
}

// Null when any line has no dollar price, so a partial sum is never shown as the total
export function orderTotalCents(lines: readonly { unitPriceCents: number | null; quantity: number }[]): number | null {
  if (lines.some((line) => line.unitPriceCents === null)) return null;
  return lines.reduce((sum, line) => sum + (line.unitPriceCents ?? 0) * line.quantity, 0);
}
