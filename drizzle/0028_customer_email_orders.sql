CREATE TABLE "customer_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"connection_id" text,
	"source_key" text NOT NULL,
	"source" text NOT NULL,
	"provider_message_id" text,
	"thread_id" text,
	"sender" text DEFAULT '' NOT NULL,
	"subject" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"document_id" text,
	"order_id" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"extraction" jsonb,
	"simulated" boolean DEFAULT false NOT NULL,
	"issue" text,
	"reply" text DEFAULT '' NOT NULL,
	"send_state" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"grant_id" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_connections_grant_id_unique" UNIQUE("grant_id")
);
--> statement-breakpoint
CREATE TABLE "order_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_on" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"request_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "name_snapshot" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "work_type" text DEFAULT 'products' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "job_time" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "total_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "request_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_connection_id_email_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."email_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_connections" ADD CONSTRAINT "email_connections_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_message_source_idx" ON "customer_messages" USING btree ("business_id","source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "email_business_idx" ON "email_connections" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_payment_request_idx" ON "order_payments" USING btree ("order_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_request_key_idx" ON "orders" USING btree ("business_id","request_key");
--> statement-breakpoint
UPDATE order_lines SET name_snapshot = products.name FROM products WHERE order_lines.product_id = products.id;
--> statement-breakpoint
UPDATE orders SET total_cents = totals.amount FROM (
  SELECT order_id, CASE WHEN count(*) = count(unit_price_cents) AND sum(unit_price_cents::bigint * quantity) <= 100000000 THEN sum(unit_price_cents::bigint * quantity)::integer ELSE NULL END AS amount
  FROM order_lines GROUP BY order_id
) AS totals WHERE orders.id = totals.order_id;
