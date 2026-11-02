CREATE TABLE "square_product_links" (
	"product_id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"merchant_id" text NOT NULL,
	"environment" text NOT NULL,
	"remote_id" text,
	"origin" text NOT NULL,
	"remote" jsonb,
	"fingerprint" text,
	"imported_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"pushed_at" timestamp with time zone,
	"pending" jsonb
);
--> statement-breakpoint
ALTER TABLE "square_product_links" ADD CONSTRAINT "square_product_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "square_product_links" ADD CONSTRAINT "square_product_links_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "square_product_remote_idx" ON "square_product_links" USING btree ("business_id","environment","merchant_id","remote_id");