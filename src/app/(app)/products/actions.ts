"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getImageModel, getModel, type ImageInput } from "@/lib/ai";
import { briefDefaults } from "@/lib/brand/brief";
import { imageStyle } from "@/lib/brand/image-style";
import {
  addMyItemPicture,
  addMySuggestedItems,
  approveMyItemPicture,
  createMyPhoto,
  createMyProduct,
  deleteMyItemPicture,
  deleteMyProduct,
  deleteMyUnusedItemPictures,
  findMyItemPictureByRequest,
  getMyBrandState,
  getMyBusiness,
  getMyItemPictureFile,
  getMyPhotoFile,
  getMyPhotoVersionFile,
  getMyProduct,
  listMyItems,
  myAiKey,
  myItemPictureRoom,
  saveMyPriceCheck,
  setMyItemDescription,
  setMyItemWearer,
  updateMyProduct,
} from "@/lib/data/my-business";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { STATE_NAMES } from "@/lib/intake/options";
import { checkPhotoUpload } from "@/lib/photos/upload";
import { likelyKind, suggestedItems } from "@/lib/products/autofill";
import { type BusinessFacts, describePhoto, draftDescriptions } from "@/lib/products/describe";
import { makeItemPicture, MAX_PICTURE_CHANGE, type NewItemPicture } from "@/lib/products/picture";
import { EXTRA_VIEWS, PICTURE_VIEWS, WEARERS, wearerFor } from "@/lib/rules/picture-views";
import type { ProductRow } from "@/lib/data/products";
import { comparePrices } from "@/lib/products/prices";
import { checkProduct, ITEM_KINDS, OPTION_LIMITS, optionsSummary, PRODUCT_LIMITS, productPhotoRefSchema } from "@/lib/rules/products";
import { businessKind, businessSpecifics, itemsPhrase } from "@/lib/specifics";
import { runWorkflow } from "@/lib/workflow-runner";

const id = z.string().min(1).max(60);
const label = z.string().max(OPTION_LIMITS.label * 2);
const formSchema = z.object({
  id: id.nullable(),
  // A suggestion stays one unless the owner confirms it
  confirm: z.boolean(),
  kind: z.enum(ITEM_KINDS),
  name: z.string().max(400),
  description: z.string().max(2000),
  price: z.string().max(PRODUCT_LIMITS.priceText * 2),
  unitCost: z.string().max(40),
  quantity: z.string().max(40),
  duration: z.string().max(PRODUCT_LIMITS.detail * 2),
  location: z.string().max(PRODUCT_LIMITS.detail * 2),
  included: z.string().max(PRODUCT_LIMITS.included * 2),
  groups: z.array(z.object({ name: label, values: z.array(label).max(OPTION_LIMITS.values * 2) })).max(OPTION_LIMITS.groups * 2),
  variants: z.array(z.object({ values: z.array(label).max(OPTION_LIMITS.groups * 2), price: z.string().max(40), quantity: z.string().max(40) })).max(OPTION_LIMITS.variants * 2),
  photo: productPhotoRefSchema.nullable(),
});

const SAVE_MESSAGES = {
  no_business: "Tell us about your business first.",
  too_many: "You’ve added as many items as SnapStart keeps. Remove ones you no longer sell, then try again.",
  bad_photo: "That photo wasn’t found. It may have been deleted. Pick another one.",
  not_found: "That item wasn’t found. It may have been removed. Reload the page.",
} as const;
const NOT_FOUND = SAVE_MESSAGES.not_found;

// Adds or changes one item; prices are kept exactly as the owner typed them
export async function saveProductAction(input: unknown): Promise<ActionResult<string> & { field?: string }> {
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some answers are too long. Shorten them and try again." };
  const { id: itemId, confirm, ...form } = parsed.data;
  const existing = itemId ? await getMyProduct(itemId) : null;
  if (itemId && !existing) return { ok: false, message: NOT_FOUND };
  const status = !existing || confirm ? "confirmed" : existing.status;
  const checked = checkProduct(form, status === "confirmed");
  if (!checked.ok) return { ok: false, message: checked.message, field: checked.field };
  // Rules, not the browser, decide who wrote the description
  const descriptionBy = existing && existing.description === checked.value.description ? existing.descriptionBy : "owner";
  // Practice stand-in text never goes anywhere public
  const practiceKept = status === "confirmed" && descriptionBy === "practice";
  const values = {
    ...checked.value,
    status,
    origin: existing?.origin ?? ("owner" as const),
    description: practiceKept ? "" : checked.value.description,
    descriptionBy: practiceKept ? ("owner" as const) : descriptionBy,
  };
  const saved = existing ? await updateMyProduct(existing.id, values) : await createMyProduct(values);
  if (!saved.ok) return { ok: false, message: SAVE_MESSAGES[saved.reason], field: saved.reason === "bad_photo" ? "photo" : undefined };
  refresh();
  return { ok: true, value: saved.id };
}

export async function deleteProductAction(productId: unknown): Promise<ActionResult> {
  const parsed = id.safeParse(productId);
  const result = parsed.success ? await deleteMyProduct(parsed.data) : "not_found";
  if (result === "on_orders") return { ok: false, message: "This item is on an order, so it stays in your list to keep the order complete." };
  if (result === "not_found") return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

async function facts(): Promise<BusinessFacts | null> {
  const [business, items] = await Promise.all([getMyBusiness(), listMyItems()]);
  if (!business?.profile) return null;
  const specifics = businessSpecifics(business.profile, items.filter((item) => item.status === "confirmed"));
  return { name: business.profile.name ?? "", kind: businessKind(business.profile), sells: itemsPhrase(specifics, 4) };
}

// --- Suggestions from the owner's answers

export async function suggestItemsAction(): Promise<ActionResult<number>> {
  const [business, items] = await Promise.all([getMyBusiness(), listMyItems()]);
  if (!business?.profile) return { ok: false, message: SAVE_MESSAGES.no_business };
  const suggestions = suggestedItems(business.profile, items);
  if (!suggestions.length) return { ok: false, message: "Everything your answers named is already in your list." };
  const result = await runWorkflow("item_suggest", null, async () => {
    const model = getModel();
    const about = await facts();
    const drafted = await draftDescriptions(model, about!, suggestions, await myAiKey());
    const by = model.simulated ? ("practice" as const) : ("ai" as const);
    const added = await addMySuggestedItems(suggestions.map((item, index) => ({ name: item.name, kind: item.kind, description: drafted[index]?.description ?? "", descriptionBy: drafted[index]?.description ? by : "owner" })));
    return added?.length ?? 0;
  });
  refresh();
  return result;
}

export async function describeItemAction(productId: unknown): Promise<ActionResult> {
  const parsed = id.safeParse(productId);
  const item = parsed.success ? await getMyProduct(parsed.data) : null;
  if (!item) return { ok: false, message: NOT_FOUND };
  const result = await runWorkflow("item_describe", item.id, async () => {
    const model = getModel();
    const [drafted] = await draftDescriptions(model, (await facts())!, [{ name: item.name, kind: item.kind, options: optionsSummary(item.options) }], await myAiKey());
    if (drafted?.description) await setMyItemDescription(item.id, drafted.description, model.simulated ? "practice" : "ai");
  });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}

// --- A new item from a photo: the photo is kept as the item's photo

export async function itemFromPhotoAction(form: FormData): Promise<ActionResult<string>> {
  const file = form.get("file");
  const hint = form.get("hint");
  const kind = z.enum(ITEM_KINDS).safeParse(form.get("kind"));
  if (!(file instanceof File)) return { ok: false, message: "Choose a photo to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "That photo is over 4 MB. Choose it again on this page and it will be made smaller for you." };
  const business = await getMyBusiness();
  if (!business?.profile) return { ok: false, message: SAVE_MESSAGES.no_business };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const typed = typeof hint === "string" ? hint.slice(0, PRODUCT_LIMITS.name) : "";
  const check = checkPhotoUpload(bytes, file.name, typed);
  if (!check.ok) return check;

  const created = await createMyPhoto({ title: check.title, mimeType: check.type, sha256: check.sha256, width: check.width, height: check.height, data: bytes });
  if (!created.ok) {
    return { ok: false, message: created.reason === "no_business" ? SAVE_MESSAGES.no_business : "Your photo library is full. Delete photos you don’t need, then try again." };
  }
  const profile = business.profile;
  const result = await runWorkflow("item_from_photo", created.id, async () => {
    const model = getModel();
    const draft = await describePhoto(model, { mimeType: check.type, data: bytes }, { facts: (await facts())!, kind: kind.success ? kind.data : likelyKind(profile), hint: typed, userKey: await myAiKey() });
    const saved = await createMyProduct({
      kind: kind.success ? kind.data : draft.kind,
      status: "suggested",
      origin: "photo",
      name: draft.name,
      description: draft.description,
      descriptionBy: model.simulated ? "practice" : "ai",
      priceCents: null,
      priceText: "",
      unitCostCents: null,
      quantity: null,
      duration: "",
      location: "",
      included: "",
      options: { groups: [], variants: [] },
      photo: { source: "original", photoId: created.id },
    });
    if (!saved.ok) throw new Error(saved.reason);
    return saved.id;
  });
  refresh();
  return result;
}

// --- Pictures: a main photo, then three views made from the approved main

function imageModel() {
  try {
    return getImageModel();
  } catch {
    return null;
  }
}

// The owner's own photo of the item, when it shows one: the main photo is made from it
async function ownPhoto(item: ProductRow): Promise<ImageInput | null> {
  const ref = item.photo;
  if (ref?.source === "original") return pick(await getMyPhotoFile(ref.photoId));
  if (ref?.source === "version") return pick(await getMyPhotoVersionFile(ref.photoId, ref.versionId));
  return null;
}
const pick = (file: { mimeType: string; data: Uint8Array } | null): ImageInput | null => (file ? { mimeType: file.mimeType, data: file.data } : null);

async function approvedMain(item: ProductRow): Promise<ImageInput | null> {
  if (item.photo?.source !== "generated") return null;
  const file = await getMyItemPictureFile(item.photo.pictureId);
  return file && file.view === "main" && file.approvedAt ? pick(file) : null;
}

async function pictureSetup(productId: string) {
  const [item, business, brand] = await Promise.all([getMyProduct(productId), getMyBusiness(), getMyBrandState()]);
  if (!item || !business?.profile) return null;
  const brief = briefDefaults(business.profile, brand?.brief ?? null);
  return { item, style: imageStyle(brief, brand?.imageMedium ?? null), brief: brand?.brief ? brief : null };
}

function storeFor(productId: string) {
  return {
    findByRequest: (key: string) => findMyItemPictureByRequest(key),
    room: () => myItemPictureRoom(productId),
    add: (picture: NewItemPicture) => addMyItemPicture(productId, picture),
  };
}

const pictureSchema = z.object({
  productId: id,
  requestKey: z.uuid(),
  view: z.enum(PICTURE_VIEWS),
  // A change: the picture to change and the owner's words
  baseId: id.nullable(),
  change: z.string().max(MAX_PICTURE_CHANGE * 2).nullable(),
});

// One picture: a new main, a fresh copy of one view, or a change to a picture
export async function makePictureAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = pictureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Say what you’d like changed, in a few words." };
  const { productId, requestKey, view, baseId, change } = parsed.data;
  if (baseId && (change ?? "").trim().length < 3) return { ok: false, message: "Say what you’d like changed." };
  const setup = await pictureSetup(productId);
  if (!setup) return { ok: false, message: NOT_FOUND };
  const { item } = setup;
  const image = imageModel();
  if (!image) return { ok: false, message: "Making pictures isn’t turned on for SnapStart yet." };
  const base = baseId ? await getMyItemPictureFile(baseId) : null;
  if (baseId && (!base || base.productId !== item.id)) return { ok: false, message: "That picture wasn’t found. Reload the page." };
  if (base && base.mimeType === "image/svg+xml" && !image.simulated) return { ok: false, message: "A practice preview can’t be edited. Make a new picture instead." };
  const photo = view === "main" && !base ? await ownPhoto(item) : null;
  if (view === "main" && !base && !photo && !item.description.trim()) return { ok: false, message: "Add a short description first, so the picture shows the right thing." };
  const main = view === "main" ? null : await approvedMain(item);
  if (view !== "main" && !main) return { ok: false, message: "Approve a main photo first. The other views are made from it." };
  const wearer = view === "in_use" ? wearerFor(item) : null;
  if (wearer === "ask") return { ok: false, message: "Say who wears it first, so the picture shows the right person." };

  const result = await runWorkflow("item_picture", item.id, async () =>
    makeItemPicture(image, storeFor(item.id), {
      ...setup,
      view: base ? base.view : view,
      main,
      photo,
      base: base ? { id: base.id, file: pick(base)! } : null,
      change,
      wearer,
      requestKey: `${item.id}:${requestKey}`,
      userKey: await myAiKey(),
    }),
  );
  refresh();
  return result;
}

const viewsSchema = z.object({ productId: id, requestKey: z.uuid(), wearer: z.enum(WEARERS).nullable(), views: z.array(z.enum(EXTRA_VIEWS)).min(1).optional() });

// The three extra views, made from the approved main; the ones already made are kept
export async function makeViewsAction(input: unknown): Promise<ActionResult<number>> {
  const parsed = viewsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: NOT_FOUND };
  const { productId, requestKey } = parsed.data;
  if (parsed.data.wearer) await setMyItemWearer(productId, parsed.data.wearer);
  const setup = await pictureSetup(productId);
  if (!setup) return { ok: false, message: NOT_FOUND };
  const { item } = setup;
  const image = imageModel();
  if (!image) return { ok: false, message: "Making pictures isn’t turned on for SnapStart yet." };
  const main = await approvedMain(item);
  if (!main) return { ok: false, message: "Approve a main photo first. The other views are made from it." };
  const wearer = wearerFor(item);
  if (wearer === "ask") return { ok: false, message: "Say who wears it first, so the in-use picture shows the right person." };

  const result = await runWorkflow("item_picture", item.id, async () => {
    const userKey = await myAiKey();
    const made = await Promise.allSettled(
      (parsed.data.views ?? EXTRA_VIEWS).map((view) =>
        makeItemPicture(image, storeFor(item.id), { ...setup, view, main, photo: null, base: null, change: null, wearer: view === "in_use" ? wearer : null, requestKey: `${item.id}:${requestKey}:${view}`, userKey }),
      ),
    );
    const done = made.filter((each) => each.status === "fulfilled").length;
    if (!done) throw made.find((each) => each.status === "rejected")?.reason;
    return done;
  });
  refresh();
  return result;
}

export async function approvePictureAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ productId: id, pictureId: id, confirmed: z.literal(true) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Tick the box once you’ve checked the picture." };
  const ok = await approveMyItemPicture(parsed.data.productId, parsed.data.pictureId);
  if (!ok) return { ok: false, message: "That picture wasn’t found. Reload the page." };
  refresh();
  return { ok: true, value: null };
}

export async function deletePictureAction(pictureId: unknown): Promise<ActionResult> {
  const parsed = id.safeParse(pictureId);
  const result = parsed.success ? await deleteMyItemPicture(parsed.data) : "not_found";
  if (result === "in_use") return { ok: false, message: "This is the item’s main photo. Approve another main photo first, then remove this one." };
  if (result === "not_found") return { ok: false, message: "That picture wasn’t found. Reload the page." };
  refresh();
  return { ok: true, value: null };
}

export async function clearPicturesAction(productId: unknown): Promise<ActionResult> {
  const parsed = id.safeParse(productId);
  if (!parsed.success) return { ok: false, message: NOT_FOUND };
  await deleteMyUnusedItemPictures(parsed.data);
  refresh();
  return { ok: true, value: null };
}

// --- Compare prices near you

const MAX_COMPARED = 5;

export async function comparePricesAction(input: unknown): Promise<ActionResult<number>> {
  const parsed = z.union([id, z.literal("all")]).safeParse(input);
  if (!parsed.success) return { ok: false, message: NOT_FOUND };
  const [business, items] = await Promise.all([getMyBusiness(), listMyItems()]);
  if (!business?.profile) return { ok: false, message: SAVE_MESSAGES.no_business };
  const confirmed = items.filter((item) => item.status === "confirmed");
  const chosen = parsed.data === "all" ? confirmed.slice(0, MAX_COMPARED) : confirmed.filter((item) => item.id === parsed.data);
  if (!chosen.length) return { ok: false, message: parsed.data === "all" ? "Confirm an item first, then compare its price." : NOT_FOUND };
  const { location, channels, shipsOrders } = business.profile;
  const area = {
    city: location.city,
    state: STATE_NAMES[location.state] ?? "",
    online: shipsOrders === "yes" || channels.some((channel) => channel === "own_website" || channel === "marketplace" || channel === "social_media"),
  };
  const result = await runWorkflow("price_compare", parsed.data, async () => {
    const model = getModel();
    const userKey = await myAiKey();
    for (const item of chosen) {
      const check = await comparePrices(model, { item, area, userKey });
      await saveMyPriceCheck(item.id, check);
    }
    return chosen.length;
  });
  refresh();
  return result;
}
