ALTER TABLE "checklist_tasks" ADD COLUMN "notes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "contacts" jsonb;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "background" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "followed_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD COLUMN "offices" jsonb DEFAULT '[]'::jsonb NOT NULL;