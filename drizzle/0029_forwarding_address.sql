CREATE TABLE "email_inboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"token" text NOT NULL,
	"confirmation" jsonb,
	"first_from" text,
	"first_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_inboxes_token_unique" UNIQUE("token")
);
--> statement-breakpoint
UPDATE "customer_messages" SET "state" = 'failed', "issue" = 'This email came through the old inbox connection. Forward it to your SnapStart address to review it.' WHERE "connection_id" IS NOT NULL AND "body" = '' AND "state" IN ('pending', 'processing', 'failed');--> statement-breakpoint
UPDATE "customer_messages" SET "send_state" = 'draft' WHERE "send_state" IN ('sending', 'uncertain');--> statement-breakpoint
ALTER TABLE "customer_messages" DROP CONSTRAINT "customer_messages_connection_id_email_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "email_connections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "email_connections" CASCADE;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD COLUMN "sender_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD COLUMN "forwarded_by" text;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD COLUMN "received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD COLUMN "attachment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "email_inboxes" ADD CONSTRAINT "email_inboxes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_inbox_business_idx" ON "email_inboxes" USING btree ("business_id");--> statement-breakpoint
ALTER TABLE "customer_messages" DROP COLUMN "connection_id";--> statement-breakpoint
ALTER TABLE "customer_messages" DROP COLUMN "provider_message_id";
