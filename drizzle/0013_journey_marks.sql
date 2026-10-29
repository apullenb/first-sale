CREATE TABLE "journey_marks" (
	"business_id" text NOT NULL,
	"key" text NOT NULL,
	"url" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journey_marks_business_id_key_pk" PRIMARY KEY("business_id","key")
);
--> statement-breakpoint
ALTER TABLE "journey_marks" ADD CONSTRAINT "journey_marks_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;