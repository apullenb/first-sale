ALTER TABLE "website_plans" ADD COLUMN "more_options" jsonb;--> statement-breakpoint
ALTER TABLE "website_plans" ADD COLUMN "explanations" jsonb DEFAULT '{}'::jsonb NOT NULL;