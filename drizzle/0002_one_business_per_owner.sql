DROP INDEX "businesses_owner_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_owner_id_idx" ON "businesses" USING btree ("owner_id");