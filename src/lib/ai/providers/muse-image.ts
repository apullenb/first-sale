import { ImageEditError, type ImageEditRequest, type ImageModel } from "../image-types";

export interface MuseImageConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

interface WireImagesResponse {
  data?: { b64_json?: string | null; url?: string | null }[];
  output_format?: string;
}

interface WireError {
  error?: { message?: string; code?: string | null; type?: string };
}

// Single-shot edits on /v1/images/edits with Meta's JSON body (https://dev.meta.ai/docs/image-generation).
// Built-in image and web search are off, so the owner's photo stays the only picture of the product.
export function createMuseImageProvider(config: MuseImageConfig): ImageModel {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/images/edits`;
  const name = "Meta Muse Image";

  return {
    name,
    model: config.model,
    simulated: false,

    async edit(request) {
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildEditBody(config.model, request)),
          signal: AbortSignal.timeout(request.timeoutMs ?? config.timeoutMs ?? 180_000),
        });
      } catch (error) {
        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        const reason = error instanceof Error ? error.message : String(error);
        throw new ImageEditError(`${name} request failed: ${reason}`, null, true, null, timedOut);
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new ImageEditError(
          `${name} returned ${response.status}: ${text.slice(0, 500)}`,
          response.status,
          response.status === 408 || response.status === 429 || response.status >= 500,
          errorCode(text),
        );
      }

      let body: WireImagesResponse;
      try {
        body = (await response.json()) as WireImagesResponse;
      } catch {
        throw new ImageEditError(`${name} returned a non-JSON body`, response.status, true);
      }
      const encoded = body.data?.[0]?.b64_json;
      if (!encoded) throw new ImageEditError(`${name} returned no image`, response.status, true);
      const data = new Uint8Array(Buffer.from(encoded, "base64"));
      if (data.byteLength === 0) throw new ImageEditError(`${name} returned an empty image`, response.status, true);
      return { data, format: body.output_format ?? null };
    },
  };
}

function errorCode(text: string): string | null {
  try {
    return (JSON.parse(text) as WireError).error?.code ?? null;
  } catch {
    return null;
  }
}

export function buildEditBody(model: string, request: ImageEditRequest): Record<string, unknown> {
  if (request.images.length === 0) throw new Error("An image edit needs at least one image");
  const body: Record<string, unknown> = {
    model,
    prompt: request.instruction,
    images: request.images.map((image) => ({
      image_url: `data:${image.mimeType};base64,${Buffer.from(image.data).toString("base64")}`,
    })),
    n: 1,
    response_format: "b64_json",
    output_format: request.format ?? "png",
    tool_enablement: { enable_image_search: false, enable_web_search: false, enable_shell: false },
  };
  if (request.size) body.size = request.size;
  if (request.userKey) body.user = request.userKey;
  return body;
}
