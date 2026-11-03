import { afterEach, expect, it, vi } from "vitest";
import { retrieveProductPhoto, squareImageUrl } from "./images";
import type { SquareItem } from "./client";

afterEach(() => vi.unstubAllGlobals());
it("accepts Square image storage and rejects private or redirected sources", () => {
  expect(squareImageUrl("https://items-images-staging.s3.us-west-2.amazonaws.com/a.jpg")).not.toBeNull();
  expect(squareImageUrl("https://cdn.editmysite.com/a.jpg")).not.toBeNull();
  for (const url of ["http://cdn.editmysite.com/a", "https://localhost/a", "https://evil.com/a", "https://cdn.editmysite.com.evil.com/a", "https://user@cdn.editmysite.com/a", "https://cdn.editmysite.com:8443/a"]) expect(squareImageUrl(url)).toBeNull();
});
it("does not fetch for products with no images", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect(await retrieveProductPhoto("token", { item_data: {} } as SquareItem)).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
