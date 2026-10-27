CREATE TABLE "business_events" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"kind" text NOT NULL,
	"key" text,
	"before" jsonb,
	"after" jsonb,
	"summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"basis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_drafts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"mode" text NOT NULL,
	"answers" jsonb NOT NULL,
	"marks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"step" text NOT NULL,
	"base_key" text,
	"practice" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "requirement_status" text DEFAULT 'needs_confirmation' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "conditions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "timing" text DEFAULT 'before_selling' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "for_structures" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "renewal" jsonb;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "jurisdiction" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "already_have" text;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "submission_note" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "family_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "form_key" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "verification" jsonb;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "facts_used" jsonb;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "obtained_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "request_key" text;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "applicability" text DEFAULT 'applies' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "status" text DEFAULT 'needs_confirmation' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "condition" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "conditions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "timing" text DEFAULT 'before_selling' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "for_structures" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "fits_structure" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "renewal" text;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "renewal_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "already_have" text;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "proposed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "profile" jsonb;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "structure" text;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "coverage" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "business_events" ADD CONSTRAINT "business_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_drafts" ADD CONSTRAINT "intake_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_events_business_created_idx" ON "business_events" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_family_idx" ON "documents" USING btree ("business_id","family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_business_request_idx" ON "documents" USING btree ("business_id","request_key");