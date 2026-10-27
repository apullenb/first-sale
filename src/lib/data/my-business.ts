import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/server";
import type { DetailKey } from "@/lib/details";
import { businessProfileSchema, type BusinessProfile, type TaskStatus } from "@/lib/domain";
import { profileKey, type ResearchResult } from "@/lib/research/requirements";
import type { WorkflowId } from "@/lib/workflows";
import { createBusinessForOwner, getBusinessForOwner, updateBusinessProfileForOwner } from "./businesses";
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
import { getPlanForOwner, getStepForOwner, reviewPlanForOwner, setStepStatusForOwner } from "./plan";
import { getResearchForOwner, type ResearchSnapshot, saveResearchForOwner } from "./research";
import { finishRun, lastRunForOwner, startRunForOwner } from "./workflow-runs";
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

// Null when the owner already has a business
export async function createMyBusiness(input: { profile: BusinessProfile; isDemo?: boolean }) {
  const user = await getCurrentUser();
  return createBusinessForOwner(getDb(), user.id, input);
}

export async function updateMyBusinessProfile(profile: BusinessProfile) {
  const user = await getCurrentUser();
  return updateBusinessProfileForOwner(getDb(), user.id, profile);
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

export async function updateMyDocument(id: string, patch: DocumentPatch) {
  const user = await getCurrentUser();
  return updateDocumentForOwner(getDb(), user.id, id, patch);
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
