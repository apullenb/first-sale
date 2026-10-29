import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/server";
import type { DetailKey } from "@/lib/details";
import { businessProfileSchema, type BusinessProfile, type TaskStatus } from "@/lib/domain";
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
import { getPlanForOwner, getStepForOwner, replanForOwner, reviewPlanForOwner, setStepStatusForOwner } from "./plan";
import { getResearchForOwner, type ResearchSnapshot, saveResearchForOwner } from "./research";
import { getWebsitePlanForOwner, saveWebsitePlanForOwner, updateWebsitePlanForOwner, type WebsitePatch, type WebsitePlan } from "./website";
import { finishRun, lastRunForOwner, startRunForOwner } from "./workflow-runs";
import type { NewBrandAsset } from "@/lib/brand/generate";
import type { AssetCheck, BrandBrief, BrandImageKind, BrandKit, VersionKind } from "@/lib/brand/types";
import {
  addAssetForOwner,
  approveVersionsForOwner,
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
  pickImageForOwner,
  saveBriefForOwner,
  setAssetCheckForOwner,
  unpickImageForOwner,
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

// What pages, actions and route handlers call: the owner always comes from the verified session.

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
export async function saveMyResearch(research: ResearchResult, profile: BusinessProfile) {
  const user = await getCurrentUser();
  return saveResearchForOwner(getDb(), user.id, research, profileKey(profile));
}

// Stable id for the owner that reveals nothing about them, sent with AI requests for the provider's abuse checks
export async function myAiKey(): Promise<string> {
  const user = await getCurrentUser();
  return createHash("sha256").update(`first-sale:${user.id}`).digest("hex").slice(0, 32);
}

export async function getMyPlan() {
  const user = await getCurrentUser();
  return getPlanForOwner(getDb(), user.id);
}

export async function reviewMyPlan(input: { checkedAt: Date; acceptedKeys: readonly string[] }) {
  const user = await getCurrentUser();
  return reviewPlanForOwner(getDb(), user.id, input);
}

export async function getMyStep(stepId: string) {
  const user = await getCurrentUser();
  return getStepForOwner(getDb(), user.id, stepId);
}

export async function setMyStepStatus(input: { stepId: string; status: TaskStatus; note: string | null }) {
  const user = await getCurrentUser();
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
  const user = await getCurrentUser();
  return saveDetailsForOwner(getDb(), user.id, values, origin);
}

export async function deleteMyDetail(key: DetailKey) {
  const user = await getCurrentUser();
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
  const user = await getCurrentUser();
  return createDocumentForOwner(getDb(), user.id, input);
}

export async function updateMyDocument(id: string, patch: DocumentPatch, when?: Parameters<typeof updateDocumentForOwner>[5]) {
  const user = await getCurrentUser();
  return updateDocumentForOwner(getDb(), user.id, id, patch, new Date(), when);
}

export async function deleteMyDocument(id: string) {
  const user = await getCurrentUser();
  return deleteDocumentForOwner(getDb(), user.id, id);
}

export async function startMyRun(workflow: WorkflowId, subjectId: string | null) {
  const user = await getCurrentUser();
  return startRunForOwner(getDb(), user.id, workflow, subjectId);
}

export async function finishMyRun(runId: string, status: "succeeded" | "failed", message: string | null) {
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
  const user = await getCurrentUser();
  return createPhotoForOwner(getDb(), user.id, input);
}

export async function updateMyPhoto(photoId: string, patch: PhotoPatch) {
  const user = await getCurrentUser();
  return updatePhotoForOwner(getDb(), user.id, photoId, patch);
}

export async function deleteMyPhoto(photoId: string) {
  const user = await getCurrentUser();
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
  const user = await getCurrentUser();
  return addPhotoVersionForOwner(getDb(), user.id, photoId, input);
}

export async function setMyPhotoVersionReview(versionId: string, review: PhotoReview) {
  const user = await getCurrentUser();
  return setPhotoVersionReviewForOwner(getDb(), user.id, versionId, review);
}

export async function approveMyPhotoVersion(versionId: string, approved: boolean) {
  const user = await getCurrentUser();
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
  const user = await getCurrentUser();
  return saveWebsitePlanForOwner(getDb(), user.id, patch);
}

export async function updateMyWebsitePlan(update: (plan: WebsitePlan | null) => WebsitePatch | null) {
  const user = await getCurrentUser();
  return updateWebsitePlanForOwner(getDb(), user.id, update);
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
  const user = await getCurrentUser();
  return saveBriefForOwner(getDb(), user.id, brief);
}

export async function createMyBrandRound(input: NewRound) {
  const user = await getCurrentUser();
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
  const user = await getCurrentUser();
  return addAssetForOwner(getDb(), user.id, input);
}

export async function setMyBrandAssetCheck(assetId: string, check: AssetCheck) {
  const user = await getCurrentUser();
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
  const user = await getCurrentUser();
  return chooseLogoForOwner(getDb(), user.id, assetId);
}

export async function approveMyLogoVersions(ids: Record<VersionKind, string>) {
  const user = await getCurrentUser();
  return approveVersionsForOwner(getDb(), user.id, ids);
}

export async function pickMyBrandImage(assetId: string) {
  const user = await getCurrentUser();
  return pickImageForOwner(getDb(), user.id, assetId);
}

export async function unpickMyBrandImage(kind: BrandImageKind) {
  const user = await getCurrentUser();
  return unpickImageForOwner(getDb(), user.id, kind);
}

export async function clearMyBrandIdeas() {
  const user = await getCurrentUser();
  return clearIdeasForOwner(getDb(), user.id);
}

// Intake progress and history

export async function getMyIntakeDraft() {
  const user = await getCurrentUser();
  return getIntakeDraftForOwner(getDb(), user.id);
}

export async function saveMyIntakeDraft(draft: IntakeDraftInput) {
  const user = await getCurrentUser();
  return saveIntakeDraftForOwner(getDb(), user.id, draft);
}

export async function deleteMyIntakeDraft() {
  const user = await getCurrentUser();
  return deleteIntakeDraftForOwner(getDb(), user.id);
}

// Null when the owner already has a business
export async function createMyBusinessFromIntake(profile: BusinessProfile) {
  const user = await getCurrentUser();
  return createBusinessWithHistoryForOwner(getDb(), user.id, profile);
}

export async function updateMyProfileWithHistory(profile: BusinessProfile, summary: string[]) {
  const user = await getCurrentUser();
  return updateProfileWithHistoryForOwner(getDb(), user.id, profile, summary);
}

// Owner-confirmed decisions, with what they saw when deciding
export async function recordMyDecisions(values: { key: DetailKey; value: string }[], basis: DecisionBasis, reconfirm = false) {
  const user = await getCurrentUser();
  return saveDetailsForOwner(getDb(), user.id, values, { source: "owner", documentId: null }, new Date(), basis, reconfirm);
}

export async function listMyHistory(filter: { kind?: BusinessEvent["kind"]; limit?: number } = {}) {
  const user = await getCurrentUser();
  return listHistoryForOwner(getDb(), user.id, filter);
}

// Requirements, plan and documents

// Rebuilds the plan from saved research after an answer or decision changes; changes wait for the owner's review
export async function replanMyPlan(profile: BusinessProfile, details: readonly { key: string; value: string }[]) {
  const user = await getCurrentUser();
  return replanForOwner(getDb(), user.id, profile, details);
}

// Business insights

export async function getMyInsights() {
  const user = await getCurrentUser();
  return getInsightsForOwner(getDb(), user.id);
}

export async function saveMyInsights(insights: SavedInsights) {
  const user = await getCurrentUser();
  return saveInsightsForOwner(getDb(), user.id, insights);
}

export async function markMyInsight(key: string, mark: InsightMark | null) {
  const user = await getCurrentUser();
  return markInsightForOwner(getDb(), user.id, key, mark);
}
