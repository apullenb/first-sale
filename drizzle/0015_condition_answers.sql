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
-- Plans saved before questions were kept: copy a conditional step's question from the run its plan came from.
-- Only when that run's plan was applied, one requirement alone has the step's key, and the step already carries that condition.
UPDATE "checklist_tasks" AS t SET "question" = m."condition"
FROM (
  SELECT r."business_id",
    rtrim(left(btrim(regexp_replace(lower(r."key"), '[^a-z0-9]+', '-', 'g'), '-'), 40), '-') AS "slug",
    min(r."applicability") AS "applicability",
    min(btrim(r."condition", E' \t\r\n')) AS "condition",
    count(*) AS "matches"
  FROM "requirements" AS r
  INNER JOIN "research_snapshots" AS s ON s."business_id" = r."business_id" AND s."plan_reviewed_at" IS NOT NULL
  GROUP BY r."business_id", 2
) AS m
WHERE m."business_id" = t."business_id"
  AND m."slug" = t."key"
  AND m."matches" = 1
  AND m."applicability" = 'conditional'
  AND m."condition" <> ''
  AND t."question" = ''
  AND t."requirement_status" = 'conditional'
  AND t."conditions" @> jsonb_build_array(m."condition");
