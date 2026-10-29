"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { createMyProduct, deleteMyProduct, updateMyProduct } from "@/lib/data/my-business";
import { checkProduct, productPhotoRefSchema } from "@/lib/rules/products";

const formSchema = z.object({
  id: z.string().min(1).max(60).nullable(),
  name: z.string().max(400),
  description: z.string().max(2000),
  price: z.string().max(40),
  unitCost: z.string().max(40),
  quantity: z.string().max(40),
  photo: productPhotoRefSchema.nullable(),
});

const SAVE_MESSAGES = {
  no_business: "Tell us about your business first.",
  too_many: "You’ve added as many products as First Sale keeps. Remove ones you no longer sell, then try again.",
  bad_photo: "That photo wasn’t found. It may have been deleted. Pick another one.",
  not_found: "That product wasn’t found. It may have been removed. Reload the page.",
} as const;

// Adds or changes one product; prices are kept exactly as the owner typed them
export async function saveProductAction(input: unknown): Promise<ActionResult<string> & { field?: string }> {
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some answers are too long. Shorten them and try again." };
  const { id, ...form } = parsed.data;
  const checked = checkProduct(form);
  if (!checked.ok) return { ok: false, message: checked.message, field: checked.field };
  const saved = id ? await updateMyProduct(id, checked.value) : await createMyProduct(checked.value);
  if (!saved.ok) return { ok: false, message: SAVE_MESSAGES[saved.reason], field: saved.reason === "bad_photo" ? "photo" : undefined };
  refresh();
  return { ok: true, value: saved.id };
}

export async function deleteProductAction(productId: unknown): Promise<ActionResult> {
  const parsed = z.string().min(1).max(60).safeParse(productId);
  const result = parsed.success ? await deleteMyProduct(parsed.data) : "not_found";
  if (result === "on_orders") return { ok: false, message: "This product is on an order, so it stays in your list to keep the order complete." };
  if (result === "not_found") return { ok: false, message: SAVE_MESSAGES.not_found };
  refresh();
  return { ok: true, value: null };
}
