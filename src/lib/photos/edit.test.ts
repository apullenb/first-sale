import { beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { getImageModel, ImageEditError, type ImageEditRequest, type ImageModel, type ModelProvider } from "@/lib/ai";
import { createBusinessForOwner } from "@/lib/data/businesses";
import {
  addPhotoVersionForOwner,
  createPhotoForOwner,
  findPhotoVersionByRequestForOwner,
  getPhotoFileForOwner,
  getPhotoForOwner,
  getPhotoVersionFileForOwner,
  PHOTO_LIMITS,
  photoVersionRoomForOwner,
  setPhotoVersionReviewForOwner,
} from "@/lib/data/product-photos";
import { OwnerFacingError } from "@/lib/errors";
import { createTestDb } from "@/test/db";
import { testProfile } from "@/test/fixtures";
import { makePhotoVersion, type MakeVersionInput, type VersionStore } from "./edit";
import { pngBytes } from "./test-images";
import type { PhotoCheck } from "./types";
import { changesFor } from "./versions";

let db: Awaited<ReturnType<typeof createTestDb>>;
let photoId: string;
const original = pngBytes(640, 480, 90);

const check: PhotoCheck = {
  checkedAt: "2026-10-27T00:00:00.000Z",
  method: "ai",
  simulated: false,
  usable: true,
  problems: [],
  retakeTips: [],
  summary: "A ceramic mug",
  category: "handmade",
  objects: [{ name: "mug", likelyForSale: true }],
  keep: { colors: ["blue"], materials: ["ceramic"], textAndLogos: [], quantity: "one", details: [] },
  question: null,
};

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([{ id: "owner-a", name: "Owner A", email: "a@example.test" }]);
  await createBusinessForOwner(db, "owner-a", { profile: testProfile() });
  const created = await createPhotoForOwner(db, "owner-a", { title: "Mug", mimeType: "image/png", sha256: "x", width: 640, height: 480, data: original });
  if (!created.ok) throw new Error("setup");
  photoId = created.id;
});

function store(): VersionStore {
  return {
    findByRequest: (key) => findPhotoVersionByRequestForOwner(db, "owner-a", photoId, key),
    room: () => photoVersionRoomForOwner(db, "owner-a", photoId),
    add: (version) => addPhotoVersionForOwner(db, "owner-a", photoId, version),
    setReview: async (versionId, review) => {
      await setPhotoVersionReviewForOwner(db, "owner-a", versionId, review);
    },
  };
}

// Records every paid request; each reply is an image, or an error to throw
function imageModel(replies: (Uint8Array | Error)[]) {
  const calls: ImageEditRequest[] = [];
  const model: ImageModel = {
    name: "Test image model",
    model: "test-image",
    simulated: false,
    async edit(request) {
      calls.push(request);
      const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
      if (reply instanceof Error) throw reply;
      return { data: reply, format: "png" };
    },
  };
  return { model, calls };
}

function visionModel(reply: () => string) {
  const calls: unknown[] = [];
  const model: ModelProvider = {
    name: "Test vision",
    model: "test-vision",
    capabilities: { vision: true, pdf: false, jsonSchema: true, reasoningEffort: false, webSearch: false },
    simulated: false,
    async complete(request) {
      calls.push(request);
      return { text: reply(), finishReason: "stop", usage: null };
    },
  };
  return { model, calls };
}

const noFlags = () => visionModel(() => JSON.stringify({ flags: [] }));

function input(overrides: Partial<MakeVersionInput> = {}): MakeVersionInput {
  return {
    requestKey: crypto.randomUUID(),
    original: { mimeType: "image/png", data: original },
    photo: { category: "handmade", check, forSale: ["mug"], answer: null },
    look: "studio",
    crop: "square",
    parent: null,
    refinement: null,
    now: new Date("2026-10-27T12:00:00Z"),
    ...overrides,
  };
}

async function versions() {
  return (await getPhotoForOwner(db, "owner-a", photoId))?.versions ?? [];
}

async function refineInput(parentId: string, refinement: string): Promise<MakeVersionInput> {
  const parent = await getPhotoVersionFileForOwner(db, "owner-a", photoId, parentId);
  const all = await versions();
  const record = all.find((version) => version.id === parentId)!;
  return input({
    look: record.look,
    crop: record.crop,
    parent: { id: parentId, image: { mimeType: parent!.mimeType, data: parent!.data }, changes: changesFor(all, parentId) },
    refinement,
  });
}

describe("product reference", () => {
  it("sends the original upload as image 1 on every edit, including refinements of refinements", async () => {
    const first = pngBytes(1024, 1024, 10);
    const second = pngBytes(1024, 1024, 20);
    const third = pngBytes(1024, 1024, 30);
    const image = imageModel([first, second, third]);
    const models = { image: image.model, vision: noFlags().model };

    const v1 = await makePhotoVersion(models, store(), input());
    const v2 = await makePhotoVersion(models, store(), await refineInput(v1, "Make the background ivory"));
    await makePhotoVersion(models, store(), await refineInput(v2, "Remove the props"));

    expect(image.calls).toHaveLength(3);
    for (const call of image.calls) {
      expect(call.images[0]).toEqual({ mimeType: "image/png", data: original });
      expect(call.instruction).toContain("Image 1 is the owner’s own photo of the exact item they sell");
    }
    expect(image.calls[0].images).toHaveLength(1);
    // A refinement also sends the draft it changes, second
    expect(image.calls[1].images[1].data).toEqual(first);
    expect(image.calls[2].images[1].data).toEqual(second);
    expect(image.calls[2].instruction).toMatch(/Make the background ivory[\s\S]*Remove the props/);
  });

  it("asks for the chosen shape and builds the instruction from the look and kind of product", async () => {
    const image = imageModel([pngBytes(1024, 1280)]);
    await makePhotoVersion({ image: image.model, vision: noFlags().model }, store(), input({ look: "white", crop: "portrait" }));
    expect(image.calls[0]).toMatchObject({ size: "1024x1280", format: "png" });
    expect(image.calls[0].instruction).toContain("plain, evenly lit white background");
    expect(image.calls[0].instruction).toContain("grain, finish, small irregularities");
  });
});

describe("saving versions", () => {
  it("keeps the original unchanged and saves the returned bytes as they came, with the size read from them", async () => {
    const returned = pngBytes(1024, 1280, 200);
    const id = await makePhotoVersion({ image: imageModel([returned]).model, vision: noFlags().model }, store(), input({ crop: "portrait" }));

    expect((await getPhotoFileForOwner(db, "owner-a", photoId))?.data).toEqual(original);
    expect((await getPhotoVersionFileForOwner(db, "owner-a", photoId, id))?.data).toEqual(returned);
    const [version] = await versions();
    expect(version).toMatchObject({ id, number: 1, parentId: null, crop: "portrait", width: 1024, height: 1280, mimeType: "image/png", simulated: false, model: "test-image" });
  });

  it("links each refinement to the version it changed", async () => {
    const image = imageModel([pngBytes(1024, 1024, 1), pngBytes(1024, 1024, 2)]);
    const models = { image: image.model, vision: noFlags().model };
    const v1 = await makePhotoVersion(models, store(), input());
    const v2 = await makePhotoVersion(models, store(), await refineInput(v1, "Make the background ivory"));
    const all = await versions();
    expect(all.map((version) => [version.number, version.parentId, version.refinement])).toEqual([
      [1, null, null],
      [2, v1, "Make the background ivory"],
    ]);
    expect(changesFor(all, v2)).toEqual(["Make the background ivory"]);
  });

  it("saves the comparison's flags for the owner's review", async () => {
    const vision = visionModel(() => JSON.stringify({ flags: [{ kind: "text_or_logo", detail: "The maker's mark is missing" }] }));
    const id = await makePhotoVersion({ image: imageModel([pngBytes(1024, 1024)]).model, vision: vision.model }, store(), input());
    expect(vision.calls).toHaveLength(1);
    expect((await versions()).find((version) => version.id === id)?.review).toMatchObject({
      method: "ai",
      flags: [{ kind: "text_or_logo", detail: "The maker's mark is missing" }],
    });
  });

  it("keeps a paid photo even when the comparison fails", async () => {
    const vision = visionModel(() => "not json");
    const id = await makePhotoVersion({ image: imageModel([pngBytes(1024, 1024)]).model, vision: vision.model }, store(), input());
    expect((await versions()).find((version) => version.id === id)?.review?.method).toBe("failed");
  });
});

describe("failed edits and retries", () => {
  it("saves nothing when an edit fails, and a retry of the same request works without paying twice", async () => {
    const image = imageModel([new ImageEditError("Muse Image returned 503", 503, true), pngBytes(1024, 1024)]);
    const models = { image: image.model, vision: noFlags().model };
    const request = input();

    const failure = await makePhotoVersion(models, store(), request).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(OwnerFacingError);
    expect((failure as Error).message).toContain("no new version was saved");
    expect(await versions()).toHaveLength(0);

    const id = await makePhotoVersion(models, store(), request);
    expect(await versions()).toHaveLength(1);
    expect(image.calls).toHaveLength(2);

    // The same request again, as after a lost connection: no new paid edit
    expect(await makePhotoVersion(models, store(), request)).toBe(id);
    expect(image.calls).toHaveLength(2);
    expect(await versions()).toHaveLength(1);
  });

  it("saves nothing when the reply isn't a usable photo", async () => {
    const image = imageModel([new TextEncoder().encode("<html>oops</html>")]);
    await expect(makePhotoVersion({ image: image.model, vision: noFlags().model }, store(), input())).rejects.toThrow(/isn’t a usable photo/);
    expect(await versions()).toHaveLength(0);
  });

  it("turns refusals, timeouts and busy errors into plain messages", async () => {
    const cases: [ImageEditError, RegExp][] = [
      [new ImageEditError("x", 400, false, "content_policy_violation"), /wouldn’t edit this photo/],
      [new ImageEditError("x", null, true, null, true), /took too long/],
      [new ImageEditError("x", 429, true), /busy/],
    ];
    for (const [error, message] of cases) {
      const attempt = makePhotoVersion({ image: imageModel([error]).model, vision: noFlags().model }, store(), input());
      await expect(attempt).rejects.toThrow(message);
    }
    expect(await versions()).toHaveLength(0);
  });

  it("leaves setup problems for the workflow runner to log", async () => {
    const error = new ImageEditError("Muse Image returned 401", 401, false);
    await expect(makePhotoVersion({ image: imageModel([error]).model, vision: noFlags().model }, store(), input())).rejects.toBe(error);
  });

  it("stops before paying when the photo has no room for another version", async () => {
    for (let index = 0; index < PHOTO_LIMITS.versionsPerPhoto; index++) {
      const added = await addPhotoVersionForOwner(db, "owner-a", photoId, {
        requestKey: `k${index}`,
        parentId: null,
        look: "studio",
        crop: "square",
        refinement: null,
        instruction: "x",
        model: "test-image",
        simulated: false,
        mimeType: "image/png",
        data: pngBytes(400, 400),
        width: 400,
        height: 400,
      });
      expect(added.ok).toBe(true);
    }
    const image = imageModel([pngBytes(1024, 1024)]);
    await expect(makePhotoVersion({ image: image.model, vision: noFlags().model }, store(), input())).rejects.toThrow(/as many versions/);
    expect(image.calls).toHaveLength(0);
  });
});

describe("practice mode", () => {
  it("saves a labeled preview that is the original unchanged, and doesn't pretend to compare it", async () => {
    const vision = noFlags();
    const id = await makePhotoVersion({ image: getImageModel({})!, vision: vision.model }, store(), input());
    const [version] = await versions();
    expect(version).toMatchObject({ id, simulated: true, model: "practice-preview", review: { method: "skipped", flags: [] } });
    expect((await getPhotoVersionFileForOwner(db, "owner-a", photoId, id))?.data).toEqual(original);
    expect(vision.calls).toHaveLength(0);
  });
});
