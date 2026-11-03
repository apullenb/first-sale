import { runScheduledCustomerWork } from "@/lib/data/my-business";
export const maxDuration = 300;
export async function GET(request: Request) {
  const result = await runScheduledCustomerWork(
    request.headers.get("authorization"),
  );
  return result
    ? Response.json(result, { headers: { "Cache-Control": "no-store" } })
    : new Response(null, { status: 401 });
}
