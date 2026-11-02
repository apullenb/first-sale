import { z } from "zod";
import { OPERATIONS, type OperationKind } from "@/lib/operations/catalog";
import { dollars, type ItemOptions, tracksVariantStock, variantLabel } from "./products";

export const operationSetupSchema = z.object({
  kind: z.enum(["email", "requests"]),
  source: z.string().max(60),
  email: z.union([z.literal(""), z.email().max(254)]),
  goals: z.array(z.string().max(80)).min(1).max(2),
  reminder: z.enum(["1", "2", "3", "7"]),
  mode: z.literal("demo"),
}).superRefine((value, ctx) => {
  const definition = OPERATIONS[value.kind];
  if (!(definition.choices as readonly string[]).includes(value.source)) ctx.addIssue({ code: "custom", path: ["source"], message: "Choose a source from the list." });
  if (value.goals.some((goal) => !(definition.goals as readonly string[]).includes(goal)) || new Set(value.goals).size !== value.goals.length) ctx.addIssue({ code: "custom", path: ["goals"], message: "Choose what you want help with." });
  if ((value.kind === "email" || value.source === "Email") && !value.email) ctx.addIssue({ code: "custom", path: ["email"], message: "Enter the business email you plan to connect." });
});
export type OperationSetup = z.infer<typeof operationSetupSchema>;

export function defaultOperation(kind: OperationKind): OperationSetup {
  return { kind, source: OPERATIONS[kind].choices[0], email: "", goals: [...OPERATIONS[kind].goals], reminder: "2", mode: "demo" };
}

// One of the owner's items for the sample request, naming an exact option when it has them
export interface SampleItem {
  name: string;
  values: string[];
  priceCents: number | null;
  quantity: number | null;
}

export function sampleRequestItem(items: readonly { name: string; priceCents: number | null; quantity: number | null; options: ItemOptions }[]): SampleItem | null {
  const item = items.find((each) => each.options.variants.length) ?? items[0];
  if (!item) return null;
  const variant = item.options.variants[0];
  return variant
    ? { name: item.name, values: variant.values, priceCents: variant.priceCents ?? item.priceCents, quantity: variant.quantity ?? (tracksVariantStock(item.options) ? null : item.quantity) }
    : { name: item.name, values: [], priceCents: item.priceCents, quantity: item.quantity };
}

function sampleDetails(item: SampleItem): string {
  const facts = [item.priceCents === null ? null : `${dollars(item.priceCents)} each`, item.quantity === null ? null : `${item.quantity} in stock`].filter(Boolean);
  return facts.length ? ` ${item.values.length ? "That option" : "It"} is ${facts.join(", with ")}.` : "";
}

export function demoOperation(setup: OperationSetup, item: SampleItem | null = null) {
  const checked = operationSetupSchema.parse(setup);
  const asked = checked.kind === "requests" && item ? `${item.name}${item.values.length ? ` (${variantLabel(item.values)})` : ""}` : null;
  return {
    title: checked.kind === "email" ? "DEMO · Customer email" : "DEMO · Customer request",
    message: asked ? `Hi! Could I order 2 of your ${asked}?` : "Could you tell me more about placing an order?",
    result: checked.kind === "email" ? checked.goals.includes("Draft customer replies") ? "A reply draft is waiting for your review. Nothing was sent." : "A customer message is flagged for your attention. No reply was drafted or sent." : `A request is waiting for your review.${item ? sampleDetails(item) : ""} No order was placed and stock is unchanged.`,
    reminder: `If it still needs attention after ${checked.reminder} day${checked.reminder === "1" ? "" : "s"}, show a follow-up reminder.`,
  };
}
