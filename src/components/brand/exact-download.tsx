"use client";

import { useLayoutEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { SECONDARY } from "@/components/styles";
import type { Export } from "@/lib/brand/sizes";

const EXTENSION = { "image/png": ".png", "image/jpeg": ".jpg" } as const;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No image"))), type, quality));
}

// Resized and cropped to fill in the browser, from the center, because Muse Image only sets the shape
export async function exactFile(src: string, spec: Pick<Export, "width" | "height" | "type" | "maxBytes">): Promise<Blob> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, spec.width, spec.height);
  const scale = Math.max(spec.width / image.naturalWidth, spec.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, (spec.width - width) / 2, (spec.height - height) / 2, width, height);

  let blob = await toBlob(canvas, spec.type, 0.92);
  // Lower JPEG quality step by step to fit a platform's file size limit
  for (const quality of [0.85, 0.75, 0.65, 0.55]) {
    if (!spec.maxBytes || spec.type !== "image/jpeg" || blob.size <= spec.maxBytes) break;
    blob = await toBlob(canvas, spec.type, quality);
  }
  return blob;
}

export function ExactDownload({ src, spec, fileName }: { src: string; spec: Export; fileName: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useLayoutEffect(() => () => setMessage(null), []);

  async function download() {
    setPending(true);
    setMessage(null);
    try {
      const blob = await exactFile(src, spec);
      if (spec.maxBytes && blob.size > spec.maxBytes) {
        setMessage(`This file is ${Math.ceil(blob.size / 1000)} KB, over the ${spec.maxBytes >= 1_000_000 ? `${spec.maxBytes / 1_000_000} MB` : `${spec.maxBytes / 1000} KB`} the platform suggests. It should still upload, but may load more slowly.`);
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}${EXTENSION[spec.type]}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setMessage("Couldn’t make this file in your browser. Download the full-size file instead.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={download} disabled={pending} className={SECONDARY}>
        <Icon name="download" size="sm" />
        {pending ? "Making the file…" : `Download ${spec.label}`}
      </button>
      {spec.note ? <p className="text-sm text-muted">{spec.note}</p> : null}
      {message ? (
        <p role="status" className="text-sm text-check">
          {message}
        </p>
      ) : null}
    </div>
  );
}
