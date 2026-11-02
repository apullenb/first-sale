import { describe, expect, it, vi } from "vitest";
import { DemoReadOnlyError } from "@/lib/demo";

const user = vi.hoisted(() => ({ id: "owner-1", name: "Demo Owner", email: "demo@example.test", demo: true }));
vi.mock("@/lib/auth/server", () => ({ getCurrentUser: async () => user }));
// Any call that gets as far as the database fails with this
vi.mock("@/db/client", () => ({
  getDb: () => {
    throw new Error("database touched");
  },
}));

const wrappers = (await import("./my-business")) as unknown as Record<string, unknown>;

// Every write wrapper; a new export must be listed here or in READS
const WRITES = [
  "saveMyFollowUp", "saveMyResearch", "setMyConditionAnswer", "setMyStepStatus", "saveMyDetails", "deleteMyDetail",
  "createMyDocument", "updateMyDocument", "deleteMyDocument", "startMyRun", "finishMyRun",
  "createMyPhoto", "updateMyPhoto", "deleteMyPhoto", "addMyPhotoVersion", "setMyPhotoVersionReview", "approveMyPhotoVersion",
  "saveMyWebsitePlan", "updateMyWebsitePlan", "updateMyMarketing",
  "saveMyBrandBrief", "createMyBrandRound", "addMyBrandAsset", "setMyBrandAssetCheck", "chooseMyLogo", "unchooseMyLogo",
  "pickMyBrandFile", "setMyImageMedium", "unpickMyBrandFile", "clearMyBrandIdeas", "addMyUploadedLogo", "setMyOwnLogoColors",
  "deleteMyOwnLogo", "addMyLibraryFile", "deleteMyLibraryFile",
  "addMySuggestedItems", "setMyItemDescription", "addMyItemPicture", "approveMyItemPicture", "deleteMyItemPicture",
  "setMyItemWearer", "deleteMyUnusedItemPictures", "saveMyPriceCheck", "createMyProduct", "updateMyProduct", "deleteMyProduct",
  "saveMyIntakeDraft", "deleteMyIntakeDraft", "createMyBusinessFromIntake", "updateMyProfileWithHistory", "recordMyDecisions",
  "replanMyPlan", "saveMyStructureAdvice", "saveMyInsights", "markMyInsight", "setMyJourneyMark", "clearMyJourneyMark",
  "saveMyOperationSetup", "pauseMyOperationSetup",
];

const READS = [
  "getMyBusiness", "getMyResearch", "myAiKey", "getMyPlan", "getMyResearchBasis", "listMyConditionAnswers", "paperworkContext",
  "getMyPaperwork", "getMyStep", "getMyDetails", "listMyDocuments", "getMyDocument", "getMyDocumentFile", "lastMyRun",
  "listMyPhotos", "getMyPhoto", "getMyPhotoFile", "getMyPhotoVersionFile", "findMyPhotoVersionByRequest", "myPhotoVersionRoom",
  "listMyPhotoLibrary", "getMyWebsitePlan", "getMyMarketing", "getMyBrandState", "getMyBrand", "findMyBrandRoundByRequest",
  "getMyBrandRound", "getMyBrandConcept", "findMyBrandAssetByRequest", "myBrandAssetRoom", "getMyBrandAsset", "getMyBrandAssetFile",
  "listMyLibraryFiles", "getMyLibraryFile", "myLibraryUsage", "listMyProducts", "listMyItems", "getMyProduct", "listMyItemPictures",
  "getMyItemPictureFile", "findMyItemPictureByRequest", "myItemPictureRoom", "listMyPriceChecks", "getMyIntakeDraft",
  "listMyHistory", "getMyStructureAdvice", "getMyInsights", "listMyJourneyMarks", "getMySidebarFacts", "listMyOperationSetups",
];

type Call = (...args: unknown[]) => Promise<unknown>;
const call = (name: string) => (wrappers[name] as Call)("x", "y", "z");

describe("data wrappers for a demo session", () => {
  it("lists every export as a read or a write", () => {
    const exported = Object.keys(wrappers).filter((name) => typeof wrappers[name] === "function");
    expect([...WRITES, ...READS].sort()).toEqual(exported.sort());
  });

  it.each(WRITES)("%s refuses before reaching the database", async (name) => {
    await expect(call(name)).rejects.toBeInstanceOf(DemoReadOnlyError);
  });

  it.each(READS.filter((name) => name !== "paperworkContext"))("%s still reads", async (name) => {
    const outcome = await call(name).catch((error: unknown) => error);
    expect(outcome).not.toBeInstanceOf(DemoReadOnlyError);
  });

  it("lets the same writes through for a normal session", async () => {
    user.demo = false;
    try {
      await expect(call("saveMyDetails")).rejects.toThrow("database touched");
    } finally {
      user.demo = true;
    }
  });
});
