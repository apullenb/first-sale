"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isDemoSession } from "@/lib/auth/server";
import { addMyEmailDemoOrder, clearMyEmailDemoOrders } from "@/lib/data/my-business";
import { DEMO_REFUSAL } from "@/lib/demo";

export async function confirmEmailSample(input: unknown): Promise<{ ok: boolean; message: string }> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.object({ sampleId: z.string().min(1).max(40) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a sample email." };
  const result = await addMyEmailDemoOrder(parsed.data.sampleId);
  if (!result.ok)
    return { ok: false, message: result.reason === "no_business" ? "Tell us about your business first." : "That sample isn’t an order or quote request." };
  refresh();
  return { ok: true, message: "Added to Orders & jobs." };
}

export async function restartEmailDemo(): Promise<{ ok: boolean; message: string }> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  await clearMyEmailDemoOrders();
  refresh();
  return { ok: true, message: "Demo started over." };
}
