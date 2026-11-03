CREATE TABLE "square_connections" (
	"business_id" text PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"merchant_id" text,
	"credentials" text,
	"oauth_state_hash" text,
	"oauth_expires_at" timestamp with time zone,
	"generation" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "square_description_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"connection_generation" text NOT NULL,
	"item_id" text NOT NULL,
	"name" text NOT NULL,
	"original" jsonb NOT NULL,
	"description" text NOT NULL,
	"simulated" boolean NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "square_connections" ADD CONSTRAINT "square_connections_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "square_description_drafts" ADD CONSTRAINT "square_description_drafts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "square_drafts_business_idx" ON "square_description_drafts" USING btree ("business_id");