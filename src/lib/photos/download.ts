import { getImageModel } from "@/lib/ai";

// Serving photo files, and whether editing is available

const EXTENSIONS: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

export function photoFileName(title: string, version: { number: number; simulated: boolean } | null): string {
  if (!version) return `${title} - original`;
  return `${title} - version ${version.number}${version.simulated ? " - practice preview" : ""}`;
}

// Private, never cached or sniffed, and unable to run anything on this site
export function photoResponse(file: { name: string; mimeType: string; data: Uint8Array }, inline: boolean): Response {
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

export function notFoundResponse(): Response {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });
}

// ASCII fallback plus the full UTF-8 name for browsers that read filename*
export function disposition(type: "inline" | "attachment", name: string, extension: string): string {
  const base = Array.from(name.toWellFormed().replace(/[\u0000-\u001f\u007f]/g, "").trim() || "photo").slice(0, 150).join("");
  const ascii =
    base
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/["\\/:*?<>|;%]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100) || "photo";
  const encoded = encodeURIComponent(`${base}${extension}`).replace(/['()*!]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}${extension}"; filename*=UTF-8''${encoded}`;
}

export type PhotoEditing = { state: "ready"; model: string } | { state: "practice" } | { state: "unavailable" };

// "unavailable": the configured provider has no photo editing, or its settings are incomplete
export function photoEditing(): PhotoEditing {
  try {
    const model = getImageModel();
    if (!model) return { state: "unavailable" };
    return model.simulated ? { state: "practice" } : { state: "ready", model: model.model };
  } catch {
    return { state: "unavailable" };
  }
}
