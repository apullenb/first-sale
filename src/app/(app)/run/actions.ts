"use server";

import { isDemoSession } from "@/lib/auth/server";
import { DEMO_REFUSAL } from "@/lib/demo";
import { refresh } from "next/cache";
import { z } from "zod";
import { pauseMyOperationSetup, saveMyOperationSetup } from "@/lib/data/my-business";
import { operationSetupSchema } from "@/lib/rules/operations";

export async function saveOperationAction(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = operationSetupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your answers." };
  if (!await saveMyOperationSetup(parsed.data)) return { ok: false, message: "Tell us about your business first." };
  refresh();
  return { ok: true, message: "Demo setup saved. No accounts are connected and nothing is running in the background." };
}

export async function pauseOperationAction(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.object({ kind: z.enum(["email", "requests"]), paused: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a workflow." };
  if (!await pauseMyOperationSetup(parsed.data.kind, parsed.data.paused)) return { ok: false, message: "Setup not found. Reload and try again." };
  refresh();
  return { ok: true, message: parsed.data.paused ? "Demo paused." : "Demo resumed. No live automation is connected." };
}
