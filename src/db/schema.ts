import {
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema";
import {
  ACTORS,
  DOCUMENT_ORIGINS,
  DRAFT_KINDS,
  DRAFT_STATUSES,
  FULFILLMENT_METHODS,
  GENERATED_KINDS,
  JURISDICTION_LEVELS,
  ORDER_STATUSES,
  PLAN_TOPICS,
  TASK_STATUSES,
  VERIFICATION_STATES,
  type BusinessProfile,
  type BusinessStructure,
} from "@/lib/domain";
import { REQUIREMENT_STATUSES } from "@/lib/research/applicability";
import { DOCUMENT_ROLES } from "@/lib/documents/library";
import type {
  DocumentContent,
  DocumentGuide,
  DocumentQuestion,
  DraftAnswers,
  GeneratedContent,
} from "@/lib/documents/types";
import type { PlanLink, PlanTaskDraft } from "@/lib/rules/plan";
import type { CoverageCell } from "@/lib/research/coverage";
import type { FormVerification } from "@/lib/documents/official-forms";
import type { MoreOptions, OptionExplanation } from "@/lib/website/options";
import { type DomainCheck, PLATFORMS, type WebsiteContent } from "@/lib/website/types";
import type { SiteDesign } from "@/lib/website/site/design";
import type { HostConnection, HostingState } from "@/lib/website/hosting/types";
import { PHOTO_CATEGORIES, PHOTO_CROPS, PHOTO_LOOKS, type PhotoCheck, type PhotoReview } from "@/lib/photos/types";
import { ASSET_KINDS, type AssetCheck, type BrandBrief, type BrandPicks, type ConceptReply } from "@/lib/brand/types";
import type { IntakeAnswers, Marks } from "@/lib/intake/answers";
import type { DecisionBasis } from "@/lib/structure/types";
import type { WebSearchHit } from "@/lib/ai/types";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
// File bytes live in Postgres, behind the same owner checks as every other row
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => "bytea" });
const businessId = () =>
  text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" });

export * from "./auth-schema";

// One row per AI suggestion request, for per-owner usage limits
export const aiRequests = pgTable(
  "ai_requests",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("ai_requests_user_created_idx").on(table.userId, table.createdAt),
    index("ai_requests_created_idx").on(table.createdAt),
  ],
);

export const businesses = pgTable(
  "businesses",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isDemo: boolean("is_demo").notNull().default(false),
    profile: jsonb("profile").$type<BusinessProfile>().notNull(),
    createdAt: createdAt(),
  },
  // One business per owner
  (table) => [uniqueIndex("businesses_owner_id_idx").on(table.ownerId)],
);

// The last research run for a business: when it ran, for which answers, and pages it couldn't read
export const researchSnapshots = pgTable("research_snapshots", {
  businessId: text("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  // Hash of the profile it ran on, to spot answers changed since
  profileKey: text("profile_key").notNull(),
  model: text("model").notNull(),
  // Practice mode: built-in rules stood in for the AI model
  simulated: boolean("simulated").notNull().default(false),
  // Whether state and local pages were searched for, or only the built-in source list was read
  searched: boolean("searched").notNull().default(false),
  unreadSources: jsonb("unread_sources").$type<{ key: string; title: string; url: string; reason: string }[]>().notNull(),
  assumptions: jsonb("assumptions").$type<string[]>().notNull().default([]),
  openQuestions: jsonb("open_questions").$type<{ question: string; whoToCall: string }[]>().notNull().default([]),
  // Plan built from this run; the owner reviews it when a plan already exists
  planProposal: jsonb("plan_proposal").$type<PlanTaskDraft[]>(),
  planReviewedAt: timestamp("plan_reviewed_at", { withTimezone: true }),
  // When the waiting plan proposal was made: a re-check, or a re-plan after a decision changed
  proposedAt: timestamp("proposed_at", { withTimezone: true }),
  // The answers and structure decision it ran on, to say what changed since
  profile: jsonb("profile").$type<BusinessProfile>(),
  structure: text("structure"),
  // What each research category found at each level of government
  coverage: jsonb("coverage").$type<CoverageCell[]>().notNull().default([]),
  // Where official pages disagree, as the model reported them, cited pages checked in code
  conflicts: jsonb("conflicts").$type<{ about: string; explanation: string; sourceIds: string[] }[]>().notNull().default([]),
});

// Pages the research step actually fetched; requirements cite their keys
export const sources = pgTable(
  "sources",
  {
    id: id(),
    businessId: businessId(),
    // Source id from the source pack
    key: text("key").notNull(),
    // Final URL after redirects
    url: text("url").notNull(),
    title: text("title").notNull(),
    level: text("level", { enum: JURISDICTION_LEVELS }).notNull(),
    // Owner of the site in the official .gov registry, such as "City of Austin"
    government: text("government").notNull().default(""),
    // Found by searching, rather than from the built-in source list
    discovered: boolean("discovered").notNull().default(false),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("sources_business_id_idx").on(table.businessId)],
);

export const requirements = pgTable(
  "requirements",
  {
    id: id(),
    businessId: businessId(),
    key: text("key").notNull().default(""),
    title: text("title").notNull(),
    topic: text("topic", { enum: PLAN_TOPICS }).notNull().default("other"),
    whyItApplies: text("why_it_applies").notNull(),
    level: text("level", { enum: JURISDICTION_LEVELS }).notNull(),
    agency: text("agency").notNull().default(""),
    sourceIds: jsonb("source_ids").$type<string[]>().notNull(),
    evidence: text("evidence"),
    feeCents: integer("fee_cents"),
    deadline: text("deadline"),
    needsProfessional: boolean("needs_professional").notNull().default(false),
    whoToCall: text("who_to_call").notNull().default(""),
    whatToAsk: jsonb("what_to_ask").$type<string[]>().notNull().default([]),
    gather: jsonb("gather").$type<string[]>().notNull().default([]),
    doneWhen: text("done_when").notNull().default(""),
    dependsOn: jsonb("depends_on").$type<string[]>().notNull().default([]),
    verification: text("verification", { enum: VERIFICATION_STATES }).notNull(),
    problems: jsonb("problems").$type<string[]>().notNull().default([]),
    // Order the model listed them in
    position: integer("position").notNull().default(0),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    // The model's read, then the rules' status (src/lib/research/applicability.ts)
    applicability: text("applicability", { enum: ["applies", "conditional", "optional", "outside_coverage"] }).notNull().default("applies"),
    status: text("status", { enum: REQUIREMENT_STATUSES }).notNull().default("needs_confirmation"),
    // The model's own condition; conditions adds the rules' to it
    condition: text("condition").notNull().default(""),
    conditions: jsonb("conditions").$type<string[]>().notNull().default([]),
    timing: text("timing", { enum: ["before_selling", "later"] }).notNull().default("before_selling"),
    forStructures: jsonb("for_structures").$type<BusinessStructure[]>().notNull().default([]),
    fitsStructure: boolean("fits_structure").notNull().default(true),
    renewal: text("renewal"),
    renewalFeeCents: integer("renewal_fee_cents"),
    alreadyHave: text("already_have"),
  },
  (table) => [index("requirements_business_id_idx").on(table.businessId)],
);

// The startup plan. Rows are replaced only when the owner accepts a proposed change; done steps stay done.
export const checklistTasks = pgTable(
  "checklist_tasks",
  {
    id: id(),
    businessId: businessId(),
    // Stable across re-checks, so progress carries over
    key: text("key").notNull().default(""),
    position: integer("position").notNull().default(0),
    title: text("title").notNull(),
    topic: text("topic", { enum: PLAN_TOPICS }).notNull().default("other"),
    level: text("level", { enum: JURISDICTION_LEVELS }).notNull().default("federal"),
    why: text("why").notNull().default(""),
    // Keys of steps to finish first
    prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
    // First official link, kept for older readers of this table
    destinationUrl: text("destination_url"),
    links: jsonb("links").$type<PlanLink[]>().notNull().default([]),
    agency: text("agency").notNull().default(""),
    // What to gather before starting
    prepare: jsonb("prepare").$type<string[]>().notNull().default([]),
    feeCents: integer("fee_cents"),
    feeCheckedAt: timestamp("fee_checked_at", { withTimezone: true }),
    deadline: text("deadline"),
    needsProfessional: boolean("needs_professional").notNull().default(false),
    verification: text("verification", { enum: VERIFICATION_STATES }).notNull().default("needs_verification"),
    uncertainty: jsonb("uncertainty").$type<string[]>().notNull().default([]),
    whoToCall: text("who_to_call").notNull().default(""),
    whatToAsk: jsonb("what_to_ask").$type<string[]>().notNull().default([]),
    doneWhen: text("done_when").notNull().default(""),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("todo"),
    // The owner's note when marking it done
    evidenceNote: text("evidence_note"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Done, then dropped from a later plan: kept so the owner's record isn't lost
    retired: boolean("retired").notNull().default(false),
    // Came from practice-mode research, so it's labeled as practice wherever it shows
    simulated: boolean("simulated").notNull().default(false),
    requirementStatus: text("requirement_status", { enum: REQUIREMENT_STATUSES }).notNull().default("needs_confirmation"),
    conditions: jsonb("conditions").$type<string[]>().notNull().default([]),
    timing: text("timing", { enum: ["before_selling", "later"] }).notNull().default("before_selling"),
    forStructures: jsonb("for_structures").$type<BusinessStructure[]>().notNull().default([]),
    renewal: jsonb("renewal").$type<{ text: string; feeCents: number | null }>(),
    jurisdiction: text("jurisdiction").notNull().default(""),
    alreadyHave: text("already_have"),
    // Filing progress: submitted, then done once the office approves; never set by opening a link
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submissionNote: text("submission_note"),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("checklist_tasks_business_id_idx").on(table.businessId),
    uniqueIndex("checklist_tasks_business_key_idx").on(table.businessId, table.key),
  ],
);

// Details forms ask for beyond the intake answers, and the owner's decisions. Saved only after the owner reviews them.
export const businessDetails = pgTable(
  "business_details",
  {
    id: serial("id").primaryKey(),
    businessId: businessId(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    source: text("source", { enum: ["owner", "document"] }).notNull().default("owner"),
    documentId: text("document_id").references(() => documents.id, { onDelete: "set null" }),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("business_details_business_key_idx").on(table.businessId, table.key)],
);

// Uploads, pasted form text, official forms and generated documents
export const documents = pgTable(
  "documents",
  {
    id: id(),
    businessId: businessId(),
    title: text("title").notNull(),
    origin: text("origin", { enum: DOCUMENT_ORIGINS }).notNull(),
    generatedKind: text("generated_kind", { enum: GENERATED_KINDS }),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull().default(0),
    sha256: text("sha256"),
    data: bytea("data"),
    // Official page a form was fetched from
    sourceUrl: text("source_url"),
    taskId: text("task_id").references(() => checklistTasks.id, { onDelete: "set null" }),
    // The form a filled copy or answer sheet was made from
    fromDocumentId: text("from_document_id"),
    content: jsonb("content").$type<DocumentContent>().notNull(),
    guide: jsonb("guide").$type<DocumentGuide>(),
    answers: jsonb("answers").$type<DraftAnswers>().notNull().default({}),
    questions: jsonb("questions").$type<DocumentQuestion[]>().notNull().default([]),
    draft: jsonb("draft").$type<GeneratedContent>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // Library role: an unchanged original, a reviewed copy, a receipt…; null on rows saved before roles
    role: text("role", { enum: DOCUMENT_ROLES }),
    // Versions of one document share the first version's id
    familyId: text("family_id"),
    version: integer("version").notNull().default(1),
    // Entry in the official-forms catalog it came from
    formKey: text("form_key"),
    verification: jsonb("verification").$type<FormVerification>(),
    // Facts the drafted answers used, to flag the draft when they change
    factsUsed: jsonb("facts_used").$type<Record<string, string>>(),
    // When the app downloaded it from the official site
    obtainedAt: timestamp("obtained_at", { withTimezone: true }),
    // From the browser, so a retried request returns the document already made
    requestKey: text("request_key"),
  },
  (table) => [
    index("documents_business_id_idx").on(table.businessId),
    index("documents_task_id_idx").on(table.taskId),
    index("documents_family_idx").on(table.businessId, table.familyId),
    uniqueIndex("documents_business_request_idx").on(table.businessId, table.requestKey),
  ],
);

// Long AI jobs, so a reload can show one still running and a failed one can be retried
export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: id(),
    businessId: businessId(),
    workflow: text("workflow").notNull(),
    subjectId: text("subject_id"),
    status: text("status", { enum: ["running", "succeeded", "failed"] }).notNull().default("running"),
    // Owner-facing; never the error's details
    message: text("message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("workflow_runs_business_workflow_idx").on(table.businessId, table.workflow)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    businessId: businessId(),
    name: text("name").notNull(),
    materials: text("materials").notNull(),
    priceCents: integer("price_cents").notNull(),
    unitCostCents: integer("unit_cost_cents"),
    quantity: integer("quantity").notNull(),
    photoUrl: text("photo_url"),
  },
  (table) => [index("products_business_id_idx").on(table.businessId)],
);

// AI drafts stay drafts until the owner approves them
export const drafts = pgTable(
  "drafts",
  {
    id: id(),
    businessId: businessId(),
    kind: text("kind", { enum: DRAFT_KINDS }).notNull(),
    subjectId: text("subject_id"),
    body: text("body").notNull(),
    flags: jsonb("flags").$type<string[]>().notNull().default([]),
    status: text("status", { enum: DRAFT_STATUSES }).notNull().default("draft"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("drafts_business_id_idx").on(table.businessId)],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    businessId: businessId(),
    isDemo: boolean("is_demo").notNull().default(false),
    customerName: text("customer_name").notNull(),
    fulfillment: text("fulfillment", { enum: FULFILLMENT_METHODS }).notNull(),
    requestedDate: date("requested_date"),
    notes: text("notes").notNull().default(""),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("new"),
    createdAt: createdAt(),
  },
  (table) => [index("orders_business_id_idx").on(table.businessId)],
);

// Serial id + unique index: drizzle-kit mis-diffs composite primary keys
export const orderLines = pgTable(
  "order_lines",
  {
    id: serial("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    uniqueIndex("order_lines_order_product").on(table.orderId, table.productId),
    index("order_lines_product_id_idx").on(table.productId),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("stock_movements_product_id_idx").on(table.productId),
    index("stock_movements_order_id_idx").on(table.orderId),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    actor: text("actor", { enum: ACTORS }).notNull(),
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("order_events_order_id_idx").on(table.orderId)],
);

export const hiringScenarios = pgTable(
  "hiring_scenarios",
  {
    id: id(),
    businessId: businessId(),
    tasks: jsonb("tasks").$type<string[]>().notNull().default([]),
    hoursPerWeek: doublePrecision("hours_per_week").notNull(),
    hourlyCostCents: integer("hourly_cost_cents").notNull(),
    grossMargin: doublePrecision("gross_margin").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("hiring_scenarios_business_id_idx").on(table.businessId)],
);

// Product photos. The upload is never changed; each edit is a separate version linked to it.
export const productPhotos = pgTable(
  "product_photos",
  {
    id: id(),
    businessId: businessId(),
    title: text("title").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    data: bytea("data").notNull(),
    check: jsonb("check").$type<PhotoCheck>(),
    // The owner's pick; starts as the check's suggestion
    category: text("category", { enum: PHOTO_CATEGORIES }),
    // Objects in the photo the owner is selling, by name
    forSale: jsonb("for_sale").$type<string[]>().notNull().default([]),
    // The owner's answer to the check's question
    answer: text("answer"),
    look: text("look", { enum: PHOTO_LOOKS }).notNull().default("studio"),
    crop: text("crop", { enum: PHOTO_CROPS }).notNull().default("square"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("product_photos_business_id_idx").on(table.businessId)],
);

export const productPhotoVersions = pgTable(
  "product_photo_versions",
  {
    id: id(),
    photoId: text("photo_id")
      .notNull()
      .references(() => productPhotos.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    // The version this one refined; null when made from the original alone
    parentId: text("parent_id"),
    look: text("look", { enum: PHOTO_LOOKS }).notNull(),
    crop: text("crop", { enum: PHOTO_CROPS }).notNull(),
    // The owner's requested change, in their words
    refinement: text("refinement"),
    instruction: text("instruction").notNull(),
    model: text("model").notNull(),
    // Practice preview, not made by the image service
    simulated: boolean("simulated").notNull(),
    // From the browser, so a retried request returns this version instead of paying for another
    requestKey: text("request_key").notNull(),
    // Exactly as returned, with the size read from the file
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    data: bytea("data").notNull(),
    review: jsonb("review").$type<PhotoReview>(),
    // Set only after the owner confirms it shows the product accurately
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("product_photo_versions_photo_number_idx").on(table.photoId, table.number),
    uniqueIndex("product_photo_versions_photo_request_idx").on(table.photoId, table.requestKey),
  ],
);

// The owner's website plan: platform, web address, drafted page copy and setup progress. One per business.
export const websitePlans = pgTable("website_plans", {
  businessId: text("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  platform: text("platform", { enum: PLATFORMS }),
  domain: text("domain"),
  domainChecks: jsonb("domain_checks").$type<DomainCheck[]>().notNull().default([]),
  content: jsonb("content").$type<WebsiteContent>(),
  // Set when the owner approves the page copy; cleared when they change it
  contentApprovedAt: timestamp("content_approved_at", { withTimezone: true }),
  setupDone: jsonb("setup_done").$type<string[]>().notNull().default([]),
  // Other builders Muse found when the owner asked, with their sources
  moreOptions: jsonb("more_options").$type<MoreOptions>(),
  // "Explain more" answers, by option key, so each is written once
  explanations: jsonb("explanations").$type<Record<string, OptionExplanation>>().notNull().default({}),
  // The site First Sale builds: look, parts shown, and each item's price, photo and buy link
  design: jsonb("design").$type<SiteDesign>(),
  // The last publish, real or practice
  hosting: jsonb("hosting").$type<HostingState>(),
  // The owner's Netlify connection; the token inside is encrypted and never leaves the server
  hostConnection: jsonb("host_connection").$type<HostConnection>(),
  updatedAt: updatedAt(),
});

// Branding: the owner's brief and picks. One per business.
export const brandKits = pgTable("brand_kits", {
  businessId: text("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  brief: jsonb("brief").$type<BrandBrief>(),
  // The owner's pick; versions and brand images are made from it
  chosenLogoId: text("chosen_logo_id"),
  // Approved files by kind: the version set, then each brand image
  picks: jsonb("picks").$type<BrandPicks>().notNull().default({}),
  updatedAt: updatedAt(),
});

// One request for logo ideas, with the brief it was written from
export const brandRounds = pgTable(
  "brand_rounds",
  {
    id: id(),
    businessId: businessId(),
    // From the browser, so a retried request returns this round instead of writing another
    requestKey: text("request_key").notNull(),
    // "More like this": the idea it grew from
    basedOnConceptId: text("based_on_concept_id"),
    brief: jsonb("brief").$type<BrandBrief>().notNull(),
    model: text("model").notNull(),
    simulated: boolean("simulated").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("brand_rounds_business_request_idx").on(table.businessId, table.requestKey)],
);

export const brandConcepts = pgTable(
  "brand_concepts",
  {
    id: id(),
    roundId: text("round_id")
      .notNull()
      .references(() => brandRounds.id, { onDelete: "cascade" }),
    businessId: businessId(),
    position: integer("position").notNull(),
    concept: jsonb("concept").$type<ConceptReply>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("brand_concepts_round_id_idx").on(table.roundId)],
);

// Every generated logo, version and brand image, byte for byte as returned
export const brandAssets = pgTable(
  "brand_assets",
  {
    id: id(),
    businessId: businessId(),
    kind: text("kind", { enum: ASSET_KINDS }).notNull(),
    conceptId: text("concept_id")
      .notNull()
      .references(() => brandConcepts.id, { onDelete: "cascade" }),
    // The logo it was made from: the one refined, or the chosen logo
    sourceId: text("source_id"),
    // The owner's requested change, in their words
    change: text("change"),
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    // Practice preview, not made by the image service
    simulated: boolean("simulated").notNull(),
    // Same key on a retry returns this file instead of paying for another
    requestKey: text("request_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    data: bytea("data").notNull(),
    check: jsonb("check").$type<AssetCheck>(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("brand_assets_business_request_idx").on(table.businessId, table.requestKey),
    index("brand_assets_business_kind_idx").on(table.businessId, table.kind),
  ],
);

// Intake answers saved as the owner goes, so they can pick up where they left off. One per owner.
export const intakeDrafts = pgTable("intake_drafts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // "create" before the business exists; "edit" holds changes not confirmed yet
  mode: text("mode", { enum: ["create", "edit"] }).notNull(),
  answers: jsonb("answers").$type<IntakeAnswers>().notNull(),
  // Answers filled in by AI or from other answers, not confirmed yet
  marks: jsonb("marks").$type<Marks>().notNull().default({}),
  step: text("step").notNull(),
  // Edit drafts: the saved answers they started from, to spot a save made elsewhere since
  baseKey: text("base_key"),
  // Suggestions came from practice-mode word matching
  practice: boolean("practice").notNull().default(false),
  updatedAt: updatedAt(),
});

// Confirmed answer changes and decisions, added to and never edited
export const businessEvents = pgTable(
  "business_events",
  {
    id: id(),
    businessId: businessId(),
    kind: text("kind", { enum: ["profile", "decision"] }).notNull(),
    // Decision detail key, such as "structure_choice"; null for answer changes
    key: text("key"),
    before: jsonb("before").$type<BusinessProfile | string | null>(),
    after: jsonb("after").$type<BusinessProfile | string | null>(),
    // Owner-facing lines: what changed
    summary: jsonb("summary").$type<string[]>().notNull().default([]),
    basis: jsonb("basis").$type<DecisionBasis>(),
    createdAt: createdAt(),
  },
  (table) => [index("business_events_business_created_idx").on(table.businessId, table.createdAt)],
);

// Official-page search results shared by every owner, so the same question for the same place isn't paid for twice in a week
export const searchCache = pgTable(
  "search_cache",
  {
    // Hash of the question and place
    key: text("key").primaryKey(),
    hits: jsonb("hits").$type<WebSearchHit[]>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("search_cache_created_idx").on(table.createdAt)],
);
