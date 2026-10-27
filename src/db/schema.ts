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
} from "@/lib/domain";
import type {
  DocumentContent,
  DocumentGuide,
  DocumentQuestion,
  DraftAnswers,
  GeneratedContent,
} from "@/lib/documents/types";
import type { PlanLink, PlanTaskDraft } from "@/lib/rules/plan";
import { PHOTO_CATEGORIES, PHOTO_CROPS, PHOTO_LOOKS, type PhotoCheck, type PhotoReview } from "@/lib/photos/types";

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
  },
  (table) => [
    index("documents_business_id_idx").on(table.businessId),
    index("documents_task_id_idx").on(table.taskId),
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
