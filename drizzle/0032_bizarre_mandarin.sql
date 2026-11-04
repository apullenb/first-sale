CREATE TABLE "social_ideas" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"day" text NOT NULL,
	"ideas" jsonb NOT NULL,
	"read" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_ideas" ADD CONSTRAINT "social_ideas_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "social_ideas_business_day_idx" ON "social_ideas" USING btree ("business_id","day");