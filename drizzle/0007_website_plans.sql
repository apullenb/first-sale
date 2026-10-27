CREATE TABLE "website_plans" (
	"business_id" text PRIMARY KEY NOT NULL,
	"platform" text,
	"domain" text,
	"domain_checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content" jsonb,
	"content_approved_at" timestamp with time zone,
	"setup_done" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "website_plans" ADD CONSTRAINT "website_plans_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;