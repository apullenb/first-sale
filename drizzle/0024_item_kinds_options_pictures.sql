CREATE TABLE "product_pictures" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"product_id" text NOT NULL,
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
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_price_checks" (
	"product_id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"result" jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "price_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "kind" text DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "status" text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "origin" text DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description_by" text DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "duration" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "included" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "options" jsonb DEFAULT '{"groups":[],"variants":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "product_pictures" ADD CONSTRAINT "product_pictures_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_pictures" ADD CONSTRAINT "product_pictures_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_price_checks" ADD CONSTRAINT "product_price_checks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_price_checks" ADD CONSTRAINT "product_price_checks_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_pictures_business_request_idx" ON "product_pictures" USING btree ("business_id","request_key");--> statement-breakpoint
CREATE INDEX "product_pictures_product_idx" ON "product_pictures" USING btree ("product_id");--> statement-breakpoint
UPDATE "products" SET "kind" = 'service', "price_text" = '$' || ("price_cents" / 100)::text || CASE WHEN "price_cents" % 100 <> 0 THEN '.' || lpad(("price_cents" % 100)::text, 2, '0') ELSE '' END FROM "businesses" WHERE "businesses"."id" = "products"."business_id" AND "businesses"."profile"->>'category' IN ('personal_care', 'home_services', 'lessons_care', 'creative_services') AND NOT (coalesce("businesses"."profile"->'offeringKinds', '[]'::jsonb) ?| array['food', 'handmade', 'resale']);
