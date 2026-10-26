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
