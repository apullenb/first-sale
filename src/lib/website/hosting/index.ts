import "server-only";
import { netlifyHost } from "./netlify";
import { openToken, tokenSecret } from "./oauth";
import { practiceHost } from "./practice";
import { type HostConnection, HostError, type HostProvider } from "./types";

export { netlifyApp } from "./oauth";
export { siteNameFor } from "./practice";
export * from "./types";

// The owner's connected host, or a practice run when there's none
export function hostFor(connection: HostConnection | null): HostProvider {
  if (!connection) return practiceHost();
  const token = openToken(connection.token, tokenSecret());
  if (!token) throw new HostError("Your Netlify connection needs renewing. Connect Netlify again, then publish.", true);
  return netlifyHost(token);
}
