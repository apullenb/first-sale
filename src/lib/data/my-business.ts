import "server-only";
import { listOperationSetupsForOwner, saveOperationSetupForOwner, pauseOperationSetupForOwner } from "./operations";
import { cancelOrderForOwner, listOrdersForOwner, type NewOrder, recordOrderForOwner } from "./orders";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/server";
import { assertCanWrite } from "@/lib/demo";
import type { StructureAdvice } from "@/lib/structure/advise";
import type { DetailKey } from "@/lib/details";
import { businessProfileSchema, type BusinessProfile, type TaskStatus } from "@/lib/domain";
import type { FollowUpResult } from "@/lib/research/follow-up";
import { profileKey, type ResearchResult } from "@/lib/research/requirements";
import type { WorkflowId } from "@/lib/workflows";
import { getBusinessForOwner } from "./businesses";
import { deleteDetailForOwner, getDetailsForOwner, saveDetailsForOwner } from "./details";
import {
  createDocumentForOwner,
  type DocumentPatch,
  deleteDocumentForOwner,
  getDocumentFileForOwner,
  getDocumentForOwner,
  listDocumentsForOwner,
  type NewDocument,
  updateDocumentForOwner,
} from "./documents";
import { getPlanForOwner, getStepForOwner, replanForOwner, setStepStatusForOwner } from "./plan";
import { getResearchBasisForOwner, getResearchForOwner, type ResearchBasis, type ResearchSnapshot, saveFollowUpForOwner, saveResearchForOwner } from "./research";
import { listConditionAnswersForOwner, setConditionAnswerForOwner } from "./condition-answers";
import {
  getWebsitePlanForOwner,
  saveWebsitePlanForOwner,
  updateWebsitePlanForOwner,
  type WebsitePatch,
  type WebsitePlan,
} from "./website";
import { finishRun, lastRunForOwner, startRunForOwner } from "./workflow-runs";
import { clearJourneyMarkForOwner, listJourneyMarksForOwner, setJourneyMarkForOwner } from "./journey";
import { getSidebarFactsForOwner } from "./sidebar";
import { getMarketingForOwner, type MarketingPatch, type MarketingRecord, updateMarketingForOwner } from "./marketing";
import type { NewBrandAsset } from "@/lib/brand/generate";
import type { AssetCheck, BrandBrief, BrandImageKind, BrandKit, ImageMedium, PaletteColor, VersionKind } from "@/lib/brand/types";
import {
  addAssetForOwner,
  addUploadedLogoForOwner,
  deleteOwnLogoForOwner,
  type NewUploadedLogo,
  setOwnLogoColorsForOwner,
  assetRoomForOwner,
  chooseLogoForOwner,
  clearIdeasForOwner,
  createRoundForOwner,
  findAssetByRequestForOwner,
  findRoundByRequestForOwner,
  getAssetFileForOwner,
  getAssetForOwner,
  getBrandForOwner,
  getBrandKitForOwner,
  getConceptForOwner,
  getRoundForOwner,
  type NewRound,
  pickFileForOwner,
  saveBriefForOwner,
  setAssetCheckForOwner,
  setImageMediumForOwner,
  unchooseLogoForOwner,
  unpickFileForOwner,
} from "./brand";
import type { NewPhotoVersion } from "@/lib/photos/edit";
import type { PhotoReview } from "@/lib/photos/types";
import {
  addPhotoVersionForOwner,
  approvePhotoVersionForOwner,
  createPhotoForOwner,
  deletePhotoForOwner,
  findPhotoVersionByRequestForOwner,
  getPhotoFileForOwner,
  getPhotoForOwner,
  getPhotoVersionFileForOwner,
  listPhotoLibraryForOwner,
  listPhotosForOwner,
  type NewPhoto,
  type PhotoPatch,
  photoVersionRoomForOwner,
  setPhotoVersionReviewForOwner,
  updatePhotoForOwner,
} from "./product-photos";
import type { IntakeDraftInput } from "@/lib/intake/draft-schema";
import type { DecisionBasis } from "@/lib/structure/types";
import { createBusinessWithHistoryForOwner, listHistoryForOwner, updateProfileWithHistoryForOwner, type BusinessEvent } from "./business-history";
import { deleteIntakeDraftForOwner, getIntakeDraftForOwner, saveIntakeDraftForOwner } from "./intake-drafts";
import type { InsightMark, SavedInsights } from "@/lib/insights/types";
import { getInsightsForOwner, markInsightForOwner, saveInsightsForOwner } from "./insights";
import { getStructureAdviceForOwner, saveStructureAdviceForOwner } from "./structure-advice";
import {
  addLibraryFileForOwner,
  deleteLibraryFileForOwner,
  getLibraryFileForOwner,
  libraryUsageForOwner,
  listLibraryFilesForOwner,
  type NewLibraryFile,
} from "./brand-library";
import {
  addPictureForOwner,
  addSuggestedItemsForOwner,
  approvePictureForOwner,
  createProductForOwner,
  deletePictureForOwner,
  deleteProductForOwner,
  deleteUnusedPicturesForOwner,
  findPictureByRequestForOwner,
  getPictureFileForOwner,
  getProductForOwner,
  listPicturesForOwner,
  listPriceChecksForOwner,
  listProductsForOwner,
  pictureRoomForOwner,
  savePriceCheckForOwner,
  setDescriptionForOwner,
  setWearerForOwner,
  updateProductForOwner,
} from "./products";
import type { NewItemPicture } from "@/lib/products/picture";
import type { Wearer } from "@/lib/rules/picture-views";
import type { PriceCheck } from "@/lib/rules/price-compare";
import type { DescriptionAuthor } from "@/lib/rules/products";
import type { ProductValues } from "@/lib/rules/products";
import { type ConditionAnswer, placeOf, structureOf } from "@/lib/research/applicability";
import { choosesStructure, settleStructureChoice } from "@/lib/rules/plan";
import { type Paperwork, type PaperworkContext, paperwork, type SavedAnswer } from "@/lib/rules/paperwork";
import type { PlanStep, PlanView } from "./plan";

// What pages, actions and route handlers call: the owner always comes from the verified session.

// Every write starts here, so a demo session can't change anything
async function writer() {
  const user = await getCurrentUser();
  assertCanWrite(user);
  return user;
}

export interface MyBusiness {
  id: string;
  isDemo: boolean;
  createdAt: Date;
  // Null when the stored answers don't match the current schema; the owner re-answers them
  profile: BusinessProfile | null;
}

function checked(row: { id: string; isDemo: boolean; createdAt: Date; profile: unknown }): MyBusiness {
  const parsed = businessProfileSchema.safeParse(row.profile);
  return { id: row.id, isDemo: row.isDemo, createdAt: row.createdAt, profile: parsed.success ? parsed.data : null };
}

// Null until the owner finishes the intake
export async function getMyBusiness(): Promise<MyBusiness | null> {
  const user = await getCurrentUser();
  const row = await getBusinessForOwner(getDb(), user.id);
  return row ? checked(row) : null;
}

// The last requirements research, or null if it hasn't run
export async function getMyResearch(): Promise<ResearchSnapshot | null> {
  const user = await getCurrentUser();
  return getResearchForOwner(getDb(), user.id);
}

// Saved with the answers it ran on, so the page can tell when they've changed since
export async function saveMyFollowUp(checkedAt: Date, result: FollowUpResult, profile: BusinessProfile, details: readonly { key: string; value: string }[]) {
  const user = await writer();
  return saveFollowUpForOwner(getDb(), user.id, checkedAt, result, profile, details);
}

export async function saveMyResearch(research: ResearchResult, profile: BusinessProfile) {
  const user = await writer();
  return saveResearchForOwner(getDb(), user.id, research, profileKey(profile));
}

// Stable id for the owner that reveals nothing about them, sent with AI requests for the provider's abuse checks
export async function myAiKey(): Promise<string> {
  const user = await getCurrentUser();
  return createHash("sha256").update(`first-sale:${user.id}`).digest("hex").slice(0, 32);
}

// A structure chosen on Business structure, or registered before, settles the plan's step for choosing one
async function structureKnown(ownerId: string, steps: readonly { topic?: string; forStructures?: readonly string[] | null; feeCents?: number | null; status: string }[]) {
  if (!steps.some((step) => choosesStructure(step) && step.status !== "done")) return false;
  const [row, details] = await Promise.all([getBusinessForOwner(getDb(), ownerId), getDetailsForOwner(getDb(), ownerId)]);
  const profile = row ? checked(row).profile : null;
  return Boolean(profile && structureOf(profile, details).structure);
}

export async function getMyPlan() {
  const user = await getCurrentUser();
  const plan = await getPlanForOwner(getDb(), user.id);
  if (!plan) return plan;
  return { ...plan, steps: settleStructureChoice(plan.steps, await structureKnown(user.id, plan.steps)) };
}

export async function getMyResearchBasis() {
  const user = await getCurrentUser();
  return getResearchBasisForOwner(getDb(), user.id);
}

export async function listMyConditionAnswers() {
  const user = await getCurrentUser();
  return listConditionAnswersForOwner(getDb(), user.id);
}

export async function setMyConditionAnswer(input: { stepKey: string; condition: string; answer: ConditionAnswer | null }) {
  const user = await writer();
  return setConditionAnswerForOwner(getDb(), user.id, input);
}

// Until a re-check, what applies follows the answers that were checked; the structure is always the current decision
export function paperworkContext(
  profile: BusinessProfile,
  details: readonly { key: string; value: string }[],
  basis: Pick<ResearchBasis, "profile" | "profileKey"> | null,
  answers: readonly SavedAnswer[],
): PaperworkContext {
  const checkedWith = basis?.profile && basis.profileKey !== profileKey(profile) ? basis.profile : profile;
  return { profile: checkedWith, place: placeOf(checkedWith), decision: structureOf(profile, details), answers };
}

export interface MyPaperwork {
  business: MyBusiness;
  profile: BusinessProfile;
  plan: PlanView;
  details: Awaited<ReturnType<typeof getMyDetails>>;
  basis: ResearchBasis | null;
  context: PaperworkContext;
  view: Paperwork<PlanStep>;
}

// What applies, grouped into paperwork: every page, the menu and Today read it from here, so they count the same tasks
export async function getMyPaperwork(): Promise<MyPaperwork | null> {
  const [business, plan, details, basis, answers] = await Promise.all([getMyBusiness(), getMyPlan(), getMyDetails(), getMyResearchBasis(), listMyConditionAnswers()]);
  if (!business?.profile || !plan) return null;
  const context = paperworkContext(business.profile, details, basis, answers);
  return { business, profile: business.profile, plan, details, basis, context, view: paperwork(plan.steps, context) };
}

export async function getMyStep(stepId: string) {
  const user = await getCurrentUser();
  const found = await getStepForOwner(getDb(), user.id, stepId);
  if (!found) return found;
  const known = await structureKnown(user.id, found.all);
  const all = settleStructureChoice(found.all, known);
  return { step: all.find((step) => step.id === found.step.id) ?? settleStructureChoice([found.step], known)[0], all };
}

export async function setMyStepStatus(input: { stepId: string; status: TaskStatus; note: string | null }) {
  const user = await writer();
  return setStepStatusForOwner(getDb(), user.id, input);
}

export async function getMyDetails() {
  const user = await getCurrentUser();
  return getDetailsForOwner(getDb(), user.id);
}

export async function saveMyDetails(
  values: { key: DetailKey; value: string }[],
  origin: { source: "owner" | "document"; documentId: string | null } = { source: "owner", documentId: null },
) {
  const user = await writer();
  return saveDetailsForOwner(getDb(), user.id, values, origin);
}

export async function deleteMyDetail(key: DetailKey) {
  const user = await writer();
  return deleteDetailForOwner(getDb(), user.id, key);
}

export async function listMyDocuments() {
  const user = await getCurrentUser();
  return listDocumentsForOwner(getDb(), user.id);
}

export async function getMyDocument(id: string) {
  const user = await getCurrentUser();
  return getDocumentForOwner(getDb(), user.id, id);
}

export async function getMyDocumentFile(id: string) {
  const user = await getCurrentUser();
  return getDocumentFileForOwner(getDb(), user.id, id);
}

export async function createMyDocument(input: NewDocument) {
  const user = await writer();
  return createDocumentForOwner(getDb(), user.id, input);
}

export async function updateMyDocument(id: string, patch: DocumentPatch, when?: Parameters<typeof updateDocumentForOwner>[5]) {
  const user = await writer();
  return updateDocumentForOwner(getDb(), user.id, id, patch, new Date(), when);
}

export async function deleteMyDocument(id: string) {
  const user = await writer();
  return deleteDocumentForOwner(getDb(), user.id, id);
}

export async function startMyRun(workflow: WorkflowId, subjectId: string | null) {
  const user = await writer();
  return startRunForOwner(getDb(), user.id, workflow, subjectId);
}

export async function finishMyRun(runId: string, status: "succeeded" | "failed", message: string | null) {
  await writer();
  return finishRun(getDb(), runId, status, message);
}

export async function lastMyRun(workflow: WorkflowId, subjectId: string | null) {
  const user = await getCurrentUser();
  return lastRunForOwner(getDb(), user.id, workflow, subjectId);
}

export async function listMyPhotos() {
  const user = await getCurrentUser();
  return listPhotosForOwner(getDb(), user.id);
}

export async function getMyPhoto(photoId: string) {
  const user = await getCurrentUser();
  return getPhotoForOwner(getDb(), user.id, photoId);
}

export async function getMyPhotoFile(photoId: string) {
  const user = await getCurrentUser();
  return getPhotoFileForOwner(getDb(), user.id, photoId);
}

export async function getMyPhotoVersionFile(photoId: string, versionId: string) {
  const user = await getCurrentUser();
  return getPhotoVersionFileForOwner(getDb(), user.id, photoId, versionId);
}

export async function createMyPhoto(input: NewPhoto) {
  const user = await writer();
  return createPhotoForOwner(getDb(), user.id, input);
}

export async function updateMyPhoto(photoId: string, patch: PhotoPatch) {
  const user = await writer();
  return updatePhotoForOwner(getDb(), user.id, photoId, patch);
}

export async function deleteMyPhoto(photoId: string) {
  const user = await writer();
  return deletePhotoForOwner(getDb(), user.id, photoId);
}

export async function findMyPhotoVersionByRequest(photoId: string, requestKey: string) {
  const user = await getCurrentUser();
  return findPhotoVersionByRequestForOwner(getDb(), user.id, photoId, requestKey);
}

export async function myPhotoVersionRoom(photoId: string) {
  const user = await getCurrentUser();
  return photoVersionRoomForOwner(getDb(), user.id, photoId);
}

export async function addMyPhotoVersion(photoId: string, input: NewPhotoVersion) {
  const user = await writer();
  return addPhotoVersionForOwner(getDb(), user.id, photoId, input);
}

export async function setMyPhotoVersionReview(versionId: string, review: PhotoReview) {
  const user = await writer();
  return setPhotoVersionReviewForOwner(getDb(), user.id, versionId, review);
}

export async function approveMyPhotoVersion(versionId: string, approved: boolean) {
  const user = await writer();
  return approvePhotoVersionForOwner(getDb(), user.id, versionId, approved);
}

export async function listMyPhotoLibrary() {
  const user = await getCurrentUser();
  return listPhotoLibraryForOwner(getDb(), user.id);
}

export async function getMyWebsitePlan() {
  const user = await getCurrentUser();
  return getWebsitePlanForOwner(getDb(), user.id);
}

export async function saveMyWebsitePlan(patch: WebsitePatch) {
  const user = await writer();
  return saveWebsitePlanForOwner(getDb(), user.id, patch);
}

export async function updateMyWebsitePlan(update: (plan: WebsitePlan | null) => WebsitePatch | null) {
  const user = await writer();
  return updateWebsitePlanForOwner(getDb(), user.id, update);
}

// Marketing plan

export async function getMyMarketing() {
  const user = await getCurrentUser();
  return getMarketingForOwner(getDb(), user.id);
}

export async function updateMyMarketing(update: (current: MarketingRecord | null) => MarketingPatch | null) {
  const user = await writer();
  return updateMarketingForOwner(getDb(), user.id, update);
}

// Branding

export async function getMyBrandState() {
  const user = await getCurrentUser();
  return getBrandForOwner(getDb(), user.id);
}

// The approved brand for other sections, such as the website; null until a logo is chosen
export async function getMyBrand(): Promise<BrandKit | null> {
  const user = await getCurrentUser();
  return getBrandKitForOwner(getDb(), user.id);
}

export async function saveMyBrandBrief(brief: BrandBrief) {
  const user = await writer();
  return saveBriefForOwner(getDb(), user.id, brief);
}

export async function createMyBrandRound(input: NewRound) {
  const user = await writer();
  return createRoundForOwner(getDb(), user.id, input);
}

export async function findMyBrandRoundByRequest(requestKey: string) {
  const user = await getCurrentUser();
  return findRoundByRequestForOwner(getDb(), user.id, requestKey);
}

export async function getMyBrandRound(roundId: string) {
  const user = await getCurrentUser();
  return getRoundForOwner(getDb(), user.id, roundId);
}

export async function getMyBrandConcept(conceptId: string) {
  const user = await getCurrentUser();
  return getConceptForOwner(getDb(), user.id, conceptId);
}

export async function findMyBrandAssetByRequest(requestKey: string) {
  const user = await getCurrentUser();
  return findAssetByRequestForOwner(getDb(), user.id, requestKey);
}

export async function myBrandAssetRoom(adding: number) {
  const user = await getCurrentUser();
  return assetRoomForOwner(getDb(), user.id, adding);
}

export async function addMyBrandAsset(input: NewBrandAsset) {
  const user = await writer();
  return addAssetForOwner(getDb(), user.id, input);
}

export async function setMyBrandAssetCheck(assetId: string, check: AssetCheck) {
  const user = await writer();
  return setAssetCheckForOwner(getDb(), user.id, assetId, check);
}

export async function getMyBrandAsset(assetId: string) {
  const user = await getCurrentUser();
  return getAssetForOwner(getDb(), user.id, assetId);
}

export async function getMyBrandAssetFile(assetId: string) {
  const user = await getCurrentUser();
  return getAssetFileForOwner(getDb(), user.id, assetId);
}

export async function chooseMyLogo(assetId: string) {
  const user = await writer();
  return chooseLogoForOwner(getDb(), user.id, assetId);
}

export async function unchooseMyLogo() {
  const user = await writer();
  return unchooseLogoForOwner(getDb(), user.id);
}

// One version or brand image to use, made from the chosen logo
export async function pickMyBrandFile(assetId: string) {
  const user = await writer();
  return pickFileForOwner(getDb(), user.id, assetId);
}

export async function setMyImageMedium(medium: ImageMedium) {
  const user = await writer();
  return setImageMediumForOwner(getDb(), user.id, medium);
}

export async function unpickMyBrandFile(kind: VersionKind | BrandImageKind) {
  const user = await writer();
  return unpickFileForOwner(getDb(), user.id, kind);
}

export async function clearMyBrandIdeas() {
  const user = await writer();
  return clearIdeasForOwner(getDb(), user.id);
}

// The owner's own logo, stored byte for byte and chosen at once
export async function addMyUploadedLogo(input: NewUploadedLogo) {
  const user = await writer();
  return addUploadedLogoForOwner(getDb(), user.id, input);
}

export async function setMyOwnLogoColors(assetId: string, palette: PaletteColor[]) {
  const user = await writer();
  return setOwnLogoColorsForOwner(getDb(), user.id, assetId, palette);
}

// The owner's upload, or an edit of it, with everything made from it
export async function deleteMyOwnLogo(assetId: string) {
  const user = await writer();
  return deleteOwnLogoForOwner(getDb(), user.id, assetId);
}

// Brand Library: pictures the owner added

export async function listMyLibraryFiles() {
  const user = await getCurrentUser();
  return listLibraryFilesForOwner(getDb(), user.id);
}

export async function getMyLibraryFile(fileId: string) {
  const user = await getCurrentUser();
  return getLibraryFileForOwner(getDb(), user.id, fileId);
}

export async function myLibraryUsage() {
  const user = await getCurrentUser();
  return libraryUsageForOwner(getDb(), user.id);
}

export async function addMyLibraryFile(input: NewLibraryFile) {
  const user = await writer();
  return addLibraryFileForOwner(getDb(), user.id, input);
}

export async function deleteMyLibraryFile(fileId: string) {
  const user = await writer();
  return deleteLibraryFileForOwner(getDb(), user.id, fileId);
}

// Products

// Confirmed items only: for websites, marketing and plans
export async function listMyProducts() {
  const user = await getCurrentUser();
  return listProductsForOwner(getDb(), user.id, "confirmed");
}

// Suggestions too: for the products page
export async function listMyItems() {
  const user = await getCurrentUser();
  return listProductsForOwner(getDb(), user.id, "all");
}

export async function getMyProduct(productId: string) {
  const user = await getCurrentUser();
  return getProductForOwner(getDb(), user.id, productId);
}

export async function addMySuggestedItems(items: Parameters<typeof addSuggestedItemsForOwner>[2]) {
  const user = await writer();
  return addSuggestedItemsForOwner(getDb(), user.id, items);
}

export async function setMyItemDescription(productId: string, description: string, by: DescriptionAuthor) {
  const user = await writer();
  return setDescriptionForOwner(getDb(), user.id, productId, description, by);
}

export async function listMyItemPictures() {
  const user = await getCurrentUser();
  return listPicturesForOwner(getDb(), user.id);
}

export async function getMyItemPictureFile(pictureId: string) {
  const user = await getCurrentUser();
  return getPictureFileForOwner(getDb(), user.id, pictureId);
}

export async function findMyItemPictureByRequest(requestKey: string) {
  const user = await getCurrentUser();
  return findPictureByRequestForOwner(getDb(), user.id, requestKey);
}

export async function myItemPictureRoom(productId: string) {
  const user = await getCurrentUser();
  return pictureRoomForOwner(getDb(), user.id, productId);
}

export async function addMyItemPicture(productId: string, picture: NewItemPicture) {
  const user = await writer();
  return addPictureForOwner(getDb(), user.id, productId, picture);
}

export async function approveMyItemPicture(productId: string, pictureId: string) {
  const user = await writer();
  return approvePictureForOwner(getDb(), user.id, productId, pictureId);
}

export async function deleteMyItemPicture(pictureId: string) {
  const user = await writer();
  return deletePictureForOwner(getDb(), user.id, pictureId);
}

export async function setMyItemWearer(productId: string, wearer: Wearer) {
  const user = await writer();
  return setWearerForOwner(getDb(), user.id, productId, wearer);
}

export async function deleteMyUnusedItemPictures(productId: string) {
  const user = await writer();
  return deleteUnusedPicturesForOwner(getDb(), user.id, productId);
}

export async function listMyPriceChecks() {
  const user = await getCurrentUser();
  return listPriceChecksForOwner(getDb(), user.id);
}

export async function saveMyPriceCheck(productId: string, result: PriceCheck) {
  const user = await writer();
  return savePriceCheckForOwner(getDb(), user.id, productId, result);
}

export async function createMyProduct(values: ProductValues) {
  const user = await writer();
  return createProductForOwner(getDb(), user.id, values);
}

export async function updateMyProduct(productId: string, values: ProductValues) {
  const user = await writer();
  return updateProductForOwner(getDb(), user.id, productId, values);
}

export async function deleteMyProduct(productId: string) {
  const user = await writer();
  return deleteProductForOwner(getDb(), user.id, productId);
}

// Intake progress and history

export async function getMyIntakeDraft() {
  const user = await getCurrentUser();
  return getIntakeDraftForOwner(getDb(), user.id);
}

export async function saveMyIntakeDraft(draft: IntakeDraftInput) {
  const user = await writer();
  return saveIntakeDraftForOwner(getDb(), user.id, draft);
}

export async function deleteMyIntakeDraft() {
  const user = await writer();
  return deleteIntakeDraftForOwner(getDb(), user.id);
}

// Null when the owner already has a business
export async function createMyBusinessFromIntake(profile: BusinessProfile) {
  const user = await writer();
  return createBusinessWithHistoryForOwner(getDb(), user.id, profile);
}

export async function updateMyProfileWithHistory(profile: BusinessProfile, summary: string[]) {
  const user = await writer();
  return updateProfileWithHistoryForOwner(getDb(), user.id, profile, summary);
}

// Owner-confirmed decisions, with what they saw when deciding
export async function recordMyDecisions(values: { key: DetailKey; value: string }[], basis: DecisionBasis, reconfirm = false) {
  const user = await writer();
  return saveDetailsForOwner(getDb(), user.id, values, { source: "owner", documentId: null }, new Date(), basis, reconfirm);
}

export async function listMyHistory(filter: { kind?: BusinessEvent["kind"]; limit?: number } = {}) {
  const user = await getCurrentUser();
  return listHistoryForOwner(getDb(), user.id, filter);
}

// Requirements, plan and documents

// Rebuilds the plan from saved research after a decision changes, applied straight away
export async function replanMyPlan(profile: BusinessProfile, details: readonly { key: string; value: string }[]) {
  const user = await writer();
  return replanForOwner(getDb(), user.id, profile, details);
}

// Structure recommendation

export async function getMyStructureAdvice() {
  const user = await getCurrentUser();
  return getStructureAdviceForOwner(getDb(), user.id);
}

export async function saveMyStructureAdvice(advice: StructureAdvice) {
  const user = await writer();
  return saveStructureAdviceForOwner(getDb(), user.id, advice);
}

// Business insights

export async function getMyInsights() {
  const user = await getCurrentUser();
  return getInsightsForOwner(getDb(), user.id);
}

export async function saveMyInsights(insights: SavedInsights) {
  const user = await writer();
  return saveInsightsForOwner(getDb(), user.id, insights);
}

export async function markMyInsight(key: string, mark: InsightMark | null) {
  const user = await writer();
  return markInsightForOwner(getDb(), user.id, key, mark);
}

// Steps the owner did outside SnapStart

export async function listMyJourneyMarks() {
  const user = await getCurrentUser();
  return listJourneyMarksForOwner(getDb(), user.id);
}

export async function setMyJourneyMark(mark: { key: string; url: string | null; note: string | null }) {
  const user = await writer();
  return setJourneyMarkForOwner(getDb(), user.id, mark);
}

export async function clearMyJourneyMark(key: string) {
  const user = await writer();
  return clearJourneyMarkForOwner(getDb(), user.id, key);
}

// The few facts the menu needs to show which steps are done
export async function getMySidebarFacts() {
  const user = await getCurrentUser();
  return getSidebarFactsForOwner(getDb(), user.id);
}

export async function listMyOperationSetups() {
  const user = await getCurrentUser();
  return listOperationSetupsForOwner(getDb(), user.id);
}

export async function saveMyOperationSetup(input: import("@/lib/rules/operations").OperationSetup) {
  const user = await writer();
  return saveOperationSetupForOwner(getDb(), user.id, input);
}

export async function pauseMyOperationSetup(kind: import("@/lib/operations/catalog").OperationKind, paused: boolean) {
  const user = await writer();
  return pauseOperationSetupForOwner(getDb(), user.id, kind, paused);
}

// Orders

export async function listMyOrders() {
  const user = await getCurrentUser();
  return listOrdersForOwner(getDb(), user.id);
}

export async function getMyOrder(id: string) {
  const user = await getCurrentUser();
  return (await import("./orders")).getOrderForOwner(getDb(), user.id, id);
}

export async function replaceMyOrderLines(id: string, lines: import("@/lib/rules/order-lines").LineInput[]) {
  const user = await writer();
  return (await import("./orders")).replaceOrderLinesForOwner(getDb(), user.id, id, lines);
}

export async function updateMyOrderDetails(id: string, patch: import("./orders").DetailsPatch) {
  const user = await writer();
  return (await import("./orders")).updateOrderDetailsForOwner(getDb(), user.id, id, patch);
}

export async function recordMyOrder(order: NewOrder) {
  const user = await writer();
  return recordOrderForOwner(getDb(), user.id, order);
}

export async function cancelMyOrder(orderId: string) {
  const user = await writer();
  return cancelOrderForOwner(getDb(), user.id, orderId);
}

export async function listMyEmailDemoSamples() {
  const user = await getCurrentUser();
  return (await import("./email-demo-orders")).listEmailDemoSamplesForOwner(getDb(), user.id);
}

export async function addMyEmailDemoOrder(sampleId: string) {
  const user = await writer();
  return (await import("./email-demo-orders")).addEmailDemoOrderForOwner(getDb(), user.id, sampleId);
}

export async function clearMyEmailDemoOrders() {
  const user = await writer();
  return (await import("./email-demo-orders")).clearEmailDemoOrdersForOwner(getDb(), user.id);
}

export async function getMySquareState() {
  const user = await getCurrentUser();
  return (await import("./square")).squareStateForOwner(getDb(), user.id);
}

export async function beginMySquareConnection() {
  const user = await writer();
  return (await import("./square")).beginSquareForOwner(getDb(), user.id);
}

export async function finishMySquareConnection(state: string, code: string) {
  const user = await writer();
  return (await import("./square")).finishSquareForOwner(getDb(), user.id, state, code);
}

export async function listMySquareItems() {
  const user = await writer();
  return (await import("./square")).listSquareItemsForOwner(getDb(), user.id);
}

export async function draftMySquareDescription(itemId: string, request: string) {
  const user = await writer();
  return (await import("./square")).draftSquareForOwner(getDb(), user.id, itemId, request);
}

export async function editMySquareDraft(draftId: string, description: string, cancel = false) {
  const user = await writer();
  return (await import("./square")).editSquareDraftForOwner(getDb(), user.id, draftId, description, cancel);
}

export async function approveMySquareDraft(draftId: string, description: string) {
  const user = await writer();
  return (await import("./square")).approveSquareDraftForOwner(getDb(), user.id, draftId, description);
}

export async function disconnectMySquare() {
  const user = await writer();
  return (await import("./square")).disconnectSquareForOwner(getDb(), user.id);
}

export async function getMyProductSync() {
  const user = await getCurrentUser();
  return (await import("./square-products")).productSyncForOwner(getDb(), user.id);
}

export async function pullMySquareProducts(productId?: string, expected?: string) {
  const user = await writer();
  return (await import("./square-products")).pullProductsForOwner(getDb(), user.id, productId, expected);
}

export async function pushMySquareProduct(productId: string, expected: string) {
  const user = await writer();
  return (await import("./square-products")).pushProductForOwner(getDb(), user.id, productId, expected);
}

export async function progressMyOrder(id: string, status: import("@/lib/rules/order-tracking").TrackingStatus) {
  const user = await writer();
  return (await import("./orders")).progressOrderForOwner(getDb(), user.id, id, status);
}
export async function recordMyPayment(input: Parameters<typeof import("./orders").paymentForOwner>[2]) {
  const user = await writer();
  return (await import("./orders")).paymentForOwner(getDb(), user.id, input);
}
export async function scheduleMyOrder(input: Parameters<typeof import("./orders").scheduleOrderForOwner>[2]) {
  const user = await writer();
  return (await import("./orders")).scheduleOrderForOwner(getDb(), user.id, input);
}

export async function getMyEmailState() {
  const user = await getCurrentUser();
  return (await import("./customer-messages")).emailStateForOwner(getDb(), user.id);
}
export async function addMyCustomerMessage(input: Parameters<typeof import("./customer-messages").addMessageForOwner>[2]) {
  const user = await writer();
  return (await import("./customer-messages")).addMessageForOwner(getDb(), user.id, input);
}
export async function processMyCustomerMessage(id: string) {
  const user = await writer();
  const { runWorkflow } = await import("@/lib/workflow-runner");
  return runWorkflow("customer_intake", id, () => import("@/lib/orders/process").then((module) => module.processCustomerMessage(user.id, id)));
}
export async function retryMyCustomerMessage(id: string) {
  const user = await writer();
  return (await import("./customer-messages")).retryMessageForOwner(getDb(), user.id, id);
}
export async function dismissMyCustomerMessage(id: string) {
  const user = await writer();
  return (await import("./customer-messages")).dismissMessageForOwner(getDb(), user.id, id);
}
// The owner's forwarding address, made on first use
export async function getMyForwardingAddress() {
  const user = await writer();
  return (await import("./email-inbox")).ensureInboxForOwner(getDb(), user.id);
}
// A new address; the old one stops working
export async function newMyForwardingAddress() {
  const user = await writer();
  return (await import("./email-inbox")).ensureInboxForOwner(getDb(), user.id, true);
}
export async function clearMyForwardingConfirmation() {
  const user = await writer();
  return (await import("./email-inbox")).clearConfirmationForOwner(getDb(), user.id);
}
// Reads forwarded emails waiting for the owner, as one job
export async function readMyNewEmail() {
  const user = await writer();
  const { runWorkflow } = await import("@/lib/workflow-runner");
  const { practiceMode } = await import("@/lib/ai");
  const { takeAiRequest } = await import("./ai-quota");
  const { readNewEmailForOwner } = await import("@/lib/email/read");
  return runWorkflow("email_import", null, () =>
    readNewEmailForOwner(user.id, async () => practiceMode() || (await takeAiRequest(getDb(), user.id)) === "ok"),
  );
}
export async function markMyReplySent(id: string, reply: string) {
  const user = await writer();
  return (await import("./customer-messages")).markReplySentForOwner(getDb(), user.id, id, reply);
}


export async function setMyOrderTotal(id: string, totalCents: number) {
  const user = await writer();
  return (await import("./orders")).setOrderTotalForOwner(getDb(), user.id, id, totalCents);
}

export async function connectMySquareSandbox() {
  const user = await writer();
  return (await import("./square")).connectSandboxTokenForOwner(getDb(), user.id);
}
