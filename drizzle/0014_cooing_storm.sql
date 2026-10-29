CREATE TABLE "brand_library_files" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"group" text NOT NULL,
	"title" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_assets" ALTER COLUMN "concept_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "materials" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "quantity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD COLUMN "origin" text DEFAULT 'generated' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD COLUMN "words" text;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "photo" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_library_files" ADD CONSTRAINT "brand_library_files_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_library_files_business_idx" ON "brand_library_files" USING btree ("business_id","group");