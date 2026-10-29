import type { HostingState, HostProvider, PublishTarget } from "./types";

// Which site a publish updates: the last site on the same host, even one whose first publish failed.
// A string is a reason not to publish.
export function publishTarget(host: Pick<HostProvider, "id" | "simulated">, previous: HostingState | null, name: string): Omit<PublishTarget, "onCreated"> | string {
  // A practice run never replaces a real site's record
  if (host.simulated && previous && !previous.simulated) return "Your site is on Netlify. Connect Netlify again to publish your changes.";
  if (previous && previous.provider === host.id) return { siteId: previous.siteId, siteName: previous.siteName };
  return { siteId: null, siteName: name };
}
