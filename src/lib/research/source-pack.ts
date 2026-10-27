import { z } from "zod";
import { JURISDICTION_LEVELS, US_STATE_CODES } from "@/lib/domain";

export const SOURCE_TOPICS = [
  "business_structure",
  "name_registration",
  "tax_registration",
  "employer_id",
  "licenses_permits",
  "zoning",
  "food_safety",
  "employment",
  // Rules for particular products or activities, such as children's products
  "activity",
] as const;

// Lowercase, at least one dot: "gov" alone would allow every .gov site
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// Hand-picked official pages for one place. Research only reads from these hosts.
export const sourcePackSchema = z.object({
  jurisdiction: z.object({
    level: z.enum(JURISDICTION_LEVELS),
    state: z.enum(US_STATE_CODES).nullable(),
    name: z.string(),
  }),
  allowedHosts: z.array(z.string().regex(HOSTNAME, "Use a lowercase hostname such as irs.gov")).min(1),
  sources: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.url({ protocol: /^https$/ }),
      topics: z.array(z.enum(SOURCE_TOPICS)).min(1),
      // Date the link was last confirmed working and on topic
      lastChecked: z.iso.date(),
    }),
  ),
});
export type SourcePack = z.infer<typeof sourcePackSchema>;

export function isAllowedHost(url: string, allowedHosts: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // Standard https only: no other ports on an approved host
  if (parsed.protocol !== "https:" || parsed.port !== "") return false;
  return allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
}
