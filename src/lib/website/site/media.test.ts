import { afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { imagePreview } from "./media";
import { GET } from "@/app/(app)/website/image/route";
import { getMyLibraryFile } from "@/lib/data/my-business";

vi.mock("@/lib/data/my-business", () => ({ getMyBrandAssetFile: vi.fn(), getMyLibraryFile: vi.fn(), getMyPhotoFile: vi.fn(), getMyPhotoVersionFile: vi.fn(), getMyItemPictureFile: vi.fn() }));
afterEach(() => vi.resetAllMocks());
it("makes small previews without changing the source image", async () => {
  const original = await sharp({ create: { width: 1200, height: 600, channels: 3, background: "#224433" } }).png().toBuffer();
  const before = Buffer.from(original);
  const thumbnail = await imagePreview(original, 320);
  expect(await sharp(thumbnail).metadata()).toMatchObject({ width: 320, height: 160, format: "webp" });
  expect(original).toEqual(before);
});
it("checks ownership even on conditional requests and never makes previews public-cacheable", async () => {
  const data = await sharp({ create: { width: 500, height: 500, channels: 3, background: "#eeddbc" } }).png().toBuffer();
  vi.mocked(getMyLibraryFile).mockResolvedValue({ title: "Header", mimeType: "image/png", data });
  const response = await GET(new Request("http://localhost/website/image?key=library:mine"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("private");
  expect(response.headers.get("content-type")).toBe("image/webp");
  expect((await sharp(new Uint8Array(await response.arrayBuffer())).metadata()).width).toBe(320);
  const etag = response.headers.get("etag")!;
  const cached = await GET(new Request("http://localhost/website/image?key=library:mine", { headers: { "if-none-match": etag } }));
  expect(cached.status).toBe(304);
  vi.mocked(getMyLibraryFile).mockResolvedValue(null);
  const denied = await GET(new Request("http://localhost/website/image?key=library:someone-elses", { headers: { "if-none-match": etag } }));
  expect(denied.status).toBe(404);
  expect(getMyLibraryFile).toHaveBeenCalledTimes(3);
});
