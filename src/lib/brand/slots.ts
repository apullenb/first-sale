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
