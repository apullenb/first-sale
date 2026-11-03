import type { ModelProvider } from "@/lib/ai";

// Data-handling lines for owners, without naming the AI provider or model

export function serviceRecipient(model: Pick<ModelProvider, "name">): string {
  return model.name === "Meta Muse" ? "SnapStart’s AI service" : "the AI service this copy of SnapStart is set up with";
}

export function serviceNotes(model: Pick<ModelProvider, "name" | "model">, image?: Pick<ModelProvider, "model"> | null): string[] {
  if (model.name !== "Meta Muse") return ["That service’s own terms say how it handles what’s sent to it."];
  if (/contributor/i.test(model.model) || (image && /contributor/i.test(image.model))) {
    return ["This copy of SnapStart uses a setting that lets the AI service use what’s sent to train its models."];
  }
  return [
    "The AI service SnapStart uses says it doesn’t use your content to train its models.",
    "Its documentation doesn’t say how long it keeps requests, so we can’t promise more than that.",
    "Requirement checks ask the AI service to keep a short-term cache for up to a day. That cache holds the official pages and your business answers.",
  ];
}
