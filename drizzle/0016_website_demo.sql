ALTER TABLE "website_plans" DROP COLUMN "hosting";--> statement-breakpoint
ALTER TABLE "website_plans" DROP COLUMN "host_connection";--> statement-breakpoint
ALTER TABLE "website_plans" ADD COLUMN "finished" jsonb;--> statement-breakpoint
ALTER TABLE "website_plans" ADD COLUMN "existing_site" jsonb;