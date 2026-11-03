import { acceptCustomerEmailEvent } from "@/lib/data/my-business";

export async function GET(request: Request) {
  const challenge = new URL(request.url).searchParams.get("challenge");
  return challenge && challenge.length <= 1000
    ? new Response(challenge, { headers: { "Content-Type": "text/plain" } })
    : new Response(null, { status: 400 });
}
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 1_100_000)
    return new Response(null, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 1_100_000)
    return new Response(null, { status: 413 });
  try {
    return new Response(null, {
      status: (await acceptCustomerEmailEvent(
        body,
        request.headers.get("x-nylas-signature"),
      ))
        ? 204
        : 401,
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
