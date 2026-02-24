-- Migration 010: Fix ON DELETE behavior for feedback_answers.scale_item_id
-- The constraint added in 009 defaults to RESTRICT, causing a violation when
-- question_scale_items rows are deleted during question edits. Re-create it
-- with ON DELETE SET NULL to preserve historical answer values (just nulling
-- the now-stale item reference).

ALTER TABLE feedback_answers
  DROP CONSTRAINT IF EXISTS feedback_answers_scale_item_id_fkey;

ALTER TABLE feedback_answers
  ADD CONSTRAINT feedback_answers_scale_item_id_fkey
  FOREIGN KEY (scale_item_id)
  REFERENCES question_scale_items(id)
  ON DELETE SET NULL;

-- Record this migration
INSERT INTO schema_migrations (version) VALUES ('010_fix_scale_item_fk_on_delete')
ON CONFLICT DO NOTHING;
