import { AIProviderError } from "./types";

// Image editing, apart from text models: few providers offer it, and features must work without it.

export interface ImageInput {
  mimeType: string;
  data: Uint8Array;
}

export interface ImageEditRequest {
  instruction: string;
  // In order; the instruction says what each one is
  images: ImageInput[];
  // "WxH" sets the shape only; the provider picks the pixel size
  size?: string;
  format?: "png" | "jpeg" | "webp";
  timeoutMs?: number;
  // Stable, non-identifying id for the owner, for the provider's abuse checks
  userKey?: string;
}

export interface ImageEditResult {
  data: Uint8Array;
  // As the provider labeled it; callers check the bytes themselves
  format: string | null;
}

export interface ImageModel {
  readonly name: string;
  readonly model: string;
  // Practice mode: no image service, so results are previews and must be labeled as such
  readonly simulated: boolean;
  edit(request: ImageEditRequest): Promise<ImageEditResult>;
}

export class ImageEditError extends AIProviderError {
  // Provider's error code, such as "content_policy_violation"
  readonly code: string | null;
  readonly timedOut: boolean;

  constructor(message: string, status: number | null, retryable: boolean, code: string | null = null, timedOut = false) {
    super(message, status, retryable);
    this.name = "ImageEditError";
    this.code = code;
    this.timedOut = timedOut;
  }
}
