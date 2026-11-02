"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { isDemoSession } from "@/lib/auth/server";
import { DEMO_REFUSAL } from "@/lib/demo";
import { beginMySquareConnection, listMySquareItems, draftMySquareDescription, editMySquareDraft, approveMySquareDraft, disconnectMySquare } from "@/lib/data/my-business";
import { OwnerFacingError } from "@/lib/errors";
import { runWorkflow } from "@/lib/workflow-runner";

async function safely<T>(job: () => Promise<T>) {
  try { return { ok: true as const, value: await job() }; }
  catch (error) { return { ok: false as const, message: error instanceof OwnerFacingError ? error.message : "This Square request could not be completed. Your saved work is safe. Try again." }; }
}

export async function connectSquareAction() {
  if (await isDemoSession()) return DEMO_REFUSAL;
  return safely(async () => {
    const connection = await beginMySquareConnection();
    (await cookies()).set("square_oauth_state", connection.state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/square/callback", maxAge: 600 });
    return { url: connection.url };
  });
}

export async function loadSquareItemsAction() {
  if (await isDemoSession()) return DEMO_REFUSAL;
  return safely(listMySquareItems);
}

export async function draftSquareAction(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.object({ itemId: z.string().min(1).max(200), request: z.string().trim().min(1).max(1000) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Select a product and describe the change in up to 1,000 characters." };
  const result = await runWorkflow("square_description", parsed.data.itemId, () => draftMySquareDescription(parsed.data.itemId, parsed.data.request));
  refresh();
  return result;
}

export async function editSquareAction(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.object({ id: z.string().uuid(), description: z.string().max(300), cancel: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Check the description and try again." };
  const result = await safely(() => editMySquareDraft(parsed.data.id, parsed.data.description, parsed.data.cancel));
  refresh();
  return result;
}

export async function approveSquareAction(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.object({ id: z.string().uuid(), description: z.string().min(1).max(300) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Reload and review the saved description." };
  const result = await safely(() => approveMySquareDraft(parsed.data.id, parsed.data.description));
  refresh();
  return result;
}

export async function disconnectSquareAction() {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const result = await safely(disconnectMySquare);
  refresh();
  return result;
}

export async function getSquareProductsAction(input?: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.object({ productId: z.string().uuid(), expected: z.string().max(40_000) }).optional().safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Reload the product library and try again." };
  const result = await safely(async () => (await import("@/lib/data/my-business")).pullMySquareProducts(parsed.data?.productId, parsed.data?.expected));
  refresh();
  return result;
}

export async function pushSquareProductAction(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.object({ productId: z.string().uuid(), expected: z.string().max(40_000) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Reload and review the product before pushing it." };
  const result = await safely(async () => (await import("@/lib/data/my-business")).pushMySquareProduct(parsed.data.productId, parsed.data.expected));
  refresh();
  return result;
}
