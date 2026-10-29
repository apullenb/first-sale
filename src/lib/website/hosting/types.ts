import { OwnerFacingError } from "@/lib/errors";
import type { SiteFile } from "@/lib/website/site/bundle";

// Where the built site goes online. Every host does the same: make the site once, upload the files, report the address.

export const HOST_PROVIDERS = ["netlify", "practice"] as const;
export type HostProviderId = (typeof HOST_PROVIDERS)[number];

export interface PublishTarget {
  // Null the first time; later publishes update the same site
  siteId: string | null;
  // The address name the owner would like, such as "rise-bakery"
  siteName: string;
  // Called as soon as a new site exists, before uploading
  onCreated?: (site: { siteId: string; siteName: string }) => Promise<void>;
}

export interface PublishResult {
  siteId: string;
  siteName: string;
  url: string;
  // The host's own page for this site, for the web address and settings
  adminUrl: string | null;
  deployId: string | null;
  // "processing" while the host is still putting it online
  state: "ready" | "processing";
}

export interface HostProvider {
  id: HostProviderId;
  name: string;
  // A practice run: nothing goes online
  simulated: boolean;
  publish(files: SiteFile[], target: PublishTarget): Promise<PublishResult>;
  // Whether a deploy that was still processing is live yet
  check?(deployId: string): Promise<PublishResult["state"]>;
}

// Saved with the website plan after each publish. "failed": the site exists but the last publish didn't go live.
export interface HostingState extends Omit<PublishResult, "state"> {
  state: PublishResult["state"] | "failed";
  provider: HostProviderId;
  simulated: boolean;
  publishedAt: string;
  // The version that went out, so the page can tell when there are newer changes
  hash: string;
}

// The owner's connection to a host; the token is stored encrypted
export interface HostConnection {
  provider: "netlify";
  token: string;
  connectedAt: string;
}

// A host problem the owner can act on; reconnect: the saved connection stopped working
export class HostError extends OwnerFacingError {
  constructor(
    message: string,
    readonly reconnect = false,
  ) {
    super(message);
  }
}
