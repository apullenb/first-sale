import "server-only";
import { parse } from "node-html-parser";
import { z } from "zod";
import { OwnerFacingError } from "@/lib/errors";
import { squareConfig } from "./config";

export const tokenSchema = z.object({ access_token: z.string(), refresh_token: z.string(), expires_at: z.string().datetime(), merchant_id: z.string() });
export type SquareTokens = z.infer<typeof tokenSchema>;
export const itemSchema = z.object({ id: z.string(), type: z.literal("ITEM"), version: z.number().int().safe(), is_deleted: z.boolean().optional(),
  item_data: z.object({ name: z.string(), description: z.string().optional(), description_html: z.string().optional(), description_plaintext: z.string().optional(), is_archived: z.boolean().optional() }).passthrough(),
}).passthrough();
export type SquareItem = z.infer<typeof itemSchema>;

export async function squareRequest(path: string, token: string | null, body?: unknown, clientAuth = false): Promise<unknown> {
  const config = squareConfig();
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, { method: body === undefined ? "GET" : "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "Square-Version": "2026-09-16", ...(token ? { Authorization: `${clientAuth ? "Client" : "Bearer"} ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  } catch { throw new OwnerFacingError("Square could not be reached. Your draft is saved; try again."); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new OwnerFacingError("Square access was denied. Reconnect Square and try again.");
    if (response.status === 429) throw new OwnerFacingError("Square is busy. Wait a moment and retry this saved change.");
    throw new OwnerFacingError("Square did not complete the request. Reload the product before trying again.");
  }
  return response.json();
}

export async function obtainTokens(input: { code: string } | { refresh_token: string }): Promise<SquareTokens> {
  const config = squareConfig();
  return tokenSchema.parse(await squareRequest("/oauth2/token", null, {
    client_id: config.applicationId, client_secret: config.applicationSecret,
    grant_type: "code" in input ? "authorization_code" : "refresh_token", redirect_uri: config.redirectUri, ...input,
  }));
}

export async function retrieveItem(token: string, id: string): Promise<SquareItem> {
  const response = z.object({ object: itemSchema }).parse(await squareRequest(`/v2/catalog/object/${encodeURIComponent(id)}`, token));
  if (response.object.is_deleted || response.object.item_data.is_archived) throw new OwnerFacingError("This Square product is no longer active.");
  return response.object;
}

export async function listCatalogItems(token: string): Promise<SquareItem[]> {
  const result: SquareItem[] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const page = z.object({ objects: z.array(z.unknown()).optional(), cursor: z.string().optional() }).parse(await squareRequest(`/v2/catalog/list?types=ITEM${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, token));
    for (const raw of page.objects ?? []) {
      const parsed = itemSchema.safeParse(raw);
      if (parsed.success && !parsed.data.is_deleted && !parsed.data.item_data.is_archived) result.push(parsed.data);
    }
    cursor = page.cursor;
    if (cursor && seen.has(cursor)) throw new OwnerFacingError("Square returned an incomplete catalog. Try loading products again.");
    if (cursor) seen.add(cursor);
    if (result.length > 2000 || seen.size > 40) throw new OwnerFacingError("This catalog is too large for this product picker yet.");
  } while (cursor);
  return result;
}

export async function listItems(token: string): Promise<{ id: string; name: string }[]> {
  return (await listCatalogItems(token)).map((item) => ({ id: item.id, name: item.item_data.name }));
}

export function catalogDescription(item: SquareItem): string {
  const text = item.item_data.description_plaintext ?? (item.item_data.description_html !== undefined
    ? parse(item.item_data.description_html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")).text
    : item.item_data.description ?? "");
  return text.replace(/\s+/g, " ").trim();
}

export function descriptionMatches(item: SquareItem, description: string): boolean {
  return catalogDescription(item) === description.replace(/\s+/g, " ").trim();
}
