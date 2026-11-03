"use client";

import { useId, useState } from "react";
import { updatePlanEstimatesAction } from "@/app/(app)/documents/actions";
import { Icon } from "@/components/icons";
import { ALERT, INPUT, SECONDARY } from "@/components/styles";
import { Card, Chip } from "@/components/ui";
import { MONEY_LIMITS, MONEY_PIECES, type MoneyInputs, PLAN_LEVEL_LABELS, planMoney } from "@/lib/rules/plan-money";
import { dollars, parseDollars } from "@/lib/website/site/design";
import { failedMessage } from "@/lib/failure";

// The form keeps text as typed; amounts become cents only when they read as dollars
export interface MoneyForm {
  items: { name: string; price: string; cost: string; units: string }[];
  expenses: { label: string; amount: string }[];
  startup: { label: string; amount: string }[];
  cash: string;
  reserve: string;
  purpose: MoneyInputs["purpose"];
}

const text = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(cents % 100 ? 2 : 0));

export function moneyForm(money: MoneyInputs): MoneyForm {
  return {
    items: money.items.map((item) => ({ name: item.name, price: text(item.priceCents), cost: text(item.unitCostCents), units: item.unitsPerMonth === null ? "" : String(item.unitsPerMonth) })),
    expenses: money.monthlyExpenses.map((each) => ({ label: each.label, amount: text(each.cents) })),
    startup: money.startupCosts.map((each) => ({ label: each.label, amount: text(each.cents) })),
    cash: text(money.cashOnHandCents),
    reserve: money.reserveMonths === null ? "" : String(money.reserveMonths),
    purpose: money.purpose,
  };
}

// Cents and whole numbers from the form, or the first entry that doesn't read as one
export function moneyFromForm(form: MoneyForm): { ok: true; money: MoneyInputs } | { ok: false; message: string } {
  let problem: string | null = null;
  const amount = (value: string, what: string) => {
    if (!value.trim()) return null;
    const cents = parseDollars(value);
    if (cents === null) problem ??= `Check ${what}: use a dollar amount like 12.50.`;
    return cents;
  };
  const whole = (value: string, what: string, max: number) => {
    if (!value.trim()) return null;
    const number = Number(value.replace(/,/g, "").trim());
    if (!Number.isInteger(number) || number < 0 || number > max) problem ??= `Check ${what}: use a whole number.`;
    return Number.isInteger(number) && number >= 0 && number <= max ? number : null;
  };
  const money: MoneyInputs = {
    items: form.items.map((item) => ({
      name: item.name.slice(0, MONEY_LIMITS.label),
      priceCents: amount(item.price, `the price of ${item.name || "an item"}`),
      unitCostCents: amount(item.cost, `the cost of ${item.name || "an item"}`),
      unitsPerMonth: whole(item.units, `the monthly sales of ${item.name || "an item"}`, MONEY_LIMITS.units),
    })),
    monthlyExpenses: form.expenses.map((each) => ({ label: each.label.slice(0, MONEY_LIMITS.label), cents: amount(each.amount, each.label || "a monthly expense") })),
    startupCosts: form.startup.map((each) => ({ label: each.label.slice(0, MONEY_LIMITS.label), cents: amount(each.amount, each.label || "a starting cost") })),
    cashOnHandCents: amount(form.cash, "cash on hand"),
    reserveMonths: whole(form.reserve, "the months of expenses to keep", MONEY_LIMITS.months),
    purpose: form.purpose,
  };
  return problem ? { ok: false, message: problem } : { ok: true, money };
}

// Optional money estimates for the plan; every sum shown here comes from the plan-money rules
export function PlanMoney({ form, onChange, hasDraft }: { form: MoneyForm; onChange: (form: MoneyForm) => void; hasDraft: boolean }) {
  const uid = useId();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const read = moneyFromForm(form);
  const result = read.ok ? planMoney(read.money) : null;
  const set = (patch: Partial<MoneyForm>) => {
    setStatus("idle");
    onChange({ ...form, ...patch });
  };

  async function update() {
    if (!read.ok) return setError(read.message);
    setStatus("saving");
    setError(null);
    try {
      const done = await updatePlanEstimatesAction({ money: read.money });
      if (!done.ok) setError(done.message);
      setStatus(done.ok ? "saved" : "idle");
    } catch {
      setError(failedMessage());
      setStatus("idle");
    }
  }

  return (
    <Card
      title="Money estimates (optional)"
      icon="dollar"
      id="plan-money-heading"
      action={result ? <Chip tone={result.level === "lender" ? "accent" : "gray"}>{PLAN_LEVEL_LABELS[result.level]}</Chip> : null}
    >
      <p className="text-rule">
        Add your own figures and SnapStart works out margins, break-even and cash needs itself. The AI service that drafts the plan doesn’t get these
        figures and never writes them. Skip any of it, and the plan says it isn’t estimated yet.
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Who is this plan for?</legend>
        {(
          [
            ["intro", "An introduction for now", "Describes the business. Fine without money estimates."],
            ["lender", "A lender or loan program", "Labeled “Prepared for a lender” once every estimate below is filled in."],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className="flex items-start gap-2.5">
            <input type="radio" name={`${uid}-purpose`} checked={form.purpose === value} onChange={() => set({ purpose: value })} className="mt-1.5 size-4 accent-(--color-accent)" />
            <span>
              <span className="font-semibold">{label}</span>
              <span className="block text-[14.5px] text-muted">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Rows
        title="What you sell"
        hint="Price, what one costs you to make or buy, and how many you expect to sell in a month."
        add="Add an item"
        rows={form.items}
        empty={{ name: "", price: "", cost: "", units: "" }}
        onRows={(items) => set({ items })}
        columns={[
          { key: "name", label: "Item", wide: true },
          { key: "price", label: "Price ($)", money: true },
          { key: "cost", label: "Cost each ($)", money: true },
          { key: "units", label: "Sold a month" },
        ]}
      />
      <Rows
        title="Monthly operating expenses"
        hint="Costs you pay each month whatever you sell, such as booth fees, insurance or software."
        add="Add an expense"
        rows={form.expenses}
        empty={{ label: "", amount: "" }}
        onRows={(expenses) => set({ expenses })}
        columns={[
          { key: "label", label: "Expense", wide: true },
          { key: "amount", label: "A month ($)", money: true },
        ]}
      />
      <Rows
        title="Starting costs"
        hint="One-time costs before your first sale, such as equipment, permits and first supplies."
        add="Add a starting cost"
        rows={form.startup}
        empty={{ label: "", amount: "" }}
        onRows={(startup) => set({ startup })}
        columns={[
          { key: "label", label: "Cost", wide: true },
          { key: "amount", label: "Amount ($)", money: true },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">Cash you have to start ($)</span>
          <input inputMode="decimal" value={form.cash} onChange={(event) => set({ cash: event.target.value })} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">Months of expenses to keep in reserve</span>
          <input inputMode="numeric" value={form.reserve} onChange={(event) => set({ reserve: event.target.value })} className={INPUT} />
        </label>
      </div>

      <section aria-labelledby={`${uid}-sums`} className="flex flex-col gap-2 rounded-xl border border-line bg-soft px-4 py-3.5">
        <h3 id={`${uid}-sums`} className="font-bold">
          Worked out from your figures
        </h3>
        {result ? <Sums result={result} /> : <p className="text-check">{!read.ok ? read.message : null}</p>}
      </section>

      {hasDraft ? (
        <div className="flex flex-col items-start gap-2 border-t border-line pt-4">
          <button type="button" data-writes onClick={update} disabled={status === "saving"} className={SECONDARY}>
            <Icon name="refresh" size="sm" />
            {status === "saving" ? "Updating…" : "Update the estimates in my plan"}
          </button>
          <p role="status" className="text-[14.5px] text-muted">
            {status === "saved" ? "The Financial Estimates section of your plan is updated. Save the plan again to update its PDF." : "Changes only that section; your edits elsewhere stay."}
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function Sums({ result }: { result: ReturnType<typeof planMoney> }) {
  const lines: string[] = [];
  for (const each of result.margins) lines.push(`${each.name}: ${dollars(each.marginCents)} margin a unit (${each.marginPercent}%)`);
  if (result.expenses) lines.push(`Operating expenses: ${dollars(result.expenses.totalCents)} a month`);
  if (result.sales) lines.push(`Sales: ${dollars(result.sales.revenueCents)} a month${result.sales.grossCents !== null ? `, ${dollars(result.sales.grossCents)} after costs` : ""}`);
  if (result.netCents !== null) lines.push(result.netCents >= 0 ? `Left after expenses: ${dollars(result.netCents)} a month` : `Loss after expenses: ${dollars(-result.netCents)} a month`);
  if (result.breakEven) lines.push(result.breakEven.units === null ? "Break-even: not reached at these prices and costs" : `Break-even: about ${result.breakEven.units.toLocaleString("en-US")} sold a month`);
  if (result.cash) {
    lines.push(`Cash needed: ${dollars(result.cash.neededCents)}`);
    if (result.cash.gapCents !== null) lines.push(result.cash.gapCents >= 0 ? `Cash to spare: ${dollars(result.cash.gapCents)}` : `Cash still to find: ${dollars(-result.cash.gapCents)}`);
  }
  return (
    <>
      {lines.length ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px]">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {result.missing.length ? <p className="text-[14.5px] text-muted">Not yet estimated: {result.missing.map((piece) => MONEY_PIECES[piece]).join(", ")}.</p> : null}
    </>
  );
}

type Column<Row> = { key: keyof Row & string; label: string; wide?: boolean; money?: boolean };

function Rows<Row extends Record<string, string>>({
  title,
  hint,
  add,
  rows,
  empty,
  columns,
  onRows,
}: {
  title: string;
  hint: string;
  add: string;
  rows: Row[];
  empty: Row;
  columns: Column<Row>[];
  onRows: (rows: Row[]) => void;
}) {
  const uid = useId();
  const full = rows.length >= MONEY_LIMITS.items;
  return (
    <section aria-labelledby={`${uid}-title`} className="flex flex-col gap-2">
      <h3 id={`${uid}-title`} className="font-semibold">
        {title}
      </h3>
      <p className="text-[14.5px] text-muted">{hint}</p>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2 border-b border-line pb-2.5 sm:flex-nowrap">
          {columns.map((column) => (
            <label key={column.key} className={`flex flex-col gap-1 ${column.wide ? "min-w-0 basis-full sm:flex-1 sm:basis-auto" : "w-[calc(33%-0.5rem)] sm:w-28"}`}>
              <span className="text-[13.5px] text-muted">{column.label}</span>
              <input
                inputMode={column.wide ? "text" : column.money ? "decimal" : "numeric"}
                maxLength={column.wide ? MONEY_LIMITS.label : 12}
                value={row[column.key]}
                onChange={(event) => onRows(rows.map((each, at) => (at === index ? { ...each, [column.key]: event.target.value } : each)))}
                className={INPUT}
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => onRows(rows.filter((_, at) => at !== index))}
            className="inline-grid size-11 shrink-0 place-items-center rounded-[10px] text-muted transition hover:bg-soft hover:text-accent"
            aria-label={`Remove ${row[columns[0].key] || "this row"}`}
          >
            <Icon name="trash" size="sm" />
          </button>
        </div>
      ))}
      {full ? null : (
        <button type="button" onClick={() => onRows([...rows, empty])} className={`${SECONDARY} w-fit`}>
          <Icon name="plus" size="sm" />
          {add}
        </button>
      )}
    </section>
  );
}
