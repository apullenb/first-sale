import type { ImageModel } from "../image-types";

// Practice mode: no image service. Hands back the first image unchanged, so nothing invented is ever shown as an edit.
export function createMockImageProvider(): ImageModel {
  return {
    name: "Practice preview",
    model: "practice-preview",
    simulated: true,
    async edit(request) {
      const first = request.images[0];
      if (!first) throw new Error("An image edit needs at least one image");
      return { data: first.data.slice(), format: null };
    },
  };
}
