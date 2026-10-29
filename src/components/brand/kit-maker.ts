import { icoFromPngs } from "@/lib/brand/archive";
import type { KitRecipe, KitSource } from "@/lib/brand/kit-files";
import { type Box, clearBox, contentBox, knockOut, type Pixels, placement, recolor } from "@/lib/brand/pixels";
import { PRACTICE_LABEL, PRACTICE_LABEL_COLORS, practiceLabelBox } from "@/lib/brand/practice";
import type { AssetKind } from "@/lib/brand/types";

// Makes one kit file in the browser from an approved file, following its recipe (kit-files.ts)

export class KitFileError extends Error {}

const NOT_PLAIN = "The background isn’t one plain color, so a see-through version can’t be made reliably.";
const SOURCE_KINDS: Record<KitSource, AssetKind> = { primary: "logo", stacked: "stacked", profile: "profile", solid: "solid" };

async function load(src: string): Promise<Pixels> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data: data.data, width: data.width, height: data.height };
}

function toCanvas(pixels: Pixels): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No image"))), "image/png"));
}

// Practice files carry the label inside the picture. Too small for words, they get the label's colors as a background and border instead.
function stamp(context: CanvasRenderingContext2D, width: number, height: number) {
  if (width < 96 || height < 48) {
    context.strokeStyle = PRACTICE_LABEL_COLORS.text;
    context.lineWidth = Math.max(1, Math.round(width / 16));
    context.strokeRect(context.lineWidth / 2, context.lineWidth / 2, width - context.lineWidth, height - context.lineWidth);
    return;
  }
  const size = Math.max(9, Math.round(Math.min(width, height) * 0.045));
  context.font = `700 ${size}px "Helvetica Neue", Arial, sans-serif`;
  const text = PRACTICE_LABEL.toUpperCase();
  const pillWidth = Math.min(width * 0.96, context.measureText(text).width + size * 2);
  const pillHeight = size * 2;
  const x = (width - pillWidth) / 2;
  const y = height - pillHeight - Math.max(4, height * 0.03);
  context.fillStyle = PRACTICE_LABEL_COLORS.pill;
  context.beginPath();
  context.roundRect(x, y, pillWidth, pillHeight, pillHeight / 2);
  context.fill();
  context.fillStyle = PRACTICE_LABEL_COLORS.text;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, width / 2, y + pillHeight / 2, pillWidth - size);
}

interface Colors {
  ink: string;
  dark: string;
}

interface Loaded {
  source: Pixels;
  // See-through, with a practice preview's own label taken out; null when the background isn't plain
  clear: Pixels | null;
}

// Each approved file is decoded and cleared once for all the kit files made from it
const loaded = new Map<string, Promise<Loaded>>();

function loadSource(src: string, source: KitSource, simulated: boolean): Promise<Loaded> {
  const key = `${simulated}:${src}`;
  let entry = loaded.get(key);
  if (!entry) {
    entry = load(src).then((pixels) => {
      const knocked = knockOut(pixels);
      return { source: pixels, clear: knocked && simulated ? clearBox(knocked, practiceLabelBox(SOURCE_KINDS[source], pixels.width, pixels.height)) : knocked };
    });
    loaded.set(key, entry);
    entry.catch(() => loaded.delete(key));
    // Only the four approved files are ever in use
    if (loaded.size > 4) loaded.delete(loaded.keys().next().value!);
  }
  return entry;
}

// The artwork prepared for a recipe: background removed and recolored if asked, and the part to draw.
// A practice preview's own label is taken out, so each file gets one label at a size that reads.
function prepare({ source, clear }: Loaded, recipe: KitRecipe, colors: Colors, simulated: boolean): { canvas: HTMLCanvasElement; box: Box } {
  if (!clear && (simulated || recipe.background !== "white" || recipe.color !== "original")) throw new KitFileError(NOT_PLAIN);
  // Without a plain background to remove, a white-background file is the picture as it is
  if (!clear) return { canvas: toCanvas(source), box: { x: 0, y: 0, width: source.width, height: source.height } };
  // Drawn see-through, so a white-background file gets pure white rather than the picture's own off-white
  const pixels = recipe.color === "original" ? clear : recolor(clear, recipe.color === "white" ? "#ffffff" : colors.ink);
  const box = recipe.trim !== null ? (contentBox(clear) ?? { x: 0, y: 0, width: clear.width, height: clear.height }) : { x: 0, y: 0, width: clear.width, height: clear.height };
  return { canvas: toCanvas(pixels), box };
}

function draw(prepared: { canvas: HTMLCanvasElement; box: Box }, recipe: KitRecipe, colors: Colors, size: { width: number; height: number } | null, simulated: boolean): HTMLCanvasElement {
  const { canvas: art, box } = prepared;
  let width: number;
  let height: number;
  let target: Box;
  if (recipe.trim === null) {
    // The whole picture, cropped from the center to fill the size
    width = size?.width ?? box.width;
    height = size?.height ?? box.height;
    const scale = Math.max(width / box.width, height / box.height);
    target = { x: (width - box.width * scale) / 2, y: (height - box.height * scale) / 2, width: box.width * scale, height: box.height * scale };
  } else {
    const placed = placement(box, size, recipe.trim);
    ({ width, height } = placed);
    target = placed.draw;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const context = canvas.getContext("2d")!;
  const tiny = simulated && (canvas.width < 96 || canvas.height < 48);
  if (recipe.background !== "transparent" || tiny) {
    context.fillStyle = tiny ? PRACTICE_LABEL_COLORS.pill : recipe.background === "dark" ? colors.dark : "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(art, box.x, box.y, box.width, box.height, target.x, target.y, target.width, target.height);
  if (simulated) stamp(context, canvas.width, canvas.height);
  return canvas;
}

export async function makeKitFile(src: string, recipe: KitRecipe, colors: Colors, simulated: boolean): Promise<Blob> {
  const prepared = prepare(await loadSource(src, recipe.source, simulated), recipe, colors, simulated);
  if (recipe.format === "ico") {
    const images = await Promise.all(
      (recipe.icoSizes ?? [16, 32, 48]).map(async (side) => ({
        size: side,
        png: new Uint8Array(await (await toBlob(draw(prepared, recipe, colors, { width: side, height: side }, simulated))).arrayBuffer()),
      })),
    );
    return new Blob([icoFromPngs(images) as Uint8Array<ArrayBuffer>], { type: "image/x-icon" });
  }
  return toBlob(draw(prepared, recipe, colors, recipe.size, simulated));
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
