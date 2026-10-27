import type { NextRequest } from "next/server";
import { getMyDocumentFile } from "@/lib/data/my-business";

const EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "text/plain": ".txt",
};
const VIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

// Signed-out visitors are sent to log in by getMyDocumentFile
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.length > 60) return notFound();
  const file = await getMyDocumentFile(id);
  if (!file) return notFound();

  const inline = request.nextUrl.searchParams.get("view") === "1" && VIEWABLE.has(file.mimeType);
  const body = file.data.slice();

  return new Response(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": disposition(inline ? "inline" : "attachment", file.title, EXTENSIONS[file.mimeType] ?? ""),
      "Cache-Control": "private, no-store",
      // Matches next.config.ts, whose headers win: the browser's PDF viewer won't open in a sandboxed page
      "Content-Security-Policy": inline ? "frame-ancestors 'none'" : "sandbox; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });
}

// ASCII fallback plus the full UTF-8 name for browsers that read filename*
function disposition(type: "inline" | "attachment", title: string, extension: string): string {
  const base = Array.from(title.toWellFormed().replace(/[\u0000-\u001f\u007f]/g, "").trim() || "document").slice(0, 150).join("");
  const ascii =
    base
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/["\\/:*?<>|;%]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100) || "document";
  const encoded = encodeURIComponent(`${base}${extension}`).replace(/['()*!]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}${extension}"; filename*=UTF-8''${encoded}`;
}
