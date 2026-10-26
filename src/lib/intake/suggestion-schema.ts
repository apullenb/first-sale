import { z } from "zod";
import { OFFERING_KINDS, PREMISES, SELLING_CHANNELS, US_STATE_CODES } from "@/lib/domain";

// Answers AI may suggest from the owner's description; null or empty means "not stated"
export const intakeSuggestionSchema = z.object({
  state: z.enum(US_STATE_CODES).nullable(),
  owners: z.enum(["me", "others"]).nullable(),
  offeringKinds: z.array(z.enum(OFFERING_KINDS)),
  channels: z.array(z.enum(SELLING_CHANNELS)),
  premises: z.enum(PREMISES).nullable(),
});
export type IntakeSuggestion = z.infer<typeof intakeSuggestionSchema>;

export const SUGGESTION_SCHEMA_NAME = "IntakeSuggestions";
