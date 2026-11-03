import { getDb } from "@/db/client";
import { postmarkSchema, receiveInbound, webhookAuthorized } from "@/lib/email/inbound";

// Postmark allows larger emails; the host caps a request near this anyway
const MAX_BODY_BYTES = 12_000_000;

const reply = (status: number, extra: Record<string, string> = {}) =>
  new Response(status === 200 ? "ok" : null, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });

async function readCapped(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: Request) {
  // Checked before anything is read or looked up
  if (!webhookAuthorized(request.headers.get("authorization")))
    return reply(401, { "WWW-Authenticate": 'Basic realm="inbound"' });
  const text = await readCapped(request);
  if (text === null) return reply(413);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return reply(400);
  }
  const payload = postmarkSchema.safeParse(json);
  if (!payload.success) return reply(400);
  try {
    // Unknown addresses get the same answer as stored ones
    await receiveInbound(getDb(), payload.data);
  } catch {
    // Postmark retries anything but a 200, so a passing failure isn't lost
    return reply(500);
  }
  return reply(200);
}
