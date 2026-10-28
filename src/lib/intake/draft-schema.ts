import { z } from "zod";
import {
  BUDGET_RANGES,
  BUSINESS_CATEGORIES,
  BUSINESS_STAGES,
  EXISTING_SETUP,
  EXPERIENCE_LEVELS,
  GOALS,
  HANDOFF_METHODS,
  HELP_KINDS,
  HIRING_PLANS,
  INVENTORY_SOURCES,
  LAUNCH_TIMINGS,
  MAX_OWNERS,
  OFFERING_KINDS,
  OWNER_RELATIONS,
  PREMISES,
  REGISTERED_AS,
  SALES_RANGES,
  SELLING_CHANNELS,
  US_STATE_CODES,
  YES_NO_UNSURE,
} from "@/lib/domain";
import { type IntakeAnswers, type Marks, STEPS } from "./answers";

// Unfinished answers sent by the wizard for autosave: every field bounded, nothing required yet

const orEmpty = <T extends readonly [string, ...string[]]>(options: T) => z.union([z.enum(options), z.literal("")]);
const many = <T extends readonly [string, ...string[]]>(options: T) => z.array(z.enum(options)).max(options.length);
const yesNo = orEmpty(YES_NO_UNSURE);
const text = (max: number) => z.string().max(max);

export const intakeAnswersSchema = z.object({
  description: text(1000),
  category: orEmpty(BUSINESS_CATEGORIES),
  productTags: z.array(text(40)).max(24),
  name: text(100),
  noName: z.boolean(),
  nameIsLegalName: yesNo,
  state: orEmpty(US_STATE_CODES),
  county: text(100),
  city: text(100),
  insideCityLimits: yesNo,
  owners: z.enum(["me", "others", ""]),
  ownerCount: z.number().int().min(2).max(MAX_OWNERS),
  ownerRelation: orEmpty(OWNER_RELATIONS),
  mayAddOwners: yesNo,
  stage: orEmpty(BUSINESS_STAGES),
  registeredAs: orEmpty(REGISTERED_AS),
  alreadyHave: many(EXISTING_SETUP),
  offeringKinds: many(OFFERING_KINDS),
  firstItems: text(300),
  foodNeedsCold: yesNo,
  makesForKids: yesNo,
  foodContact: yesNo,
  inventorySources: many(INVENTORY_SOURCES),
  servicesLicensed: yesNo,
  channels: many(SELLING_CHANNELS),
  handoff: many(HANDOFF_METHODS),
  shipsOrders: yesNo,
  premises: orEmpty(PREMISES),
  customersVisit: yesNo,
  startupBudget: orEmpty(BUDGET_RANGES),
  firstYearSales: orEmpty(SALES_RANGES),
  takesOnDebt: yesNo,
  hiringPlans: orEmpty(HIRING_PLANS),
  helpKinds: many(HELP_KINDS),
  launchTiming: orEmpty(LAUNCH_TIMINGS),
  // Drafts saved before the date was asked still load
  launchDate: z.union([z.iso.date(), z.literal("")]).default(""),
  experience: orEmpty(EXPERIENCE_LEVELS),
  goals: many(GOALS),
}) satisfies z.ZodType<IntakeAnswers>;

const answerKeys = Object.keys(intakeAnswersSchema.shape) as [keyof IntakeAnswers, ...(keyof IntakeAnswers)[]];

export const intakeDraftSchema = z.object({
  mode: z.enum(["create", "edit"]),
  answers: intakeAnswersSchema,
  marks: z.partialRecord(z.enum(answerKeys), z.enum(["ai", "default"])) satisfies z.ZodType<Marks>,
  step: z.enum([...STEPS, "review"]),
  practice: z.boolean(),
  // Edit drafts: key of the saved answers the edit started from, so a save in another tab wins
  baseKey: z.string().max(64).nullable(),
});
export type IntakeDraftInput = z.infer<typeof intakeDraftSchema>;
