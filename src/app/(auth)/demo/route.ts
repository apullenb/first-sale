import { getAuth } from "@/lib/auth/server";

// The public demo link: Better Auth's demo-session endpoint signs the visitor in read-only (rate-limited per IP)
export function GET(request: Request) {
  return getAuth().handler(new Request(new URL("/api/auth/demo-session", request.url), { headers: request.headers }));
}
