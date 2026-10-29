CREATE TABLE "business_insights" (
	"business_id" text PRIMARY KEY NOT NULL,
	"insights" jsonb,
	"feedback" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_plans" (
	"business_id" text PRIMARY KEY NOT NULL,
	"intake" jsonb,
	"plan" jsonb,
	"approved_at" timestamp with time zone,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps_done" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_assets" ADD COLUMN "design" jsonb;--> statement-breakpoint
ALTER TABLE "website_plans" ADD COLUMN "design" jsonb;--> statement-breakpoint
ALTER TABLE "website_plans" ADD COLUMN "hosting" jsonb;--> statement-breakpoint
ALTER TABLE "website_plans" ADD COLUMN "host_connection" jsonb;--> statement-breakpoint
ALTER TABLE "business_insights" ADD CONSTRAINT "business_insights_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_plans" ADD CONSTRAINT "marketing_plans_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;