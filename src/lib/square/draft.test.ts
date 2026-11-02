import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { draftSquareDescription } from "./draft";
import type { SquareItem } from "./client";

const item: SquareItem = { id: "C", type: "ITEM", version: 1, item_data: { name: "Lavender candle", description_plaintext: "Handmade soy candle." } };
describe("Square description drafting", () => {
  it("registers an offline fixture and labels its result as simulated", async () => {
    expect(await draftSquareDescription(createMockProvider(), item, "Make it warmer", "owner")).toEqual({ description: "Handmade soy candle.", simulated: true });
  });
  it("rejects unsupported model claims at a fixed code checkpoint", async () => {
    const model = createMockProvider(() => JSON.stringify({ description: "Organic soy candle." }));
    await expect(draftSquareDescription(model, item, "Make it warmer", "owner")).rejects.toThrow();
  });
});
