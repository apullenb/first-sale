CREATE TABLE "business_insights" (
	"business_id" text PRIMARY KEY NOT NULL,
	"insights" jsonb,
	"feedback" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_insights" ADD CONSTRAINT "business_insights_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;