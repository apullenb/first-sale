import { OwnerFacingError } from "@/lib/errors";

// The live demo: /demo opens the DEMO_OWNER_EMAIL account read-only, without a password

export const DEMO_NOTE = "This is the demo, so changes aren’t saved. Start your own to try it.";
export const DEMO_REFUSAL = { ok: false as const, message: DEMO_NOTE };
// On buttons that would save, in place of their label
export const DEMO_BUTTON = "Not available in the demo";

// Only /demo makes tokens with this prefix; Better Auth's own are letters and digits
export const DEMO_TOKEN_PREFIX = "demo_";
export const DEMO_SESSION_SECONDS = 3 * 60 * 60;

// Null turns the demo off
export function demoOwnerEmail(): string | null {
  return process.env.DEMO_OWNER_EMAIL?.trim().toLowerCase() || null;
}

export function isDemoToken(token: string | null | undefined): boolean {
  return typeof token === "string" && token.startsWith(DEMO_TOKEN_PREFIX);
}

export class DemoReadOnlyError extends OwnerFacingError {
  constructor() {
    super(DEMO_NOTE);
  }
}

export function assertCanWrite(user: { demo: boolean }): void {
  if (user.demo) throw new DemoReadOnlyError();
}
