DROP INDEX "order_lines_order_product";--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "option_values" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "variant_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "unit_price_cents" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "option_values" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "order_lines_order_product_variant" ON "order_lines" USING btree ("order_id","product_id","variant_key");