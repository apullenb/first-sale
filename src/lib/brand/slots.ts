import type { MarketingPlatformId } from "@/data/marketing-platforms";
import { type BrandImageKind, type BrandPicks, IMAGE_KINDS, VERSION_KINDS, type VersionKind } from "./types";

// Which version and brand image slots show, and what each holds. Plain code: the owner's picks decide what's used.

export interface SlotFile {
  id: string;
  kind: string;
  sourceId: string | null;
}

export interface Slot<K extends string, T extends SlotFile> {
  kind: K;
  // Nothing made from the chosen logo yet: an empty tile with a "+"
  empty: boolean;
  // The newest file, shown large
  newest: T | null;
  // The owner's pick, if it's still one made from the chosen logo
  picked: T | null;
  // Older files, newest first, so the owner can go back to one
  earlier: T[];
}

// Files come oldest first, as the brand state lists them
export function slotsFor<K extends VersionKind | BrandImageKind, T extends SlotFile>(kinds: readonly K[], files: readonly T[], chosenId: string | null, picks: BrandPicks): Slot<K, T>[] {
  return kinds.map((kind) => {
    const made = chosenId ? files.filter((file) => file.kind === kind && file.sourceId === chosenId).reverse() : [];
    const [newest = null, ...earlier] = made;
    return { kind, empty: made.length === 0, newest, picked: made.find((file) => file.id === picks[kind]) ?? null, earlier };
  });
}

export const versionSlots = <T extends SlotFile>(files: readonly T[], chosenId: string | null, picks: BrandPicks) => slotsFor(VERSION_KINDS, files, chosenId, picks);
export const imageSlots = <T extends SlotFile>(files: readonly T[], chosenId: string | null, picks: BrandPicks) => slotsFor(IMAGE_KINDS, files, chosenId, picks);

// Made first and approved by the owner; the other brand images are made to match it
export const EXAMPLE_IMAGE = "website_hero" satisfies BrandImageKind;

// The owner's pick for the example, made from the chosen logo; null until they approve one
export function approvedExample<T extends SlotFile>(files: readonly T[], chosenId: string | null, picks: BrandPicks): T | null {
  return slotsFor([EXAMPLE_IMAGE], files, chosenId, picks)[0].picked;
}

// The platform each brand image is for; the website's own pictures have none
const IMAGE_PLATFORM: Partial<Record<BrandImageKind, MarketingPlatformId>> = { facebook_cover: "facebook", youtube_banner: "youtube" };

// Brand images worth making: the website's always, a platform's unless the owner said never to suggest it
export function recommendedImages(intake: { exclude: readonly MarketingPlatformId[] } | null): Set<BrandImageKind> {
  return new Set(
    IMAGE_KINDS.filter((kind) => {
      const platform = IMAGE_PLATFORM[kind];
      return !platform || !intake?.exclude.includes(platform);
    }),
  );
}
