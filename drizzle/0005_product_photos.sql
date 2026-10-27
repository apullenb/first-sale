CREATE TABLE "product_photo_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"photo_id" text NOT NULL,
	"number" integer NOT NULL,
	"parent_id" text,
	"look" text NOT NULL,
	"crop" text NOT NULL,
	"refinement" text,
	"instruction" text NOT NULL,
	"model" text NOT NULL,
	"simulated" boolean NOT NULL,
	"request_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"review" jsonb,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"title" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"check" jsonb,
	"category" text,
	"for_sale" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer" text,
	"look" text DEFAULT 'studio' NOT NULL,
	"crop" text DEFAULT 'square' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_photo_versions" ADD CONSTRAINT "product_photo_versions_photo_id_product_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."product_photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_photos" ADD CONSTRAINT "product_photos_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_photo_versions_photo_number_idx" ON "product_photo_versions" USING btree ("photo_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "product_photo_versions_photo_request_idx" ON "product_photo_versions" USING btree ("photo_id","request_key");--> statement-breakpoint
CREATE INDEX "product_photos_business_id_idx" ON "product_photos" USING btree ("business_id");