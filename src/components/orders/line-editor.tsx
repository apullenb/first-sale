"use client";
import { Icon } from "@/components/icons";
import { INPUT, SECONDARY } from "@/components/styles";
import { findVariant } from "@/lib/rules/inventory";
import { type CheckedDraft, type DraftLine, itemUnitPrice } from "@/lib/rules/order-lines";
import { dollars, variantLabel } from "@/lib/rules/products";
import type { OrderableItem } from "./shared";

const SMALL = "min-h-11 w-full rounded-[10px] border border-field bg-surface px-3 py-2 text-base shadow-soft focus:border-accent focus:ring-2 focus:ring-accent-ring";
const ROW = "grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_88px_120px_104px_44px] sm:items-start";

let counter = 0;
const newKey = () => `line-${Date.now()}-${++counter}`;

// Saved items price themselves; custom lines take the owner's price, or none yet
export function LineEditor({
  items,
  lines,
  checked,
  onChange,
}: {
  items: OrderableItem[];
  lines: DraftLine[];
  checked: CheckedDraft;
  onChange: (lines: DraftLine[]) => void;
}) {
  const update = (key: string, patch: Partial<DraftLine>) =>
    onChange(lines.map((line) => (line.key === key ? ({ ...line, ...patch } as DraftLine) : line)));
  return (
    <div className="flex flex-col gap-3">
      <div className={`${ROW} hidden border-b border-line pb-2 text-sm font-semibold text-muted sm:grid`} aria-hidden="true">
        <span>Item</span>
        <span>Qty</span>
        <span>Unit price</span>
        <span className="text-right">Line total</span>
        <span />
      </div>
      <ol className="flex flex-col gap-3" aria-label="Order lines">
        {lines.map((line, index) => {
          const row = checked.rows.find((each) => each.key === line.key);
          const number = index + 1;
          const item = line.kind === "item" ? items.find((entry) => entry.id === line.productId) : undefined;
          const variant = item && line.kind === "item" ? findVariant(item.options, line.values) : undefined;
          const stock = item?.options.variants.length ? null : item?.quantity;
          return (
            <li key={line.key} className={`${ROW} border-b border-line pb-3 last:border-b-0`}>
              <div className="col-span-2 flex min-w-0 flex-col gap-2 sm:col-span-1">
                {line.kind === "item" ? (
                  <>
                    <span className="font-semibold">{item?.name ?? "Item no longer saved"}</span>
                    {item?.options.variants.length ? (
                      <select
                        aria-label={`Option for line ${number}`}
                        className={SMALL}
                        value={variant ? item.options.variants.indexOf(variant) : ""}
                        onChange={(event) => update(line.key, { values: item.options.variants[Number(event.target.value)]?.values ?? [] })}
                      >
                        <option value="">Choose {item.options.groups.map((group) => group.name.toLowerCase()).join(" / ")}</option>
                        {item.options.variants.map((each, at) => (
                          <option key={at} value={at}>
                            {variantLabel(each.values)}
                            {each.priceCents !== null ? ` · ${dollars(each.priceCents)}` : ""}
                            {each.quantity === null ? "" : ` · ${each.quantity} in stock`}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {typeof stock === "number" ? <span className="text-sm text-muted">{stock} in stock</span> : null}
                  </>
                ) : (
                  <input
                    aria-label={`Description for line ${number}`}
                    placeholder="What is it? Such as “Full groom, large dog”"
                    maxLength={160}
                    className={SMALL}
                    value={line.description}
                    onChange={(event) => update(line.key, { description: event.target.value })}
                  />
                )}
              </div>
              <label className="flex items-center gap-2 sm:block">
                <span className="text-sm text-muted sm:sr-only">Qty</span>
                <input
                  aria-label={`Quantity for line ${number}`}
                  inputMode="numeric"
                  className={`${SMALL} w-20 sm:w-full`}
                  value={line.quantity}
                  onChange={(event) => update(line.key, { quantity: event.target.value })}
                />
              </label>
              <div className="flex items-center justify-end gap-2 sm:block">
                <span className="text-sm text-muted sm:sr-only">Unit price</span>
                {line.kind === "custom" ? (
                  <input
                    aria-label={`Unit price for line ${number}`}
                    inputMode="decimal"
                    placeholder="$ optional"
                    className={`${SMALL} w-28 sm:w-full`}
                    value={line.price}
                    onChange={(event) => update(line.key, { price: event.target.value })}
                  />
                ) : (
                  <span className="sm:flex sm:min-h-11 sm:items-center" title="Saved price">
                    {item ? (() => {
                      const unit = itemUnitPrice(item, line.values);
                      return unit === null ? <span className="text-muted">No price</span> : dollars(unit);
                    })() : "—"}
                  </span>
                )}
              </div>
              <span className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:min-h-11 sm:justify-end">
                <span className="text-sm text-muted sm:sr-only">Line total</span>
                <strong>{row?.totalCents == null ? <span className="font-normal text-muted">—</span> : dollars(row.totalCents)}</strong>
              </span>
              <button
                type="button"
                className="col-start-2 row-start-1 inline-flex size-11 items-center justify-center rounded-[10px] text-muted hover:bg-wash hover:text-danger sm:col-start-auto sm:row-start-auto"
                onClick={() => onChange(lines.filter((each) => each.key !== line.key))}
              >
                <Icon name="trash" size="sm" />
                <span className="sr-only">Remove line {number}</span>
              </button>
              {row?.error ? <p className="col-span-2 text-sm font-semibold text-danger sm:col-span-5">{row.error}</p> : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {items.length ? (
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 font-semibold">
            Add a saved item
            <select
              className={INPUT}
              value=""
              onChange={(event) => {
                const item = items.find((entry) => entry.id === event.target.value);
                if (!item) return;
                const only = item.options.variants.length === 1 ? item.options.variants[0].values : [];
                onChange([...lines, { key: newKey(), kind: "item", productId: item.id, values: only, quantity: "1" }]);
              }}
            >
              <option value="">Choose a product or service…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.priceCents === null ? (item.priceText ? ` · ${item.priceText}` : "") : ` · ${dollars(item.priceCents)}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className={`${SECONDARY} shrink-0`}
          onClick={() => onChange([...lines, { key: newKey(), kind: "custom", description: "", quantity: "1", price: "" }])}
        >
          <Icon name="plus" size="sm" />
          Add custom line
        </button>
      </div>
      <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-line pt-3">
        <dt className="text-muted">Subtotal</dt>
        <dd className="text-right">{dollars(checked.subtotalCents)}</dd>
        <dt className="font-bold">Total</dt>
        <dd className="text-right font-bold" data-testid="order-total">
          {checked.totalCents === null ? "No total yet" : dollars(checked.totalCents)}
        </dd>
        {checked.unpriced && lines.length ? (
          <dd className="col-span-2 text-sm text-muted">
            {checked.unpriced === 1 ? "1 line has" : `${checked.unpriced} lines have`} no price yet. You can add the total later.
          </dd>
        ) : null}
      </dl>
    </div>
  );
}
