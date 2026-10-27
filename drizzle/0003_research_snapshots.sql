CREATE TABLE "research_snapshots" (
	"business_id" text PRIMARY KEY NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"profile_key" text NOT NULL,
	"model" text NOT NULL,
	"unread_sources" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "evidence" text;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "deadline" text;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "who_to_call" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "what_to_ask" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD CONSTRAINT "research_snapshots_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;