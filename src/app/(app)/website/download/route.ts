import { notFoundResponse } from "@/lib/photos/download";
import { publishReadiness } from "@/lib/website/site/ready";
import { zipFiles } from "@/lib/website/site/zip";
import { loadSite, publishCheck, siteFiles } from "../site-data";

// The approved site as a .zip, for owners who put it online themselves
export async function GET() {
  const site = await loadSite();
  if (!site) return notFoundResponse();
  // Same checks as publishing, since the owner puts this online themselves
  const readiness = publishReadiness(publishCheck(site));
  if (readiness.blockers.length) {
    return new Response(`Your site isn’t ready yet:\n\n${readiness.blockers.join("\n")}\n\nGo back to the Website page to finish it.`, {
      status: 409,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }
  const bundle = await siteFiles(site);
  if (!bundle) return notFoundResponse();
  const zip = zipFiles(bundle.files);
  const name = `${site.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "my"}-website.zip`;
  return new Response(zip.slice(), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zip.byteLength),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
