import { z } from "zod";
import { OPERATIONS, type OperationKind } from "@/lib/operations/catalog";

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

export function demoOperation(setup: OperationSetup) {
  const checked = operationSetupSchema.parse(setup);
  return {
    title: checked.kind === "email" ? "DEMO · Customer email" : "DEMO · Customer request",
    message: "Could you tell me more about placing an order?",
    result: checked.kind === "email" ? checked.goals.includes("Draft customer replies") ? "A reply draft is waiting for your review. Nothing was sent." : "A customer message is flagged for your attention. No reply was drafted or sent." : "A request is waiting for your review. No order was placed and stock is unchanged.",
    reminder: `If it still needs attention after ${checked.reminder} day${checked.reminder === "1" ? "" : "s"}, show a follow-up reminder.`,
  };
}
