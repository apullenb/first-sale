import type { HostProvider } from "./types";

// Practice mode: runs every publishing check, then stops. Nothing is uploaded and no site is made.
export function practiceHost(): HostProvider {
  return {
    id: "practice",
    name: "Practice run",
    simulated: true,
    async publish(_files, target) {
      return {
        siteId: target.siteId ?? `practice-${target.siteName}`,
        siteName: target.siteName,
        // Where it would go on Netlify; never opened as if it were live
        url: `https://${target.siteName}.netlify.app`,
        adminUrl: null,
        deployId: null,
        state: "ready",
      };
    },
  };
}

// Letters, digits and single dashes, from the web address the owner picked or the business name
export function siteNameFor(businessName: string | null, domain: string | null): string {
  const base = domain ? domain.split(".")[0] : (businessName ?? "");
  const slug = base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug || "my-business";
}
