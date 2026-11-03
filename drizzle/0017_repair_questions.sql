-- Clears a question a step doesn't carry among its own conditions, like one copied from a re-check still waiting for review
-- or from another requirement with the same key. Steps the code writes always carry their question among their conditions.
UPDATE "checklist_tasks" SET "question" = ''
WHERE "question" <> ''
  AND NOT ("conditions" @> jsonb_build_array("question"))
  AND NOT ("requirement_status" = 'conditional' AND "question" = 'Whether this applies depends on something First Sale couldn’t tell from your answers.');
