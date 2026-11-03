import "server-only";
import { z } from "zod";
import { OwnerFacingError } from "@/lib/errors";

export function emailConfig() {
  const apiKey = process.env.NYLAS_API_KEY,
    clientId = process.env.NYLAS_CLIENT_ID,
    redirectUri = process.env.NYLAS_REDIRECT_URI;
  const base =
    process.env.NYLAS_REGION === "eu"
      ? "https://api.eu.nylas.com"
      : "https://api.us.nylas.com";
  if (!apiKey || !clientId || !redirectUri)
    throw new OwnerFacingError(
      "Connecting an inbox isn’t set up on this site yet. You can still paste emails or upload invoices.",
    );
  const url = new URL(redirectUri);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && url.hostname === "localhost")
  )
    throw new OwnerFacingError("Email needs a secure callback address.");
  return { apiKey, clientId, redirectUri, base };
}
export function emailAvailable() {
  try {
    emailConfig();
    return true;
  } catch {
    return false;
  }
}
// Keeps the provider's status, so a gone grant can be told from a passing failure
export class EmailApiError extends OwnerFacingError {
  constructor(readonly status: number) {
    super(
      "The email service could not complete this request. Check your connection and try again.",
    );
  }
}
export async function emailApi(path: string, init: RequestInit = {}) {
  const config = emailConfig();
  const response = await fetch(`${config.base}/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new EmailApiError(response.status);
  if (response.status === 204) return {};
  return response.json();
}
export const emailMessageSchema = z.object({
  id: z.string().min(1).max(500),
  thread_id: z.string().max(500).nullish(),
  subject: z
    .string()
    .max(1000)
    .nullish()
    .transform((value) => value ?? ""),
  body: z
    .string()
    .max(2_000_000)
    .nullish()
    .transform((value) => value ?? ""),
  from: z
    .array(z.object({ email: z.email(), name: z.string().nullish() }))
    .default([]),
  to: z.array(z.object({ email: z.email() })).default([]),
  attachments: z
    .array(
      z.object({
        id: z.string().max(500),
        filename: z.string().max(300).optional(),
        content_type: z.string().optional(),
        size: z.number().optional(),
      }),
    )
    .default([]),
});
