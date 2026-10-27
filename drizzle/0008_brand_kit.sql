CREATE TABLE "brand_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"kind" text NOT NULL,
	"concept_id" text NOT NULL,
	"source_id" text,
	"change" text,
	"prompt" text NOT NULL,
	"model" text NOT NULL,
	"simulated" boolean NOT NULL,
	"request_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"check" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_concepts" (
	"id" text PRIMARY KEY NOT NULL,
	"round_id" text NOT NULL,
	"business_id" text NOT NULL,
	"position" integer NOT NULL,
	"concept" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_kits" (
	"business_id" text PRIMARY KEY NOT NULL,
	"brief" jsonb,
	"chosen_logo_id" text,
	"picks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_rounds" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"request_key" text NOT NULL,
	"based_on_concept_id" text,
	"brief" jsonb NOT NULL,
	"model" text NOT NULL,
	"simulated" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_concept_id_brand_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."brand_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_concepts" ADD CONSTRAINT "brand_concepts_round_id_brand_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."brand_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_concepts" ADD CONSTRAINT "brand_concepts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_rounds" ADD CONSTRAINT "brand_rounds_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_assets_business_request_idx" ON "brand_assets" USING btree ("business_id","request_key");--> statement-breakpoint
CREATE INDEX "brand_assets_business_kind_idx" ON "brand_assets" USING btree ("business_id","kind");--> statement-breakpoint
CREATE INDEX "brand_concepts_round_id_idx" ON "brand_concepts" USING btree ("round_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_rounds_business_request_idx" ON "brand_rounds" USING btree ("business_id","request_key");