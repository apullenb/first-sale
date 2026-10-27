import { disposition } from "@/lib/photos/download";
import { EXTENSIONS } from "./files";

// Private, never cached or sniffed, and unable to run anything on this site
export function brandFileResponse(file: { name: string; mimeType: string; data: Uint8Array }, inline: boolean): Response {
  const body = file.data.slice();
  return new Response(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": disposition(inline ? "inline" : "attachment", file.name, EXTENSIONS[file.mimeType] ?? ""),
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "sandbox; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
