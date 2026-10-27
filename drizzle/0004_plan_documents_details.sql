CREATE TABLE "business_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"source" text DEFAULT 'owner' NOT NULL,
	"document_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"title" text NOT NULL,
	"origin" text NOT NULL,
	"generated_kind" text,
	"mime_type" text NOT NULL,
	"byte_size" integer DEFAULT 0 NOT NULL,
	"sha256" text,
	"data" "bytea",
	"source_url" text,
	"task_id" text,
	"from_document_id" text,
	"content" jsonb NOT NULL,
	"guide" jsonb,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"workflow" text NOT NULL,
	"subject_id" text,
	"status" text DEFAULT 'running' NOT NULL,
	"message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "topic" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "level" text DEFAULT 'federal' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "why" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "agency" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "fee_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "deadline" text;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "needs_professional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "verification" text DEFAULT 'needs_verification' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "uncertainty" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "who_to_call" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "what_to_ask" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "done_when" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "retired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "topic" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "agency" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "gather" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "done_when" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "depends_on" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "simulated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "searched" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "open_questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "plan_proposal" jsonb;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "plan_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "government" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "discovered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "business_details" ADD CONSTRAINT "business_details_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_details" ADD CONSTRAINT "business_details_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_task_id_checklist_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."checklist_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_details_business_key_idx" ON "business_details" USING btree ("business_id","key");--> statement-breakpoint
CREATE INDEX "documents_business_id_idx" ON "documents" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "documents_task_id_idx" ON "documents" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_business_workflow_idx" ON "workflow_runs" USING btree ("business_id","workflow");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_tasks_business_key_idx" ON "checklist_tasks" USING btree ("business_id","key");