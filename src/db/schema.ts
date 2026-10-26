import {
  boolean,
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
  DRAFT_KINDS,
  DRAFT_STATUSES,
  FULFILLMENT_METHODS,
  JURISDICTION_LEVELS,
  ORDER_STATUSES,
  TASK_STATUSES,
  VERIFICATION_STATES,
  type BusinessProfile,
} from "@/lib/domain";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
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
  (table) => [index("businesses_owner_id_idx").on(table.ownerId)],
);

// Pages the research step actually fetched; requirements cite these ids
export const sources = pgTable(
  "sources",
  {
    id: id(),
    businessId: businessId(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    level: text("level", { enum: JURISDICTION_LEVELS }).notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("sources_business_id_idx").on(table.businessId)],
);

export const requirements = pgTable(
  "requirements",
  {
    id: id(),
    businessId: businessId(),
    title: text("title").notNull(),
    whyItApplies: text("why_it_applies").notNull(),
    level: text("level", { enum: JURISDICTION_LEVELS }).notNull(),
    sourceIds: jsonb("source_ids").$type<string[]>().notNull(),
    feeCents: integer("fee_cents"),
    needsProfessional: boolean("needs_professional").notNull().default(false),
    verification: text("verification", { enum: VERIFICATION_STATES }).notNull(),
    problems: jsonb("problems").$type<string[]>().notNull().default([]),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("requirements_business_id_idx").on(table.businessId)],
);

export const checklistTasks = pgTable(
  "checklist_tasks",
  {
    id: id(),
    businessId: businessId(),
    title: text("title").notNull(),
    prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
    destinationUrl: text("destination_url"),
    prepare: jsonb("prepare").$type<string[]>().notNull().default([]),
    feeCents: integer("fee_cents"),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("todo"),
    evidenceNote: text("evidence_note"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("checklist_tasks_business_id_idx").on(table.businessId)],
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
