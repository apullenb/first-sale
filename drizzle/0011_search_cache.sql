CREATE TABLE "search_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "search_cache_created_idx" ON "search_cache" USING btree ("created_at");