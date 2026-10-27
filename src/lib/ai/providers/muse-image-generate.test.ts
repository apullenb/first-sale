import { afterEach, describe, expect, it, vi } from "vitest";
import { imageInfo } from "@/lib/photos/image-info";
import { ImageEditError } from "../image-types";
import { createMockImageProvider } from "./mock-image";
import { buildGenerateBody, createMuseImageProvider } from "./muse-image";

afterEach(() => vi.unstubAllGlobals());

describe("the Muse Image generation request", () => {
  it("asks for one image from the prompt, with built-in search off", () => {
    expect(buildGenerateBody("muse-image-1.0", { prompt: "A logo", size: "1536x1024", userKey: "abc" })).toEqual({
      model: "muse-image-1.0",
      prompt: "A logo",
      n: 1,
      response_format: "b64_json",
      output_format: "png",
      tool_enablement: { enable_image_search: false, enable_web_search: false, enable_shell: false },
      size: "1536x1024",
      user: "abc",
    });
  });

  it("refuses an empty prompt before paying for anything", () => {
    expect(() => buildGenerateBody("muse-image-1.0", { prompt: "  " })).toThrow();
  });

  it("posts to /images/generations and returns the bytes it sent back", async () => {
    const result = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);
    const fetchMock = vi.fn(async () => Response.json({ created: 1, data: [{ b64_json: Buffer.from(result).toString("base64") }], output_format: "png" }));
    vi.stubGlobal("fetch", fetchMock);
    const model = createMuseImageProvider({ baseUrl: "https://api.meta.ai/v1/", apiKey: "key", model: "muse-image-1.0" });

    expect(await model.generate!({ prompt: "A logo" })).toEqual({ data: result, format: "png" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.meta.ai/v1/images/generations");
    expect(JSON.parse(String(init.body))).toMatchObject({ prompt: "A logo", n: 1 });
  });

  it("passes on content-policy refusals and marks server errors retryable", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: { code: "content_policy_violation" } }, { status: 400 }));
    const model = createMuseImageProvider({ baseUrl: "https://api.meta.ai/v1", apiKey: "key", model: "muse-image-1.0" });
    await expect(model.generate!({ prompt: "x" })).rejects.toMatchObject({ status: 400, code: "content_policy_violation", retryable: false });
    vi.stubGlobal("fetch", async () => Response.json({ error: { type: "server_error" } }, { status: 503 }));
    await expect(model.generate!({ prompt: "x" })).rejects.toBeInstanceOf(ImageEditError);
    await expect(model.generate!({ prompt: "x" })).rejects.toMatchObject({ retryable: true });
  });
});

describe("practice image generation", () => {
  it("returns a blank placeholder in the requested shape, marked as practice", async () => {
    const model = createMockImageProvider();
    expect(model.simulated).toBe(true);
    const result = await model.generate!({ prompt: "A logo", size: "1536x1024" });
    expect(imageInfo(result.data)).toMatchObject({ type: "image/png", width: 1024, height: 683 });
  });
});
