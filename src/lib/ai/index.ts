export { registerMockFixture } from "./providers/mock";
export { getImageModel, getModel, MUSE_DEFAULTS, MUSE_IMAGE_DEFAULTS, practiceMode } from "./registry";
export { generateObject, StructuredOutputError } from "./structured";
export { AIProviderError } from "./types";
export { onAIEvent } from "./telemetry";
export type { AIEvent } from "./telemetry";
export type {
  ChatMessage,
  CompletionRequest,
  CompletionResult,
  ContentPart,
  Effort,
  ModelCapabilities,
  ModelProvider,
  WebSearchHit,
  WebSearchRequest,
  WebSearchResult,
} from "./types";
export { ImageEditError } from "./image-types";
export type { ImageEditRequest, ImageEditResult, ImageInput, ImageModel } from "./image-types";
export type { ImageGenerateRequest } from "./image-types";
