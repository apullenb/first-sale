// Browser-only. Every photo is redrawn before upload: turned upright, made small enough to send,
// and stripped of hidden details such as the location it was taken.

const MAX_SIDE = 3072;
const TARGET_BYTES = 3_500_000;

export type PreparedPhoto = { ok: true; file: File; width: number; height: number } | { ok: false; message: string };

export async function preparePhoto(file: File, maxBytes: number): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) {
    return { ok: false, message: "Choose a photo, such as a JPEG, PNG or one straight from your phone’s camera." };
  }
  const source = await decode(file);
  if (!source) {
    return {
      ok: false,
      message:
        "Your browser can’t open this photo (often an iPhone HEIC photo). Take a screenshot of it, or set your camera to “Most Compatible”, then try again.",
    };
  }

  try {
    const target = Math.min(maxBytes, TARGET_BYTES);
    let scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
    for (let attempt = 0; attempt < 3; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return { ok: false, message: "Your browser couldn’t prepare this photo. Try another browser." };
      // JPEG has no transparency
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.92, 0.85, 0.75]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= target) {
          const name = `${file.name.replace(/\.[a-z0-9]{1,5}$/i, "") || "photo"}.jpg`;
          return { ok: true, file: new File([blob], name, { type: "image/jpeg" }), width: canvas.width, height: canvas.height };
        }
      }
      scale *= 0.75;
    }
    return { ok: false, message: "This photo is still too big after making it smaller. Try a different photo." };
  } finally {
    source.close();
  }
}

interface Decoded {
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

// Both paths draw the photo upright, as the camera meant it
async function decode(file: File): Promise<Decoded | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // Older browsers: an <img> applies the photo's orientation too
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      return null;
    }
  }
}
