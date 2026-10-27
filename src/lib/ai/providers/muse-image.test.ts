import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageEditError } from "../image-types";
import { getImageModel, MUSE_IMAGE_DEFAULTS } from "../registry";
import { buildEditBody, createMuseImageProvider } from "./muse-image";

const original = { mimeType: "image/jpeg", data: new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]) };
const draft = { mimeType: "image/png", data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9]) };

afterEach(() => vi.unstubAllGlobals());

describe("the Muse Image edit request", () => {
  it("sends the images in order as data URLs, with built-in search off", () => {
    const body = buildEditBody("muse-image-1.0", { instruction: "Edit it", images: [original, draft], size: "1024x1280", userKey: "abc" });
    expect(body).toEqual({
      model: "muse-image-1.0",
      prompt: "Edit it",
      images: [
        { image_url: `data:image/jpeg;base64,${Buffer.from(original.data).toString("base64")}` },
        { image_url: `data:image/png;base64,${Buffer.from(draft.data).toString("base64")}` },
      ],
      n: 1,
      response_format: "b64_json",
      output_format: "png",
      tool_enablement: { enable_image_search: false, enable_web_search: false, enable_shell: false },
      size: "1024x1280",
      user: "abc",
    });
  });

  it("refuses an edit with no image", () => {
    expect(() => buildEditBody("muse-image-1.0", { instruction: "x", images: [] })).toThrow();
  });

  it("posts to /images/edits and returns the bytes it sent back", async () => {
    const result = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7]);
    const fetchMock = vi.fn(async () =>
      Response.json({ created: 1, data: [{ b64_json: Buffer.from(result).toString("base64") }], output_format: "png" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const model = createMuseImageProvider({ baseUrl: "https://api.meta.ai/v1/", apiKey: "key", model: "muse-image-1.0" });

    const edited = await model.edit({ instruction: "Edit it", images: [original] });
    expect(edited).toEqual({ data: result, format: "png" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.meta.ai/v1/images/edits");
    expect(init.headers).toMatchObject({ Authorization: "Bearer key", "Content-Type": "application/json" });
  });

  it("passes on the provider's error code, such as a content-policy refusal", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ error: { type: "invalid_request_error", code: "content_policy_violation", message: "no" } }, { status: 400 }),
    );
    const model = createMuseImageProvider({ baseUrl: "https://api.meta.ai/v1", apiKey: "key", model: "muse-image-1.0" });
    const error = await model.edit({ instruction: "x", images: [original] }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ImageEditError);
    expect(error).toMatchObject({ status: 400, code: "content_policy_violation", retryable: false });
  });

  it("marks busy and server errors retryable, and a reply without an image as a failure", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: { type: "server_error" } }, { status: 503 }));
    const model = createMuseImageProvider({ baseUrl: "https://api.meta.ai/v1", apiKey: "key", model: "muse-image-1.0" });
    await expect(model.edit({ instruction: "x", images: [original] })).rejects.toMatchObject({ status: 503, retryable: true });

    vi.stubGlobal("fetch", async () => Response.json({ created: 1, data: [] }));
    await expect(model.edit({ instruction: "x", images: [original] })).rejects.toThrow(/no image/);
  });

  it("says when the request timed out", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    const model = createMuseImageProvider({ baseUrl: "https://api.meta.ai/v1", apiKey: "key", model: "muse-image-1.0" });
    await expect(model.edit({ instruction: "x", images: [original] })).rejects.toMatchObject({ timedOut: true, status: null });
  });
});

describe("picking the image model", () => {
  it("uses a labeled practice preview without a provider, which returns the first image unchanged", async () => {
    const model = getImageModel({});
    expect(model?.simulated).toBe(true);
    const result = await model!.edit({ instruction: "x", images: [original, draft] });
    expect(result.data).toEqual(original.data);
  });

  it("uses Muse Image with Muse, defaulting to muse-image-1.0", () => {
    expect(getImageModel({ AI_PROVIDER: "muse", MUSE_API_KEY: "key" })).toMatchObject({ simulated: false, model: MUSE_IMAGE_DEFAULTS.model });
    expect(getImageModel({ AI_PROVIDER: "muse", MUSE_API_KEY: "key", MUSE_IMAGE_MODEL: "muse-image-2.0" })?.model).toBe("muse-image-2.0");
    expect(() => getImageModel({ AI_PROVIDER: "muse" })).toThrow(/MUSE_API_KEY/);
  });

  it("has no photo editing for other providers, and never falls back to practice in production", () => {
    expect(getImageModel({ AI_PROVIDER: "openai-compatible" })).toBeNull();
    expect(() => getImageModel({ NODE_ENV: "production" })).toThrow(/AI_PROVIDER/);
  });

  it("refuses contributor models unless allowed", () => {
    expect(() => getImageModel({ AI_PROVIDER: "muse", MUSE_API_KEY: "key", MUSE_IMAGE_MODEL: "muse-image-1.0-contributor" })).toThrow(/training/);
  });
});
