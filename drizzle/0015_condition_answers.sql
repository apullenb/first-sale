CREATE TABLE "condition_answers" (
	"business_id" text NOT NULL,
	"step_key" text NOT NULL,
	"condition" text NOT NULL,
	"answer" text NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condition_answers_business_id_step_key_condition_pk" PRIMARY KEY("business_id","step_key","condition")
);
--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD COLUMN "question" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "condition_answers" ADD CONSTRAINT "condition_answers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Plans saved before questions were kept: copy each conditional step's question from its requirement, as the code words it
UPDATE "checklist_tasks" AS t SET "question" = CASE
    WHEN btrim(r."condition", E' \t\r\n') <> '' THEN btrim(r."condition", E' \t\r\n')
    ELSE 'Whether this applies depends on something First Sale couldn’t tell from your answers.'
  END
FROM "requirements" AS r
WHERE r."business_id" = t."business_id"
  AND r."applicability" = 'conditional'
  AND t."question" = ''
  AND t."key" = rtrim(left(btrim(regexp_replace(lower(r."key"), '[^a-z0-9]+', '-', 'g'), '-'), 40), '-');
